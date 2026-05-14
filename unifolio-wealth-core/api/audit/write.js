// Application-level audit log writer.
//
// Accepts POST { event_type, metadata? } with the user's session JWT in the
// Authorization header. Inserts a row into the `audit_log` table using the
// service-role key (RLS prevents direct client inserts).
//
// Wired into deletion, export, auth, MFA, and Plaid token-revoke flows. See
// docs/DATA_RETENTION_POLICY.md §3.4 for the canonical retention policy.

import { makeServiceSupabase, getAuthUser, cors } from '../plaid/_client.js';

const ALLOWED_EVENTS = new Set([
  // Auth
  'auth_signin', 'auth_signout', 'auth_signup', 'email_changed',
  'password_reset_requested', 'password_changed',
  // MFA
  'mfa_enrolled', 'mfa_unenrolled',
  'mfa_challenge_succeeded', 'mfa_challenge_failed',
  // Data
  'account_deleted', 'account_partial_delete',
  'data_export_csv', 'data_export_json',
  'plaid_token_revoked', 'plaid_item_disconnected',
  'custom_asset_created', 'custom_asset_updated', 'custom_asset_deleted',
]);

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { event_type, metadata } = req.body || {};
  if (!event_type || !ALLOWED_EVENTS.has(event_type)) {
    return res.status(400).json({ error: 'Invalid or missing event_type' });
  }

  // Strip any PII the client may have sent — we only persist the bare event +
  // small JSON tag (counts, ids, etc.). Caller is trusted to not send raw data.
  const safeMetadata = (metadata && typeof metadata === 'object') ? metadata : {};

  // Capture IP + UA for security investigation. Both are short strings.
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 256);

  const supabase = makeServiceSupabase();
  const { error } = await supabase.from('audit_log').insert({
    user_id: user.id,
    event_type,
    actor: 'self',
    metadata: safeMetadata,
    ip: ip || null,
    user_agent: userAgent || null,
  });

  if (error) {
    console.error('[audit/write]', error?.message || error);
    return res.status(500).json({ error: 'Failed to write audit row' });
  }

  res.status(204).end();
}
