import { makePlaidClient, makeServiceSupabase, getAuthUser, cors } from './_client.js';

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

    // Trigger initial sync inline
    await syncItem({ userId: user.id, itemId: item_id, accessToken: access_token, institutionName, supabase, plaid });

    res.json({ itemId: item_id, success: true });
  } catch (err) {
    console.error('[Plaid exchange]', err?.response?.data || err.message);
    res.status(500).json({ error: err?.response?.data?.error_message || err.message || 'Exchange failed' });
  }
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

  // Update last_synced_at + institution logo
  await supabase.from('plaid_items')
    .update({ last_synced_at: new Date().toISOString(), status: 'active', institution_logo: institutionLogo })
    .eq('item_id', itemId);
}
