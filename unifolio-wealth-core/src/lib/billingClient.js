// @ts-nocheck
import { supabase } from '@/lib/supabaseClient';

// Thin client over the api/billing/* serverless endpoints. Each function:
//   - reads the current Supabase session and forwards the access token,
//   - posts the canonical billing payload (planId/billing/currency/extras),
//   - surfaces a structured `{ configured: false }` error so the UI can
//     downgrade gracefully when the env vars aren't set (i.e. before the
//     payment provider has been wired up on a given deployment).
//
// Every endpoint validates the input against the canonical TIERS table on
// the server, so even a tampered client payload can't buy a plan at the
// wrong price.

async function authedFetch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok) {
    const err = new Error(parsed?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.configured = parsed?.configured !== false; // default to "configured" unless server explicitly says otherwise
    if (parsed?.configured === false) err.configured = false;
    throw err;
  }
  return parsed || {};
}

// All three providers are served by the consolidated /api/billing/checkout
// dispatcher (routed via ?provider=). The split into three exports here is
// for clarity at the call sites — they each post the same payload shape.
export function createStripeCheckoutSession(payload) {
  return authedFetch('/api/billing/checkout?provider=stripe', payload);
}

export function createInteracOrder(payload) {
  return authedFetch('/api/billing/checkout?provider=interac', payload);
}

export function createCryptoCharge(payload) {
  return authedFetch('/api/billing/checkout?provider=crypto', payload);
}
