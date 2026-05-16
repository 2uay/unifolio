import { createClient } from '@supabase/supabase-js';
import {
  verifyStripeSignature, verifyCoinbaseSignature, readRawBody,
  planFromMetadata, TIERS,
} from './_helpers.js';

// Raw body required for signature verification.
export const config = { api: { bodyParser: false } };

// POST /api/billing/webhook
// Single dispatcher for Stripe AND Coinbase Commerce webhooks. Routes by
// which signature header is present so we save one Vercel serverless slot
// (Hobby cap is 12; we're consolidating).
//   - stripe-signature             → Stripe path
//   - x-cc-webhook-signature       → Coinbase Commerce path
// Both providers should point their webhook URL at this endpoint.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSig = req.headers['stripe-signature'];
  const coinbaseSig = req.headers['x-cc-webhook-signature'];
  if (!stripeSig && !coinbaseSig) {
    return res.status(400).json({ error: 'No recognized webhook signature header' });
  }

  const rawBody = await readRawBody(req);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  if (stripeSig) return handleStripe(req, res, { rawBody, stripeSig, supabase });
  return handleCoinbase(req, res, { rawBody, coinbaseSig, supabase });
}

// ─── STRIPE ────────────────────────────────────────────────────
async function handleStripe(req, res, { rawBody, stripeSig, supabase }) {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe webhook secret is not configured' });
  try {
    verifyStripeSignature(rawBody, stripeSig, WEBHOOK_SECRET);
  } catch (err) {
    console.warn('[billing/webhook:stripe] signature failed:', err?.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await stripeCheckoutCompleted(supabase, event.data.object);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await stripeSubChange(supabase, event.data.object);
        break;
      case 'customer.subscription.deleted':
        await stripeSubDeleted(supabase, event.data.object);
        break;
      case 'invoice.payment_failed':
        await stripeInvoiceFailed(supabase, event.data.object);
        break;
      default:
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[billing/webhook:stripe] handler failed:', err?.message);
    return res.status(500).json({ error: 'Handler error' });
  }
}

async function stripeCheckoutCompleted(supabase, session) {
  const userId = session.client_reference_id || session.metadata?.user_id;
  const planId = planFromMetadata(session.metadata);
  if (!userId || !planId) {
    console.warn('[billing/webhook:stripe] checkout.completed missing user/plan', { id: session.id });
    return;
  }
  const extraAccounts = Math.max(0, parseInt(session.metadata?.extra_accounts || '0', 10));
  const profileUpdate = {
    plan: planId,
    extra_accounts_paid: extraAccounts,
    stripe_customer_id: session.customer,
    updated_at: new Date().toISOString(),
  };
  if (session.subscription) profileUpdate.stripe_subscription_id = session.subscription;
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...profileUpdate }, { onConflict: 'user_id' });
  if (error) throw error;
  await supabase.from('billing_orders').insert({
    user_id: userId,
    plan_id: planId,
    billing_method: 'stripe_checkout',
    currency: (session.currency || 'usd').toUpperCase(),
    amount_total: session.amount_total ?? null,
    status: 'paid',
    external_id: session.id,
    metadata: { extra_accounts: extraAccounts, mode: session.mode },
  }).then(({ error: insertErr }) => {
    if (insertErr) console.warn('[billing/webhook:stripe] billing_orders insert failed:', insertErr.message);
  });
}

async function stripeSubChange(supabase, subscription) {
  const userId = subscription.metadata?.user_id;
  const planId = planFromMetadata(subscription.metadata);
  if (!userId || !planId) return;
  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    return stripeSubDeleted(supabase, subscription);
  }
  const extraAccounts = Math.max(0, parseInt(subscription.metadata?.extra_accounts || '0', 10));
  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      plan: planId,
      extra_accounts_paid: extraAccounts,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function stripeSubDeleted(supabase, subscription) {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;
  const { error } = await supabase
    .from('user_profiles')
    .update({
      plan: 'free',
      extra_accounts_paid: 0,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;
}

async function stripeInvoiceFailed(supabase, invoice) {
  const userId = invoice.subscription_details?.metadata?.user_id;
  if (!userId) return;
  await supabase.from('audit_log').insert({
    user_id: userId,
    event_type: 'billing_invoice_failed',
    metadata: { invoice_id: invoice.id, amount_due: invoice.amount_due, attempt_count: invoice.attempt_count },
  }).then(({ error }) => {
    if (error) console.warn('[billing/webhook:stripe] audit insert failed:', error.message);
  });
}

// ─── COINBASE COMMERCE ─────────────────────────────────────────
async function handleCoinbase(req, res, { rawBody, coinbaseSig, supabase }) {
  const SECRET = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!SECRET) return res.status(503).json({ error: 'Coinbase webhook secret not configured' });
  try {
    verifyCoinbaseSignature(rawBody, coinbaseSig, SECRET);
  } catch (err) {
    console.warn('[billing/webhook:crypto] signature failed:', err?.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  const charge = event?.event?.data;
  if (!charge) return res.status(200).json({ received: true });

  try {
    const type = event.event?.type;
    if (type === 'charge:confirmed') {
      const meta = charge.metadata || {};
      const userId = meta.user_id;
      const planId = meta.plan_id;
      if (!userId || !TIERS[planId]) {
        console.warn('[billing/webhook:crypto] confirmed charge missing user/plan', { id: charge.id });
        return res.status(200).json({ received: true });
      }
      const extraAccounts = Math.max(0, parseInt(meta.extra_accounts || '0', 10));
      const isOneTime = meta.is_one_time === 'true' || meta.is_one_time === true;
      const billing = meta.billing || 'annual';

      const now = new Date();
      const periodStartsAt = now;
      const periodEndsAt = isOneTime ? null : new Date(now);
      if (periodEndsAt) {
        if (billing === 'monthly') periodEndsAt.setUTCMonth(periodEndsAt.getUTCMonth() + 1);
        else periodEndsAt.setUTCFullYear(periodEndsAt.getUTCFullYear() + 1);
      }

      await supabase.from('user_profiles').upsert({
        user_id: userId,
        plan: planId,
        extra_accounts_paid: extraAccounts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      await supabase.from('billing_orders').update({
        status: 'paid',
        period_starts_at: periodStartsAt.toISOString(),
        period_ends_at: periodEndsAt ? periodEndsAt.toISOString() : null,
        metadata: { ...meta, confirmed_at: new Date().toISOString() },
      }).eq('id', charge.id);
    } else if (type === 'charge:failed' || type === 'charge:delayed') {
      await supabase.from('billing_orders').update({ status: type.split(':')[1] }).eq('id', charge.id);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[billing/webhook:crypto] handler failed:', err?.message);
    return res.status(500).json({ error: 'Handler error' });
  }
}
