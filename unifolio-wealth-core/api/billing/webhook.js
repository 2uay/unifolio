import { createClient } from '@supabase/supabase-js';
import { verifyStripeSignature, readRawBody, planFromMetadata } from './_helpers.js';

// Disable Vercel's default body parser so we can verify the raw payload
// against the Stripe signature. JSON.parse mutates whitespace and breaks
// HMAC verification.
export const config = { api: { bodyParser: false } };

// POST /api/billing/webhook
// Stripe webhook entry. We listen for the subset of events that mutate a
// user's entitlements:
//
//  - checkout.session.completed         → first activation
//  - customer.subscription.updated      → plan changes / quantity changes
//  - customer.subscription.deleted      → downgrade to free
//  - invoice.payment_failed             → leave plan in place (Stripe retries),
//                                         log for ops visibility
//
// All other events are acked with 200 (Stripe retries on non-2xx) but
// otherwise ignored so we don't have to enumerate the entire event taxonomy.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe webhook secret is not configured' });
  }

  const rawBody = await readRawBody(req);
  try {
    verifyStripeSignature(rawBody, req.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch (err) {
    console.warn('[billing/webhook] signature verification failed:', err?.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(supabase, event.data.object);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await handleSubscriptionChange(supabase, event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(supabase, event.data.object);
        break;
      case 'invoice.payment_failed':
        await logInvoiceFailure(supabase, event.data.object);
        break;
      default:
        // Acknowledged but no entitlement change.
        break;
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[billing/webhook] handler failed:', err?.message || err);
    // Returning 500 makes Stripe retry — appropriate for transient errors.
    return res.status(500).json({ error: 'Handler error' });
  }
}

async function handleCheckoutCompleted(supabase, session) {
  const userId = session.client_reference_id || session.metadata?.user_id;
  const planId = planFromMetadata(session.metadata);
  if (!userId || !planId) {
    console.warn('[billing/webhook] checkout.completed missing user_id or plan_id', { session_id: session.id });
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
    if (insertErr) console.warn('[billing/webhook] billing_orders insert failed:', insertErr.message);
  });
}

async function handleSubscriptionChange(supabase, subscription) {
  const userId = subscription.metadata?.user_id;
  const planId = planFromMetadata(subscription.metadata);
  if (!userId || !planId) return;
  if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
    return handleSubscriptionDeleted(supabase, subscription);
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

async function handleSubscriptionDeleted(supabase, subscription) {
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

async function logInvoiceFailure(supabase, invoice) {
  const userId = invoice.subscription_details?.metadata?.user_id;
  if (!userId) return;
  await supabase.from('audit_log').insert({
    user_id: userId,
    event_type: 'billing_invoice_failed',
    metadata: {
      invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      attempt_count: invoice.attempt_count,
    },
  }).then(({ error }) => {
    if (error) console.warn('[billing/webhook] audit log insert failed:', error.message);
  });
}
