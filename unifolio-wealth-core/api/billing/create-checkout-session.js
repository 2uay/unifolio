import { createClient } from '@supabase/supabase-js';
import { validateBillingRequest, buildStripeLineItems, stripeRequest } from './_helpers.js';

// POST /api/billing/create-checkout-session
// Body: { planId, billing, currency, extraAccounts }
// Auth: Supabase JWT in Authorization: Bearer <token>
// Returns: { url } — Stripe-hosted Checkout URL to redirect the user to.
//
// The endpoint NEVER trusts client-supplied price data. Pricing is recomputed
// from the canonical TIERS table in _helpers.js using the validated input.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'Stripe is not configured on this deployment',
      configured: false,
    });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });

  let userId, userEmail;
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    userId = userData.user.id;
    userEmail = userData.user.email;
  } catch (err) {
    console.error('[billing] auth check failed:', err?.message || err);
    return res.status(500).json({ error: 'Auth verification failed' });
  }

  const validation = validateBillingRequest(req.body || {});
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const { tier, currency, billing, extraAccounts, isOneTime } = validation;
  const planId = req.body.planId;
  const origin = (req.headers.origin || `https://${req.headers.host || 'unifolio.ca'}`).replace(/\/$/, '');

  const lineItems = buildStripeLineItems({ planId, tier, currency, billing, extraAccounts, isOneTime });

  const sessionPayload = {
    mode: isOneTime ? 'payment' : 'subscription',
    // payment_method_types enables card + Apple/Google Pay (via card),
    // ACSS Debit (Canadian pre-authorized bank debit). Stripe adds wallets
    // automatically once enabled in the Stripe Dashboard.
    payment_method_types: currency === 'CAD' ? ['card', 'acss_debit'] : ['card'],
    line_items: lineItems,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?plan=${planId}&billing=${billing}&currency=${currency}&extra=${extraAccounts}&cancelled=1`,
    customer_email: userEmail,
    client_reference_id: userId,
    metadata: {
      user_id: userId,
      plan_id: planId,
      billing,
      currency,
      extra_accounts: String(extraAccounts),
    },
    allow_promotion_codes: true,
  };

  if (!isOneTime) {
    sessionPayload.subscription_data = {
      metadata: { user_id: userId, plan_id: planId, billing, extra_accounts: String(extraAccounts) },
    };
  }

  if (currency === 'CAD') {
    // Required by Stripe for ACSS Debit. Phrase is shown on the checkout page
    // and on the customer's bank statement; keep it under 30 chars.
    sessionPayload.payment_method_options = {
      acss_debit: {
        mandate_options: {
          payment_schedule: isOneTime ? 'sporadic' : (billing === 'annual' ? 'interval' : 'interval'),
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
    console.error('[billing] Stripe checkout session creation failed:', err?.stripeBody || err?.message);
    return res.status(502).json({ error: err?.message || 'Stripe checkout creation failed' });
  }
}
