// @ts-nocheck
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getTier, ACCOUNT_ADD_ON } from '@/lib/planTiers';
import { useCurrency } from '@/lib/CurrencyContext';

// `extra_accounts_paid` lives on user_profiles (added as part of the plan-cap
// enforcement work). Older profile rows may not have it yet; we coerce missing
// values to 0 so the cap behaves like the plan's base cap until the user
// purchases extras.
export default function usePlanCap(accountCount = 0) {
  const { user, plan } = useAuth();
  const { displayCurrency } = useCurrency();

  const { data: extraAccountsPaid = 0 } = useQuery({
    queryKey: ['extraAccountsPaid', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('extra_accounts_paid')
        .eq('user_id', user.id)
        .maybeSingle();
      const raw = Number(data?.extra_accounts_paid ?? 0);
      return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    },
  });

  return useMemo(() => {
    const tier = getTier(plan);
    const baseCap = Number.isFinite(tier?.accountCap) ? tier.accountCap : Infinity;
    const totalCap = baseCap === Infinity ? Infinity : baseCap + extraAccountsPaid;
    const count = Math.max(0, Number(accountCount) || 0);
    const isUnlimited = totalCap === Infinity;
    const remaining = isUnlimited ? Infinity : Math.max(0, totalCap - count);
    const atCap = !isUnlimited && count >= totalCap;
    const overCap = !isUnlimited && count > totalCap;
    const addOnUnitPrice = tier?.addOnAllowed
      ? (ACCOUNT_ADD_ON[displayCurrency] ?? ACCOUNT_ADD_ON.USD)
      : 0;
    return {
      tier,
      plan,
      baseCap,
      extraAccountsPaid,
      totalCap,
      count,
      remaining,
      atCap,
      overCap,
      isUnlimited,
      addOnAllowed: !!tier?.addOnAllowed,
      addOnUnitPrice,
      addOnCurrency: displayCurrency,
    };
  }, [plan, extraAccountsPaid, accountCount, displayCurrency]);
}
