import { createClient } from '@supabase/supabase-js';

// GET /api/billing/cron-crypto-renewals
// Vercel Cron entry. Configured to run daily at 12:00 UTC via vercel.json.
//
// Walks billing_orders for paid crypto orders and:
//   1. **Auto-downgrade**: when period_ends_at <= now, downgrade the user's
//      plan to 'free' (unless they have a separate active Stripe sub).
//   2. **Renewal reminder**: when 14 >= days-to-expiry > 0, insert a
//      reminder row into the user's audit_log so the front-end can surface
//      a banner. We don't have transactional email; this is the closest
//      drop-in until a Resend/Postmark integration lands.
//
// Auth: callable by Vercel's cron runner (which presents the
// `x-vercel-cron-signature` header from the project secret). For
// belt-and-braces, the endpoint also accepts a `?token=...` query
// parameter matching CRON_SHARED_SECRET so it can be manually re-run by
// an operator if Vercel cron silently skips a day.
export default async function handler(req, res) {
  const isVercelCron = !!req.headers['x-vercel-cron'] || !!req.headers['x-vercel-cron-signature'];
  const sharedSecret = process.env.CRON_SHARED_SECRET;
  const tokenOk = sharedSecret && req.query?.token === sharedSecret;
  if (!isVercelCron && !tokenOk) {
    return res.status(401).json({ error: 'Unauthorized — cron only' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const nowIso = now.toISOString();
  const in14Days = new Date(now); in14Days.setUTCDate(in14Days.getUTCDate() + 14);

  // 1. Auto-downgrade expired crypto periods.
  const { data: expired } = await supabase
    .from('billing_orders')
    .select('id, user_id, plan_id, period_ends_at')
    .eq('billing_method', 'crypto_coinbase')
    .eq('status', 'paid')
    .lte('period_ends_at', nowIso);

  let downgraded = 0;
  let downgradeSkipped = 0;
  for (const order of (expired || [])) {
    const { data: profile } = await supabase
      .from('user_profiles').select('plan, stripe_subscription_id')
      .eq('user_id', order.user_id).maybeSingle();
    // If the user has a separate active Stripe sub, don't override it.
    if (profile?.stripe_subscription_id) {
      downgradeSkipped += 1;
      await supabase.from('billing_orders').update({ status: 'expired' }).eq('id', order.id);
      continue;
    }
    // Don't double-downgrade — only act if their current plan still
    // matches what this order paid for.
    if (profile?.plan !== order.plan_id) {
      await supabase.from('billing_orders').update({ status: 'expired' }).eq('id', order.id);
      continue;
    }
    await supabase.from('user_profiles').update({
      plan: 'free',
      extra_accounts_paid: 0,
      updated_at: nowIso,
    }).eq('user_id', order.user_id);
    await supabase.from('billing_orders').update({ status: 'expired' }).eq('id', order.id);
    await supabase.from('audit_log').insert({
      user_id: order.user_id,
      event_type: 'billing_crypto_period_expired',
      metadata: { order_id: order.id, plan_id: order.plan_id, period_ended: order.period_ends_at },
    });
    downgraded += 1;
  }

  // 2. Renewal reminders — surface in the in-app banner. We dedupe by
  // checking the most-recent audit row for this user/order. (audit_log
  // is append-only; a fresher reminder row replaces the visible banner.)
  const { data: nearExpiry } = await supabase
    .from('billing_orders')
    .select('id, user_id, plan_id, period_ends_at')
    .eq('billing_method', 'crypto_coinbase')
    .eq('status', 'paid')
    .gt('period_ends_at', nowIso)
    .lte('period_ends_at', in14Days.toISOString());

  let remindersInserted = 0;
  for (const order of (nearExpiry || [])) {
    // Avoid spamming the audit log — only insert one reminder per day per
    // order. Check the latest audit row for this event.
    const { data: lastRow } = await supabase
      .from('audit_log')
      .select('created_at')
      .eq('user_id', order.user_id)
      .eq('event_type', 'billing_crypto_renewal_reminder')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRow && (now.getTime() - new Date(lastRow.created_at).getTime()) < 23 * 60 * 60 * 1000) {
      continue;
    }
    const daysLeft = Math.max(0, Math.round((new Date(order.period_ends_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    await supabase.from('audit_log').insert({
      user_id: order.user_id,
      event_type: 'billing_crypto_renewal_reminder',
      metadata: { order_id: order.id, plan_id: order.plan_id, days_left: daysLeft, period_ends_at: order.period_ends_at },
    });
    remindersInserted += 1;
  }

  return res.status(200).json({
    ok: true,
    ranAt: nowIso,
    downgraded,
    downgradeSkipped,
    remindersInserted,
    expiredScanned: (expired || []).length,
    nearExpiryScanned: (nearExpiry || []).length,
  });
}
