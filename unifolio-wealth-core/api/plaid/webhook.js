// Plaid webhook receiver.
//
// Plaid POSTs to this endpoint when item / transaction / holding state
// changes — we don't need to poll. Common webhook_types we care about:
//   - INVESTMENTS_TRANSACTIONS / DEFAULT_UPDATE | HISTORICAL_UPDATE → re-sync
//   - HOLDINGS / DEFAULT_UPDATE → re-sync
//   - ITEM / ERROR → mark item login_required (or other error)
//   - ITEM / PENDING_EXPIRATION → mark item pending_expiration
//   - ITEM / WEBHOOK_UPDATE_ACKNOWLEDGED → no-op
//   - ITEM / USER_PERMISSION_REVOKED → mark item revoked
//
// SECURITY: Plaid signs every webhook body with a JWT in the
// `plaid-verification` header. We verify the signature using the verification
// key Plaid serves at /webhook_verification_key/get for the JWT's `kid`.
// Without verification anyone could POST fake events to mark items as
// errored. The JWT payload contains a SHA-256 of the raw request body, so
// Vercel's JSON body-parser is disabled here — we read the raw body, compute
// the hash, and only then parse JSON for routing.
//
// On any verified event we always return 200 quickly (Plaid retries non-2xx
// for up to 30 days, which would create noise). Sync work happens async via
// fire-and-forget — the response goes back before sync finishes.

import { createHash, createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { makePlaidClient, makeServiceSupabase } from './_client.js';
import { syncItem, markItemError } from './_sync-core.js';

// Vercel auto-parses JSON for POST by default; we need the raw body for hash
// verification. This config opts out of the parser.
export const config = {
  api: { bodyParser: false },
};

// Cache verification keys per `kid` for 24h to avoid hitting Plaid on every request.
const KEY_CACHE = new Map(); // kid -> { jwk, fetchedAt }
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function fetchVerificationKey(plaid, kid) {
  const cached = KEY_CACHE.get(kid);
  if (cached && (Date.now() - cached.fetchedAt) < KEY_TTL_MS) return cached.jwk;
  const res = await plaid.webhookVerificationKeyGet({ key_id: kid });
  const jwk = res.data.key;
  KEY_CACHE.set(kid, { jwk, fetchedAt: Date.now() });
  return jwk;
}

function jwkToPem(jwk) {
  return createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
}

async function verifyWebhook({ plaid, headerToken, rawBody }) {
  if (!headerToken) return { ok: false, reason: 'Missing plaid-verification header' };

  const decoded = jwt.decode(headerToken, { complete: true });
  if (!decoded?.header?.kid) return { ok: false, reason: 'Bad JWT header (no kid)' };

  let jwk;
  try {
    jwk = await fetchVerificationKey(plaid, decoded.header.kid);
  } catch (err) {
    return { ok: false, reason: `Could not fetch verification key: ${err?.message || err}` };
  }

  let payload;
  try {
    payload = jwt.verify(headerToken, jwkToPem(jwk), { algorithms: ['ES256'] });
  } catch (err) {
    return { ok: false, reason: `JWT verify failed: ${err?.message || err}` };
  }

  const bodyHash = createHash('sha256').update(rawBody).digest('hex');
  if (payload.request_body_sha256 !== bodyHash) {
    return { ok: false, reason: 'Body hash mismatch' };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const plaid = makePlaidClient();
  const supabase = makeServiceSupabase();

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.warn('[Plaid webhook] raw-body read failed:', err?.message || err);
    return res.status(200).json({ ignored: true });
  }

  // Verify signature first. Failed verification → log + 200 (avoid retry storm).
  const verification = await verifyWebhook({
    plaid,
    headerToken: req.headers['plaid-verification'],
    rawBody,
  }).catch((err) => ({ ok: false, reason: err?.message || String(err) }));

  if (!verification.ok) {
    console.warn('[Plaid webhook] verification failed:', verification.reason);
    return res.status(200).json({ ignored: true });
  }

  let body = {};
  try { body = JSON.parse(rawBody); } catch { /* will fall through */ }
  const { webhook_type, webhook_code, item_id, error } = body;

  // Look up the item to get user_id + access_token.
  const { data: item } = await supabase
    .from('plaid_items')
    .select('user_id, access_token, institution_id, institution_name, institution_logo')
    .eq('item_id', item_id)
    .single();

  if (!item) {
    console.warn('[Plaid webhook] unknown item_id:', item_id);
    return res.status(200).json({ ignored: true, reason: 'Unknown item' });
  }

  // Always log receipt (best-effort, fire-and-forget).
  supabase.from('audit_log').insert({
    user_id: item.user_id,
    event_type: 'plaid_webhook_received',
    actor: 'system',
    metadata: { webhook_type, webhook_code, item_id, error_code: error?.error_code || null },
  }).then(() => {}).catch(() => {});

  // ACK fast so Plaid doesn't retry.
  res.status(200).json({ acknowledged: true });

  // Fire-and-forget the actual work.
  (async () => {
    try {
      if (webhook_type === 'ITEM') {
        if (webhook_code === 'ERROR') {
          const code = error?.error_code || 'ITEM_ERROR';
          const status = code === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error';
          await markItemError({ supabase, itemId: item_id, errorCode: code, status });
          await supabase.from('audit_log').insert({
            user_id: item.user_id,
            event_type: 'plaid_item_error_state',
            actor: 'system',
            metadata: { item_id, error_code: code },
          });
        } else if (webhook_code === 'PENDING_EXPIRATION') {
          await markItemError({ supabase, itemId: item_id, errorCode: 'PENDING_EXPIRATION', status: 'pending_expiration' });
        } else if (webhook_code === 'USER_PERMISSION_REVOKED') {
          await markItemError({ supabase, itemId: item_id, errorCode: 'USER_PERMISSION_REVOKED', status: 'revoked' });
        }
        // WEBHOOK_UPDATE_ACKNOWLEDGED, NEW_ACCOUNTS_AVAILABLE → no-op for now
      } else if (webhook_type === 'HOLDINGS' || webhook_type === 'INVESTMENTS_TRANSACTIONS') {
        await syncItem({
          userId: item.user_id,
          itemId: item_id,
          accessToken: item.access_token,
          institutionId: item.institution_id,
          institutionName: item.institution_name,
          institutionLogo: item.institution_logo,
          plaid,
          supabase,
        });
      }
    } catch (err) {
      console.error('[Plaid webhook] async handler error:', err?.message || err);
    }
  })();
}
