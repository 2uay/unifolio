// POST/DELETE /api/plaid/action?action=link|link-update|exchange|disconnect|sync
//
// Consolidated dispatcher for every authenticated Plaid call so we stay
// under the Vercel Hobby 12-function cap. Webhook (api/plaid/webhook.js)
// stays separate because Plaid POSTs to it externally and we don't want a
// `?action=` query param baked into the URL we register with Plaid.
//
// Routing:
//   ?action=link          → create link token (initial connect)
//   ?action=link-update   → create update-mode link token (existing item re-auth)
//   ?action=exchange      → exchange public_token, persist item, initial sync
//   ?action=disconnect    → revoke at Plaid + remove plaid_items row
//   ?action=sync          → re-sync an existing item
//
// Disconnect uses DELETE for backwards-compat with the prior endpoint
// signature; every other action is POST.

import { Products, CountryCodes } from 'plaid';
import { makePlaidClient, makeServiceSupabase, getAuthUser, cors } from './_client.js';
import { syncItem as syncItemCore } from './_sync-core.js';
import { loadPlanCapState, enforcePlanCap } from '../_lib/planCap.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = String(req.query?.action || '').toLowerCase();
  const allowed = ['link', 'link-update', 'exchange', 'disconnect', 'sync'];
  if (!allowed.includes(action)) {
    return res.status(400).json({ error: `Unknown action — use ?action=${allowed.join('|')}` });
  }

  // disconnect is DELETE for backwards-compat; everything else is POST.
  const expectedMethod = action === 'disconnect' ? 'DELETE' : 'POST';
  if (req.method !== expectedMethod) {
    res.setHeader('Allow', expectedMethod);
    return res.status(405).json({ error: `Method not allowed (use ${expectedMethod})` });
  }

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const plaid = makePlaidClient();
  const supabase = makeServiceSupabase();
  const ctx = { req, res, user, plaid, supabase };

  if (action === 'link') return handleLink(ctx);
  if (action === 'link-update') return handleLinkUpdate(ctx);
  if (action === 'exchange') return handleExchange(ctx);
  if (action === 'disconnect') return handleDisconnect(ctx);
  if (action === 'sync') return handleSync(ctx);
}

// ─── LINK (create) ─────────────────────────────────────────────
async function handleLink({ res, user, plaid }) {
  try {
    const webhookUrl = process.env.PLAID_WEBHOOK_URL || 'https://unifolio.ca/api/plaid/webhook';
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Unifolio',
      products: [Products.Investments],
      country_codes: [CountryCodes.Us, CountryCodes.Ca],
      language: 'en',
      webhook: webhookUrl,
    });
    return res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('[Plaid action:link]', err?.response?.data || err.message);
    return res.status(500).json({ error: err?.response?.data?.error_message || 'Failed to create link token' });
  }
}

// ─── LINK UPDATE (re-auth existing item) ───────────────────────
async function handleLinkUpdate({ req, res, user, plaid, supabase }) {
  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: 'itemId required' });

  try {
    const { data: item, error: fetchError } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single();
    if (fetchError || !item) return res.status(404).json({ error: 'Plaid item not found' });

    const webhookUrl = process.env.PLAID_WEBHOOK_URL || 'https://unifolio.ca/api/plaid/webhook';
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Unifolio',
      country_codes: [CountryCodes.Us, CountryCodes.Ca],
      language: 'en',
      access_token: item.access_token,
      webhook: webhookUrl,
    });
    return res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('[Plaid action:link-update]', err?.response?.data || err.message);
    return res.status(500).json({ error: err?.response?.data?.error_message || 'Failed to create update-mode link token' });
  }
}

// ─── EXCHANGE (public_token → access_token + initial sync) ─────
async function handleExchange({ req, res, user, plaid, supabase }) {
  const { publicToken, institutionId, institutionName } = req.body || {};
  if (!publicToken) return res.status(400).json({ error: 'publicToken required' });

  // Pre-sync plan-cap check (Plaid Item always == ≥1 account).
  const preCheck = await loadPlanCapState(supabase, user.id);
  const preReject = enforcePlanCap(preCheck, 1);
  if (preReject) return res.status(preReject.status).json(preReject.body);

  try {
    const { data: exchangeData } = await plaid.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = exchangeData;

    const id = `plaid_${user.id}_${item_id}`;
    const { error: upsertError } = await supabase.from('plaid_items').upsert({
      id, user_id: user.id, item_id, access_token,
      institution_id: institutionId || null,
      institution_name: institutionName || null,
      status: 'active',
    });
    if (upsertError) throw new Error(`DB upsert failed: ${upsertError.message}`);

    const { createdAccountIds, createdInstitutionIds } = await exchangeInitialSync({
      userId: user.id, itemId: item_id, accessToken: access_token, institutionName, supabase, plaid,
    });

    // Post-sync re-check; unwind if Plaid returned more accounts than cap.
    const postCheck = await loadPlanCapState(supabase, user.id);
    if (postCheck.overCap) {
      await unwindPlaidItem({
        supabase, userId: user.id, plaidItemRowId: id,
        accountIds: createdAccountIds, institutionIds: createdInstitutionIds,
      });
      return res.status(402).json({
        error: 'plan_cap_exceeded_post_sync',
        message: `Connecting this institution brought you to ${postCheck.currentCount} accounts on a plan that includes ${postCheck.totalCap}. The connection was rolled back — upgrade or add an extra-account slot and reconnect.`,
        plan: postCheck.plan,
        currentCount: postCheck.currentCount,
        totalCap: postCheck.totalCap,
        upgradeUrl: '/plans',
        addOnUrl: `/checkout?plan=${postCheck.plan}&extra=${postCheck.currentCount - postCheck.totalCap}`,
      });
    }

    return res.json({ itemId: item_id, success: true });
  } catch (err) {
    console.error('[Plaid action:exchange]', err?.response?.data || err.message);
    return res.status(500).json({ error: err?.response?.data?.error_message || err.message || 'Exchange failed' });
  }
}

