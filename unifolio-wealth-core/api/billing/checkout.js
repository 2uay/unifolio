import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import {
  validateBillingRequest, buildStripeLineItems, stripeRequest,
  TIERS, ACCOUNT_ADD_ON_USD, ACCOUNT_ADD_ON_CAD,
} from './_helpers.js';

// POST /api/billing/checkout?provider=stripe|interac|crypto
// Body: { planId, billing, currency, extraAccounts }
// Auth: Supabase JWT
//
// Consolidates the three checkout entry points (Stripe Checkout, Interac
// e-Transfer manual order, Coinbase Commerce crypto charge) behind one
// serverless function so we stay under the Vercel Hobby 12-function cap.
// Routes by ?provider= query param; payload validation is shared.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const provider = String(req.query?.provider || '').toLowerCase();
  if (!['stripe', 'interac', 'crypto'].includes(provider)) {
    return res.status(400).json({ error: 'Unknown provider — use ?provider=stripe|interac|crypto' });
  }

  // Auth — shared across all providers.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  let userId, userEmail;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });
    userId = data.user.id;
    userEmail = data.user.email;
  } catch (err) {
    console.error('[billing/checkout] auth check failed:', err?.message);
    return res.status(500).json({ error: 'Auth verification failed' });
  }

  if (provider === 'stripe') return handleStripe(req, res, { supabase, userId, userEmail });
  if (provider === 'interac') return handleInterac(req, res, { supabase, userId, userEmail });
  if (provider === 'crypto') return handleCrypto(req, res, { supabase, userId, userEmail });
}

// ─── STRIPE ────────────────────────────────────────────────────
async function handleStripe(req, res, { userId, userEmail }) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured on this deployment', configured: false });
  }

  const validation = validateBillingRequest(req.body || {});
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const { tier, currency, billing, extraAccounts, isOneTime } = validation;
  const planId = req.body.planId;
  const origin = (req.headers.origin || `https://${req.headers.host || 'unifolio.ca'}`).replace(/\/$/, '');

  const lineItems = buildStripeLineItems({ planId, tier, currency, billing, extraAccounts, isOneTime });
  const sessionPayload = {
    mode: isOneTime ? 'payment' : 'subscription',
    payment_method_types: currency === 'CAD' ? ['card', 'acss_debit'] : ['card'],
    line_items: lineItems,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?plan=${planId}&billing=${billing}&currency=${currency}&extra=${extraAccounts}&cancelled=1`,
    customer_email: userEmail,
    client_reference_id: userId,
    metadata: { user_id: userId, plan_id: planId, billing, currency, extra_accounts: String(extraAccounts) },
    allow_promotion_codes: true,
  };
  if (!isOneTime) {
    sessionPayload.subscription_data = {
      metadata: { user_id: userId, plan_id: planId, billing, extra_accounts: String(extraAccounts) },
    };
  }
  if (currency === 'CAD') {
    sessionPayload.payment_method_options = {
      acss_debit: {
        mandate_options: {
          payment_schedule: isOneTime ? 'sporadic' : 'interval',
          transaction_type: 'personal',
          interval_description: isOneTime ? 'One-time charge' : (billing === 'annual' ? 'Yearly' : 'Monthly'),
        },
      },
    };
  }

  try {
    const session = await stripeRequest('/checkout/sessions', sessionPayload, STRIPE_SECRET_KEY);
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[billing/checkout:stripe] failed:', err?.stripeBody || err?.message);
    return res.status(502).json({ error: err?.message || 'Stripe checkout creation failed' });
  }
}

// ─── INTERAC E-TRANSFER (manual, CAD only) ─────────────────────
async function handleInterac(req, res, { supabase, userId, userEmail }) {
  const RECEIVING_EMAIL = process.env.INTERAC_ETRANSFER_EMAIL;
  if (!RECEIVING_EMAIL) {
    return res.status(503).json({ error: 'Interac e-Transfer is not configured on this deployment', configured: false });
  }

  const validation = validateBillingRequest({ ...req.body, currency: 'CAD' });
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const { tier, billing, extraAccounts, isOneTime } = validation;
  const baseUnit = tier.base.CAD || 0;
  const annualMultiplier = billing === 'annual' ? 12 : 1;
  const baseAmount = baseUnit * annualMultiplier;
  const addOnAmount = extraAccounts * ACCOUNT_ADD_ON_CAD * annualMultiplier;
  const totalAmount = baseAmount + addOnAmount;

  const orderId = randomUUID();
  const orderShortId = orderId.split('-')[0].toUpperCase();
  const securityAnswer = orderId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const securityQuestion = `Unifolio order ${orderShortId}`;

  const { error: insertErr } = await supabase
    .from('billing_orders')
    .insert({
      id: orderId,
      user_id: userId,
      plan_id: req.body.planId,
      billing_method: 'interac_etransfer',
      currency: 'CAD',
      amount_total: Math.round(totalAmount * 100),
      status: 'pending',
      external_id: securityAnswer,
      metadata: {
        billing,
        extra_accounts: extraAccounts,
        is_one_time: isOneTime,
        user_email: userEmail,
        security_question: securityQuestion,
      },
    });
  if (insertErr) {
    console.error('[billing/checkout:interac] order insert failed:', insertErr.message);
    return res.status(500).json({ error: 'Could not create order' });
  }

  return res.status(200).json({
    orderId,
    orderShortId,
    securityQuestion,
    securityAnswer,
    receivingEmail: RECEIVING_EMAIL,
    amount: totalAmount,
    currency: 'CAD',
    planTitle: tier.title,
    billingDescription: isOneTime
      ? `One-time lifetime payment of CA$${totalAmount.toFixed(2)}`
      : `${billing === 'annual' ? 'Annual' : 'Monthly'} payment of CA$${totalAmount.toFixed(2)}`,
    instructions: [
      'Log into your Canadian bank or credit union.',
      'Send an Interac e-Transfer for the exact amount shown above.',
      `Recipient email: ${RECEIVING_EMAIL}`,
      `Security question: ${securityQuestion}`,
      `Security answer: ${securityAnswer}`,
      `(You'll need to share the answer with your bank — keep this page open.)`,
      'Your plan activates within 24 hours of the transfer clearing. We email you a confirmation.',
    ],
  });
}

