// Shared billing helpers. Kept dependency-free so the serverless functions
// can ship without the `stripe` package — every Stripe call is just a POST
// to api.stripe.com with the secret key as Bearer auth.

import { createHmac, timingSafeEqual } from 'node:crypto';

// Plan tier table — MUST stay in sync with src/lib/planTiers.js. We
// intentionally redeclare it here (rather than import) because the
// serverless function is a different runtime entry point and we don't
// want to bundle React/Vite-only modules into the API runtime.
export const TIERS = {
  free:     { title: 'Free',     base: { USD: 0,  CAD: 0  }, accountCap: 2,        addOnAllowed: false },
  pro:      { title: 'Pro',      base: { USD: 9,  CAD: 12 }, accountCap: 5,        addOnAllowed: true  },
  pro_plus: { title: 'Pro Plus', base: { USD: 19, CAD: 25 }, accountCap: 10,       addOnAllowed: true  },
  pro_max:  { title: 'Pro Max',  base: { USD: 39, CAD: 49 }, accountCap: Infinity, addOnAllowed: true  },
  lifetime: { title: 'Lifetime', base: { USD: 499, CAD: 649 }, accountCap: Infinity, addOnAllowed: true, oneTime: true },
};

export const ACCOUNT_ADD_ON_USD = 3;
export const ACCOUNT_ADD_ON_CAD = 4;

export function validateBillingRequest({ planId, billing, currency, extraAccounts }) {
  const tier = TIERS[planId];
  if (!tier) return { ok: false, error: `Unknown plan: ${planId}` };
  if (planId === 'free') return { ok: false, error: 'Free plan does not require checkout' };
  const cur = (currency || 'USD').toUpperCase();
  if (cur !== 'USD' && cur !== 'CAD') return { ok: false, error: `Unsupported currency: ${cur}` };
  const isOneTime = !!tier.oneTime || billing === 'lifetime';
  const billMode = isOneTime ? 'lifetime' : (billing === 'monthly' ? 'monthly' : 'annual');
  const extras = Math.max(0, Math.min(50, Math.floor(Number(extraAccounts) || 0)));
  if (extras > 0 && !tier.addOnAllowed) {
    return { ok: false, error: `Plan ${planId} does not support extra-account add-ons` };
  }
  return { ok: true, tier, currency: cur, billing: billMode, extraAccounts: extras, isOneTime };
}

// Returns Stripe line_items for a Checkout session. We create prices inline
// (using `price_data`) instead of pre-creating Stripe Product/Price objects
// for every plan × billing × currency combination, which would 5 × 2 × 2 =
// 20 Price IDs to maintain. Inline pricing is simpler and the line items
// still attach cleanly to recurring subscriptions.
export function buildStripeLineItems({ planId, tier, currency, billing, extraAccounts, isOneTime }) {
  const baseUnit = tier.base[currency] || 0;
  const addOnUnit = currency === 'CAD' ? ACCOUNT_ADD_ON_CAD : ACCOUNT_ADD_ON_USD;
  const annualMultiplier = billing === 'annual' ? 12 : 1;
  const items = [];

  // Stripe wants integer amounts in the smallest currency unit (cents).
  const baseAmount = Math.round(baseUnit * 100 * annualMultiplier);
  const baseInterval = isOneTime ? null : (billing === 'annual' ? { interval: 'year' } : { interval: 'month' });
  const baseRecurring = baseInterval ? { recurring: baseInterval } : {};

  items.push({
    quantity: 1,
    price_data: {
      currency: currency.toLowerCase(),
      product_data: { name: `Unifolio ${tier.title}${isOneTime ? ' (Lifetime)' : ''}` },
      unit_amount: baseAmount,
      ...baseRecurring,
    },
  });

  if (extraAccounts > 0 && !isOneTime) {
    items.push({
      quantity: extraAccounts,
      price_data: {
        currency: currency.toLowerCase(),
        product_data: { name: `Extra account slot (Unifolio ${tier.title})` },
        unit_amount: Math.round(addOnUnit * 100 * annualMultiplier),
        recurring: baseInterval,
      },
    });
  }
  return items;
}

// Stripe REST POST with body as application/x-www-form-urlencoded. Lets us
// avoid the `stripe` package entirely. Flattens nested objects/arrays into
// the bracket notation Stripe expects (e.g. line_items[0][price_data][...]).
function flatten(obj, prefix = '') {
  const params = new URLSearchParams();
  const walk = (value, key) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${key}[${i}]`));
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => walk(v, `${key}[${k}]`));
    } else {
      params.append(key, String(value));
    }
  };
  Object.entries(obj).forEach(([k, v]) => walk(v, prefix ? `${prefix}[${k}]` : k));
  return params;
}

export async function stripeRequest(path, body, secretKey) {
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: flatten(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
  if (!res.ok) {
    const message = parsed?.error?.message || `Stripe ${res.status}`;
    const err = new Error(message);
    err.stripeStatus = res.status;
    err.stripeBody = parsed;
    throw err;
  }
  return parsed;
}

// Verifies a Stripe webhook signature using the t=... v1=... format documented
// at https://stripe.com/docs/webhooks/signatures. Tolerance defaults to 5
// minutes to allow modest clock skew. Throws on any failure so the caller
// can 400 the request.
export function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSec = 300) {
  if (!signatureHeader) throw new Error('Missing Stripe-Signature header');
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('=').map(s => s.trim())),
  );
  const timestamp = Number(parts.t);
  const sig = parts.v1;
  if (!timestamp || !sig) throw new Error('Malformed Stripe-Signature header');
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) {
    throw new Error('Stripe webhook timestamp outside tolerance');
  }
  const payload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Stripe signature mismatch');
  }
}

// Coinbase Commerce uses a simpler signature: HMAC-SHA256 of the raw body
// keyed by the shared secret, sent as the `X-CC-Webhook-Signature` header.
export function verifyCoinbaseSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) throw new Error('Missing X-CC-Webhook-Signature header');
  if (!secret) throw new Error('COINBASE_COMMERCE_WEBHOOK_SECRET is not configured');
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signatureHeader, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Coinbase signature mismatch');
  }
}

// Reads the raw request body for webhook signature verification. Vercel
// parses JSON by default which breaks signatures, so we read the stream
// manually. Caller's vercel.json (or per-file config export) must disable
// the default body parser.
export async function readRawBody(req) {
  if (req.body && Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  // Stream fallback
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Maps a Stripe Checkout session (or subscription) back to our internal
// planId. We attach the planId as session.metadata.plan_id at create time,
// so this is just a read — but the fallback by line-item product name keeps
// us robust if someone edits a subscription in the Stripe dashboard.
export function planFromMetadata(meta = {}) {
  const p = meta.plan_id || meta.planId;
  return TIERS[p] ? p : null;
}
