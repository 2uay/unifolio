import { createClient } from '@supabase/supabase-js';
import { validateBillingRequest, ACCOUNT_ADD_ON_USD } from './_helpers.js';

// POST /api/billing/crypto-checkout
// Body: { planId, billing, currency, extraAccounts }
// Auth: Supabase JWT
// Returns: { hostedUrl, chargeId } — Coinbase Commerce hosted checkout URL.
//
// Coinbase Commerce supports BTC, ETH, USDC, DAI, LTC, BCH, DOGE out of the
// box. Charges are priced in USD; the customer's wallet displays the
// equivalent in their preferred crypto. We then listen for the webhook
// (charge:confirmed) in webhook-crypto.js to upgrade the user's plan.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.COINBASE_COMMERCE_API_KEY;
  if (!API_KEY) {
    return res.status(503).json({
      error: 'Coinbase Commerce is not configured on this deployment',
      configured: false,
    });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing Authorization bearer token' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  let userId, userEmail;
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    userId = userData.user.id;
    userEmail = userData.user.email;
  } catch (err) {
    console.error('[billing/crypto] auth check failed:', err?.message);
    return res.status(500).json({ error: 'Auth verification failed' });
  }

  // Coinbase Commerce charges in USD (or EUR). Force USD even if the user
  // selected CAD elsewhere — the customer's wallet handles the conversion.
  const validation = validateBillingRequest({
    ...req.body,
    currency: 'USD',
  });
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const { tier, billing, extraAccounts, isOneTime } = validation;
  const baseUnit = tier.base.USD || 0;
  const annualMultiplier = billing === 'annual' ? 12 : 1;
  const baseAmount = baseUnit * annualMultiplier;
  const addOnAmount = extraAccounts * ACCOUNT_ADD_ON_USD * annualMultiplier;
  const totalAmount = baseAmount + addOnAmount;

  const origin = (req.headers.origin || `https://${req.headers.host || 'unifolio.ca'}`).replace(/\/$/, '');
  const planId = req.body.planId;

  // Coinbase Commerce only supports `pricing_type: 'fixed_price'` for
  // one-time charges. Crypto subscriptions don't exist natively — every
  // crypto charge is treated as a one-billing-period prepayment, and we'll
  // need to send the user a renewal link when the period expires (handled
  // by a Supabase cron job — out of scope for this commit).
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
      console.error('[billing/crypto] Coinbase Commerce error:', body);
      return res.status(502).json({ error: body?.error?.message || 'Coinbase charge creation failed' });
    }
    const charge = body?.data;
    // Persist pending order so the webhook can correlate later.
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
      if (error) console.warn('[billing/crypto] billing_orders insert failed:', error.message);
    });
    return res.status(200).json({
      hostedUrl: charge.hosted_url,
      chargeId: charge.id,
      chargeCode: charge.code,
    });
  } catch (err) {
    console.error('[billing/crypto] request failed:', err?.message);
    return res.status(500).json({ error: 'Coinbase request failed' });
  }
}
