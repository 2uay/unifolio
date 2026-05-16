import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { validateBillingRequest, TIERS, ACCOUNT_ADD_ON_USD, ACCOUNT_ADD_ON_CAD } from './_helpers.js';

// POST /api/billing/etransfer-request
// Body: { planId, billing, currency, extraAccounts }
// Auth: Supabase JWT
// Returns: { orderId, securityQuestion, securityAnswer, instructions }
//
// Interac e-Transfer is Canadian-specific: the user logs into their own bank
// and sends money to the configured receiving email. We can't programmatically
// confirm the transfer, so we create a pending billing_orders row + email the
// user the exact security question/answer to use. Admin manually marks the
// row as paid via a Supabase dashboard update (or a tiny admin tool to be
// built later), which fires a trigger to upgrade the user's plan.
//
// The security question is the order ID prefix — admin uses the answer to
// match the inbound Interac transfer to the right user without ambiguity.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RECEIVING_EMAIL = process.env.INTERAC_ETRANSFER_EMAIL;
  if (!RECEIVING_EMAIL) {
    return res.status(503).json({
      error: 'Interac e-Transfer is not configured on this deployment',
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
    console.error('[billing/etransfer] auth check failed:', err?.message);
    return res.status(500).json({ error: 'Auth verification failed' });
  }

  const validation = validateBillingRequest({
    ...req.body,
    currency: 'CAD', // Interac is CAD-only; reject any other currency early
  });
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const { tier, billing, extraAccounts, isOneTime } = validation;
  const baseUnit = tier.base.CAD || 0;
  const addOnUnit = ACCOUNT_ADD_ON_CAD;
  const annualMultiplier = billing === 'annual' ? 12 : 1;
  const baseAmount = baseUnit * annualMultiplier;
  const addOnAmount = extraAccounts * addOnUnit * annualMultiplier;
  const totalAmount = baseAmount + addOnAmount;

  const orderId = randomUUID();
  const orderShortId = orderId.split('-')[0].toUpperCase();
  // Cryptographically-strong-ish security answer: 6 hex chars derived from
  // the order ID. The user types this into Interac as the security answer,
  // we match it on the inbound notification.
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
    console.error('[billing/etransfer] billing_orders insert failed:', insertErr.message);
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
      `(You’ll need to share the answer with your bank — keep this page open.)`,
      'Your plan activates within 24 hours of the transfer clearing. We email you a confirmation.',
    ],
  });
}