async function unwindPlaidItem({ supabase, userId, plaidItemRowId, accountIds = [], institutionIds = [] }) {
  if (accountIds.length > 0) {
    await supabase.from('holdings').delete().eq('user_id', userId).in('account_id', accountIds);
    await supabase.from('transactions').delete().eq('user_id', userId).in('account_id', accountIds);
    await supabase.from('realized_positions').delete().eq('user_id', userId).in('account_id', accountIds);
    await supabase.from('accounts').delete().eq('user_id', userId).in('id', accountIds);
  }
  for (const instId of institutionIds) {
    const { count } = await supabase
      .from('accounts').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('institution_id', instId);
    if (!count) await supabase.from('institutions').delete().eq('user_id', userId).eq('id', instId);
  }
  await supabase.from('plaid_items').delete().eq('user_id', userId).eq('id', plaidItemRowId);
}

async function exchangeInitialSync({ userId, itemId, accessToken, institutionName, supabase, plaid }) {
  const { normalizePlaidData } = await import('../../src/lib/plaidNormalizer.js');

  const [holdingsRes, accountsRes] = await Promise.all([
    plaid.investmentsHoldingsGet({ access_token: accessToken }),
    plaid.accountsGet({ access_token: accessToken }),
  ]);

  let institutionLogo = null;
  try {
    const instRes = await plaid.institutionsGetById({
      institution_id: holdingsRes.data.item?.institution_id || '',
      country_codes: ['US', 'CA'],
      options: { include_optional_metadata: true },
    });
    institutionLogo = instRes.data.institution?.logo || null;
  } catch { /* logo is optional */ }

  const { institutions, accounts, holdings } = normalizePlaidData({
    userId,
    itemId,
    institutionId: holdingsRes.data.item?.institution_id || null,
    institutionName,
    institutionLogo,
    plaidAccounts: accountsRes.data.accounts,
    plaidHoldings: holdingsRes.data.holdings,
    plaidSecurities: holdingsRes.data.securities,
  });

  if (institutions.length) await supabase.from('institutions').upsert(institutions, { onConflict: 'id' });
  if (accounts.length) await supabase.from('accounts').upsert(accounts, { onConflict: 'id' });
  if (holdings.length) await supabase.from('holdings').upsert(holdings, { onConflict: 'id' });

  const createdAccountIds = accounts.map(a => a.id).filter(Boolean);
  const createdInstitutionIds = [...new Set(institutions.map(i => i.id).filter(Boolean))];

  await supabase.from('plaid_items')
    .update({ last_synced_at: new Date().toISOString(), status: 'active', institution_logo: institutionLogo })
    .eq('item_id', itemId);

  return { createdAccountIds, createdInstitutionIds };
}

// ─── DISCONNECT ────────────────────────────────────────────────
async function handleDisconnect({ req, res, user, plaid, supabase }) {
  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: 'itemId required' });

  try {
    const { data: item } = await supabase
      .from('plaid_items')
      .select('access_token, id')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single();
    if (!item) return res.status(404).json({ error: 'Plaid item not found' });

    try {
      await plaid.itemRemove({ access_token: item.access_token });
    } catch { /* already-removed at Plaid is fine, continue local cleanup */ }

    await supabase.from('plaid_items').delete().eq('id', item.id);
    return res.json({ disconnected: true });
  } catch (err) {
    console.error('[Plaid action:disconnect]', err?.response?.data || err.message);
    return res.status(500).json({ error: err?.response?.data?.error_message || err.message || 'Disconnect failed' });
  }
}

// ─── SYNC (re-sync existing item) ──────────────────────────────
async function handleSync({ req, res, user, plaid, supabase }) {
  const { itemId } = req.body || {};
  if (!itemId) return res.status(400).json({ error: 'itemId required' });

  try {
    const { data: item, error: fetchError } = await supabase
      .from('plaid_items')
      .select('access_token, institution_id, institution_name, institution_logo')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single();
    if (fetchError || !item) return res.status(404).json({ error: 'Plaid item not found' });

    const result = await syncItemCore({
      userId: user.id,
      itemId,
      accessToken: item.access_token,
      institutionId: item.institution_id,
      institutionName: item.institution_name,
      institutionLogo: item.institution_logo,
      plaid,
      supabase,
    });

    return res.json({ synced: true, ...result });
  } catch (err) {
    console.error('[Plaid action:sync]', err?.response?.data || err.message);
    return res.status(500).json({ error: err?.response?.data?.error_message || err.message || 'Sync failed' });
  }
}
