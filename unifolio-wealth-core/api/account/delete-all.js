// Full account deletion endpoint.
//
// Fired AFTER the client-side delete_unifolio_user_data RPC has cleared the
// user's app-data tables. Completes the cascade by:
//   1. Looking up every plaid_item belonging to the user.
//   2. Calling Plaid's /item/remove for each (revoking the access token at
//      Plaid's end so the bank-side connection terminates).
//   3. Deleting the plaid_items rows from our database.
//   4. Calling Supabase Auth admin.deleteUser to permanently remove the
//      auth.users row so the user cannot sign back in to a "ghost" account.
//
// This endpoint requires a valid Bearer token from the user being deleted.
// Service-role credentials are loaded from Vercel environment variables and
// never reach the browser.

import { makePlaidClient, makeServiceSupabase, getAuthUser, cors } from '../plaid/_client.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = makeServiceSupabase();
  const plaid = makePlaidClient();
  const result = {
    plaidItemsRevoked: 0,
    plaidItemsDeleted: 0,
    plaidErrors: [],
    authUserDeleted: false,
  };

  // 1 + 2: Revoke every Plaid Item against Plaid's API.
  let items = [];
  try {
    const { data, error } = await supabase
      .from('plaid_items')
      .select('id, access_token, item_id')
      .eq('user_id', user.id);
    if (error) throw error;
    items = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[delete-all] plaid_items lookup failed:', err?.message || err);
    // Continue — auth.users delete is still worth attempting.
  }

  for (const item of items) {
    try {
      await plaid.itemRemove({ access_token: item.access_token });
      result.plaidItemsRevoked += 1;
      // Best-effort audit row per revocation. Failure does not block the
      // cascade; service-role insert directly into audit_log.
      await supabase.from('audit_log').insert({
        user_id: user.id,
        event_type: 'plaid_token_revoked',
        actor: 'system',
        metadata: { item_id: item.item_id, source: 'account_delete_cascade' },
      }).then(() => {}).catch(() => {});
    } catch (err) {
      // Plaid may return ITEM_NOT_FOUND if the item was already removed; treat
      // as a soft failure — we'll still delete the local row.
      const msg = err?.response?.data?.error_message || err?.message || String(err);
      result.plaidErrors.push({ item_id: item.item_id, error: msg });
      console.warn('[delete-all] item/remove failed for', item.item_id, '—', msg);
    }
  }

  // 3: Delete plaid_items rows from our DB regardless of revoke result.
  if (items.length > 0) {
    const { error: delErr } = await supabase
      .from('plaid_items')
      .delete()
      .eq('user_id', user.id);
    if (delErr) {
      console.error('[delete-all] plaid_items delete failed:', delErr?.message || delErr);
    } else {
      result.plaidItemsDeleted = items.length;
    }
  }

  // 4: Permanently delete the auth.users row. Requires service-role privileges.
  try {
    const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
    if (authErr) throw authErr;
    result.authUserDeleted = true;
  } catch (err) {
    console.error('[delete-all] auth.admin.deleteUser failed:', err?.message || err);
    return res.status(207).json({
      ...result,
      partial: true,
      error: 'Auth user deletion failed; please contact support@unifolio.ca for manual cleanup.',
    });
  }

  res.status(200).json(result);
}
