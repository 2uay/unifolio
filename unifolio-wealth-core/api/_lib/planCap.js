// Server-side plan-cap enforcement. Mirrors src/hooks/usePlanCap.js but
// runs in the API runtime so we can hard-reject over-cap account creates
// at the network boundary — defense in depth on top of the UI banner.
//
// Tier table is duplicated here (mirrors planTiers.js + api/billing/_helpers.js)
// to keep the API runtime independent of the React bundle. Keep these
// three in sync when adjusting prices/caps.

const TIER_CAPS = {
  free:     2,
  pro:      5,
  pro_plus: 10,
  pro_max:  Infinity,
  lifetime: Infinity,
};

const TIER_ALLOWS_ADDON = {
  free:     false,
  pro:      true,
  pro_plus: true,
  pro_max:  true,
  lifetime: true,
};

/**
 * Returns { plan, baseCap, extraAccountsPaid, totalCap, currentCount,
 * remaining, atCap, overCap, isUnlimited } for a given user.
 *
 * Reads user_profiles for the authoritative plan + extra_accounts_paid.
 * If app_metadata.plan is set on the auth.users row, that wins — Supabase
 * lets admins set entitlements there atomically with billing webhooks.
 */
export async function loadPlanCapState(supabase, userId) {
  let plan = 'free';
  let extraAccountsPaid = 0;

  const { data: authUser } = await supabase.auth.admin.getUserById(userId).catch(() => ({ data: null }));
  const metaPlan = authUser?.user?.app_metadata?.plan;
  if (metaPlan && TIER_CAPS[metaPlan] !== undefined) plan = metaPlan;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan, extra_accounts_paid')
    .eq('user_id', userId)
    .maybeSingle();
  if (!metaPlan && profile?.plan && TIER_CAPS[profile.plan] !== undefined) plan = profile.plan;
  const raw = Number(profile?.extra_accounts_paid ?? 0);
  extraAccountsPaid = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  if (!TIER_ALLOWS_ADDON[plan]) extraAccountsPaid = 0;

  const { count: currentCount } = await supabase
    .from('accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const baseCap = TIER_CAPS[plan] ?? 2;
  const isUnlimited = baseCap === Infinity;
  const totalCap = isUnlimited ? Infinity : baseCap + extraAccountsPaid;
  const count = Math.max(0, Number(currentCount) || 0);
  const remaining = isUnlimited ? Infinity : Math.max(0, totalCap - count);

  return {
    plan,
    baseCap,
    extraAccountsPaid,
    totalCap,
    currentCount: count,
    remaining,
    atCap: !isUnlimited && count >= totalCap,
    overCap: !isUnlimited && count > totalCap,
    isUnlimited,
  };
}

/**
 * Returns the JSON response object an API handler should 402-reject with
 * when a request would push the user over their cap, OR null when the
 * request is within the cap. `newAccountCount` is the number of accounts
 * the request will try to create (default 1).
 */
export function enforcePlanCap(state, newAccountCount = 1) {
  if (state.isUnlimited) return null;
  const projected = state.currentCount + Math.max(1, Number(newAccountCount) || 1);
  if (projected <= state.totalCap) return null;
  return {
    status: 402,
    body: {
      error: 'plan_cap_exceeded',
      message: `Your ${state.plan} plan includes ${state.totalCap} account${state.totalCap === 1 ? '' : 's'}. This connection would bring you to ${projected}.`,
      plan: state.plan,
      currentCount: state.currentCount,
      totalCap: state.totalCap,
      requestedNew: Math.max(1, Number(newAccountCount) || 1),
      upgradeUrl: '/plans',
      addOnUrl: `/checkout?plan=${state.plan}&extra=${projected - state.totalCap}`,
    },
  };
}