// ─── CRYPTO (Coinbase Commerce) ────────────────────────────────
async function handleCrypto(req, res, { supabase, userId, userEmail }) {
  const API_KEY = process.env.COINBASE_COMMERCE_API_KEY;
  if (!API_KEY) {
    return res.status(503).json({ error: 'Coinbase Commerce is not configured on this deployment', configured: false });
  }

  const validation = validateBillingRequest({ ...req.body, currency: 'USD' });
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const { tier, billing, extraAccounts, isOneTime } = validation;
  const baseUnit = tier.base.USD || 0;
  const annualMultiplier = billing === 'annual' ? 12 : 1;
  const baseAmount = baseUnit * annualMultiplier;
  const addOnAmount = extraAccounts * ACCOUNT_ADD_ON_USD * annualMultiplier;
  const totalAmount = baseAmount + addOnAmount;

  const origin = (req.headers.origin || `https://${req.headers.host || 'unifolio.ca'}`).replace(/\/$/, '');
  const planId = req.body.planId;

  const chargePayload = {
    name: `Unifolio ${tier.title}${isOneTime ? ' (Lifetime)' : ''}`,
    description: isOneTime
      ? `One-time payment for lifetime access.`
      : `${billing === 'annual' ? '12 months' : '1 month'} of Unifolio ${tier.title}${extraAccounts > 0 ? ` + ${extraAccounts} extra account slot${extraAccounts === 1 ? '' : 's'}` : ''}.`,
    pricing_type: 'fixed_price',
    local_price: { amount: totalAmount.toFixed(2), currency: 'USD' },
    redirect_url: `${origin}/checkout/success?provider=crypto&plan=${planId}`,
    cancel_url: `${origin}/checkout?plan=${planId}&billing=${billing}&currency=USD&extra=${extraAccounts}&cancelled=1`,
    metadata: {
      user_id: userId,
      user_email: userEmail,
      plan_id: planId,
      billing,
      extra_accounts: String(extraAccounts),
      is_one_time: String(isOneTime),
    },
  };

  try {
    const ccRes = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': API_KEY,
        'X-CC-Version': '2018-03-22',
      },
      body: JSON.stringify(chargePayload),
    });
    const body = await ccRes.json();
    if (!ccRes.ok) {
      console.error('[billing/checkout:crypto] Coinbase error:', body);
      return res.status(502).json({ error: body?.error?.message || 'Coinbase charge creation failed' });
    }
    const charge = body?.data;
    await supabase.from('billing_orders').insert({
      id: charge.id,
      user_id: userId,
      plan_id: planId,
      billing_method: 'crypto_coinbase',
      currency: 'USD',
      amount_total: Math.round(totalAmount * 100),
      status: 'pending',
      external_id: charge.code,
      metadata: { billing, extra_accounts: extraAccounts, is_one_time: isOneTime },
    }).then(({ error }) => {
      if (error) console.warn('[billing/checkout:crypto] billing_orders insert failed:', error.message);
    });
    return res.status(200).json({
      hostedUrl: charge.hosted_url,
      chargeId: charge.id,
      chargeCode: charge.code,
    });
  } catch (err) {
    console.error('[billing/checkout:crypto] request failed:', err?.message);
    return res.status(500).json({ error: 'Coinbase request failed' });
  }
}
