import { makePlaidClient, makeServiceSupabase, getAuthUser, cors } from './_client.js';
import { loadPlanCapState, enforcePlanCap } from '../_lib/planCap.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { publicToken, institutionId, institutionName } = req.body || {};
  if (!publicToken) return res.status(400).json({ error: 'publicToken required' });

  const plaid = makePlaidClient();
  const supabase = makeServiceSupabase();

  // Server-side plan-cap hard enforcement. We pre-check against +1 here
  // (Plaid Items always represent at least one new account); the sync
  // step below re-checks the final account count after Plaid responds
  // and unwinds the Item if it would exceed the cap.
  const preCheck = await loadPlanCapState(supabase, user.id);
  const preReject = enforcePlanCap(preCheck, 1);
  if (preReject) return res.status(preReject.status).json(preReject.body);

  try {
    // Exchange public_token for access_token
    const { data: exchangeData } = await plaid.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = exchangeData;

    // Store in plaid_items (service key bypasses RLS; access_token never sent to client)
    const id = `plaid_${user.id}_${item_id}`;
    const { error: upsertError } = await supabase.from('plaid_items').upsert({
      id,
      user_id: user.id,
      item_id,
      access_token,
      institution_id: institutionId || null,
      institution_name: institutionName || null,
      status: 'active',
    });
    if (upsertError) throw new Error(`DB upsert failed: ${upsertError.message}`);

    // Trigger initial sync inline. syncItem returns the canonical account
    // IDs it created so we can rollback by exact id if the post-sync cap
    // check fails.
    const { createdAccountIds, createdInstitutionIds } = await syncItem({
      userId: user.id, itemId: item_id, accessToken: access_token, institutionName, supabase, plaid,
    });

    // Post-sync cap check. Plaid may return more accounts than the
    // user has cap room for (e.g. a single institution login that
    // exposes Chequing + Savings + TFSA + RRSP + Margin = 5 accounts
    // against a pro plan with 5 slots and 2 already used). When that
    // happens we unwind the Item entirely and return 402 — partial
    // imports are worse UX than "pay for the upgrade and retry."
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

    res.json({ itemId: item_id, success: true });
  } catch (err) {
    console.error('[Plaid exchange]', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error_message || err.message || 'Exchange failed' });
  }
}

// Rolls back a Plaid Item that was synced but would exceed the cap.
// Deletes by exact account IDs collected during sync (the normalizer
// stamps deterministic plaid_${userId}_${plaidAccountId} ids). We
// don't touch the institution row if the user had pre-existing
// accounts under that institution — but if this Item was the only
// reason it existed, we clean it up too.
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

async function syncItem({ userId, itemId, accessToken, institutionName, supabase, plaid }) {
  const { normalizePlaidData } = await import('../../src/lib/plaidNormalizer.js');

  const [holdingsRes, accountsRes] = await Promise.all([
    plaid.investmentsHoldingsGet({ access_token: accessToken }),
    plaid.accountsGet({ access_token: accessToken }),
  ]);

  // Fetch institution logo if possible
  let institutionLogo = null;
  try {
    const instRes = await plaid.institutionsGetById({
      institution_id: holdingsRes.data.item?.institution_id || '',
      country_codes: ['US', 'CA'],
      options: { include_optional_metadata: true },
    });
    institutionLogo = instRes.data.institution?.logo || null;
  } catch {
    // logo is optional
  }

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

  // Update last_synced_at + institution logo
  await supabase.from('plaid_items')
    .update({ last_synced_at: new Date().toISOString(), status: 'active', institution_logo: institutionLogo })
    .eq('item_id', itemId);

  return { createdAccountIds, createdInstitutionIds };
}
