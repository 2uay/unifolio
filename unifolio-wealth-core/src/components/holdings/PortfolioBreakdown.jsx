import React, { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Settings2 } from 'lucide-react';
import AccountsDropdown from '@/components/breakdown/AccountsDropdown';
import ChartCustomizeModal from '@/components/holdings/ChartCustomizeModal';
import { Button } from '@/components/ui/button';
import { useCurrency } from '@/lib/CurrencyContext';
import { useTheme } from '@/lib/ThemeContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useAuth } from '@/lib/AuthContext';
import { CustomPieTooltip } from '@/lib/chartTooltip';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import {
  getPortfolioBreakdownPreferences,
  loadPortfolioBreakdownPreferences,
  savePortfolioBreakdownPreferences,
} from '@/lib/portfolioBreakdownPrefs';
import { safeNumber } from '@/lib/safeNum';
import { cn } from '@/lib/utils';

const DEFAULT_VISIBLE_CHART_IDS = ['sector', 'assetClass', 'currencyExposure', 'accountType', 'institution', 'holdingConcentration'];
const ALL_CHART_IDS = [
  'sector',
  'assetClass',
  'currencyExposure',
  'accountType',
  'institution',
  'holdingConcentration',
  'account',
  'country',
  'exchange',
  'registrationBucket',
  'institutionCountry',
  'cashVsInvested',
  'top5PlusOther',
  'top10PlusOther',
  'gainLossBuckets',
  'dailyMoverBuckets',
  'cadUsdOther',
  'stocksEtfsCashOther',
  'regionBucket',
  'accountSizeTier',
];

function toRows(map) {
  const total = Object.values(map).reduce((sum, value) => sum + value, 0);
  return Object.entries(map)
    .map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value);
}

function bucketize(value, buckets) {
  const bucket = buckets.find(entry => entry.match(value));
  return bucket?.label || 'Other';
}


function AllocationChart({ data, title, colors, privacyMode }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-center h-44">
        <p className="text-xs text-muted-foreground">No data for selected accounts</p>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={56} paddingAngle={2} dataKey="value">
                {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip content={(props) => <CustomPieTooltip {...props} privacyMode={privacyMode} total={total} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5 flex-1 min-w-0 max-h-32 overflow-y-auto">
          {data.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="truncate text-muted-foreground text-[11px]">{item.name || 'Unknown'}</span>
              </div>
              <span className="font-mono text-[11px] flex-shrink-0 tabular-nums">
                {(item.pct ?? (total > 0 ? (item.value / total) * 100 : 0)).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioBreakdown() {
  const { convert } = useCurrency();
  const { chartColors } = useTheme();
  const { privacyMode } = usePrivacy();
  const { user } = useAuth();
  const { holdings, accounts, getAccount, getInstitution, getInstitutionForAccount } = usePortfolioData();
  const [selectedAccounts, setSelectedAccounts] = useState(['__all__']);
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [prefs, setPrefs] = useState(() => getPortfolioBreakdownPreferences({
    orderedChartIds: ALL_CHART_IDS,
    visibleChartIds: DEFAULT_VISIBLE_CHART_IDS,
  }));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) return;
      const remote = await loadPortfolioBreakdownPreferences(user.id);
      if (cancelled || !remote) return;
      setPrefs(prev => ({
        orderedChartIds: Array.isArray(remote.orderedChartIds) && remote.orderedChartIds.length ? remote.orderedChartIds : prev.orderedChartIds,
        visibleChartIds: Array.isArray(remote.visibleChartIds) && remote.visibleChartIds.length ? remote.visibleChartIds : prev.visibleChartIds,
      }));
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const persistPrefs = (nextPrefs) => {
    setPrefs(nextPrefs);
    savePortfolioBreakdownPreferences(nextPrefs);
  };

  const toggleAccount = (val) => {
    if (val === '__all__') { setSelectedAccounts(['__all__']); return; }
    if (val === '__clear__') { setSelectedAccounts([]); return; }
    setSelectedAccounts(prev => {
      const next = prev.filter(x => x !== '__all__');
      if (next.includes(val)) {
        const result = next.filter(x => x !== val);
        return result.length === 0 ? ['__all__'] : result;
      }
      return [...next, val];
    });
  };

  const activeAccountIds = useMemo(() => {
    if (selectedAccounts.includes('__all__')) return accounts.map(a => a.id);
    return accounts.filter(acc => {
      const type = acc.account_type ?? acc.type;
      const instId = acc.institution_id ?? acc.institutionId;
      if (selectedAccounts.includes(acc.id)) return true;
      if (selectedAccounts.includes('inst_' + instId)) return true;
      if (selectedAccounts.includes('type_' + type)) return true;
      if (selectedAccounts.includes('reg') && ['TFSA', 'RRSP', 'FHSA'].includes(type)) return true;
      if (selectedAccounts.includes('unreg') && ['Cash', 'Margin', 'Crypto'].includes(type)) return true;
      return false;
    }).map(a => a.id);
  }, [selectedAccounts, accounts]);

  const activeHoldings = useMemo(() => holdings.filter(
    h => h.quantity > 0 && activeAccountIds.includes(h.account_id ?? h.accountId)
  ), [holdings, activeAccountIds]);

  const accountValueMap = useMemo(() => {
    const map = {};
    activeAccountIds.forEach((id) => {
      const account = accounts.find(acc => acc.id === id);
      if (!account) return;
      const nativeCurrency = account.base_currency || 'CAD';
      const holdingsValue = activeHoldings
        .filter(h => (h.account_id ?? h.accountId) === id)
        .reduce((sum, holding) => sum + convert(safeNumber(holding.market_value ?? holding.marketValue ?? 0), holding.currency || 'USD'), 0);
      map[id] = holdingsValue + convert(safeNumber(account.cash_balance ?? account.cashBalance ?? 0), nativeCurrency);
    });
    return map;
  }, [activeAccountIds, accounts, activeHoldings, convert]);

  const buildAlloc = (keyFn) => {
    const map = {};
    activeHoldings.forEach(h => {
      const key = keyFn(h) || 'Unknown';
      const converted = convert(h.market_value ?? h.marketValue ?? 0, h.currency || 'USD');
      map[key] = (map[key] || 0) + converted;
    });
    return toRows(map);
  };

  const chartDataById = useMemo(() => {
    const currencyExposure = (() => {
      const map = {};
      activeHoldings.forEach(h => {
        const cur = h.currency || 'USD';
        map[cur] = (map[cur] || 0) + convert(h.market_value ?? h.marketValue ?? 0, cur);
      });
      activeAccountIds.forEach(id => {
        const acc = accounts.find(a => a.id === id);
        if (!acc) return;
        const cur = acc.base_currency || 'CAD';
        map[cur] = (map[cur] || 0) + convert(acc.cash_balance ?? acc.cashBalance ?? 0, cur);
      });
      return toRows(map);
    })();

    const cashTotal = activeAccountIds.reduce((sum, id) => {
      const acc = accounts.find(a => a.id === id);
      return sum + (acc ? convert(acc.cash_balance ?? acc.cashBalance ?? 0, acc.base_currency || 'CAD') : 0);
    }, 0);

    const holdingsTotal = activeHoldings.reduce((sum, h) => (
      sum + convert(h.market_value ?? h.marketValue ?? 0, h.currency || 'USD')
    ), 0);

    const concentrationSorted = [...activeHoldings]
      .map(h => ({
        name: h.ticker,
        value: convert(h.market_value ?? h.marketValue ?? 0, h.currency || 'USD'),
      }))
      .sort((a, b) => b.value - a.value);

    const buildTopN = (n) => {
      const top = concentrationSorted.slice(0, n);
      const otherValue = concentrationSorted.slice(n).reduce((sum, row) => sum + row.value, 0);
      const rows = [...top];
      if (otherValue > 0) rows.push({ name: 'Other', value: otherValue });
      return toRows(rows.reduce((map, row) => ({ ...map, [row.name]: row.value }), {}));
    };

    const registrationMap = {};
    const institutionCountryMap = {};
    const accountMap = {};
    Object.entries(accountValueMap).forEach(([accountId, value]) => {
      const account = accounts.find(acc => acc.id === accountId);
      if (!account || value <= 0) return;
      const type = account.account_type ?? account.type ?? 'Account';
      const inst = getInstitution(account.institution_id ?? account.institutionId);
      const registrationBucket = ['TFSA', 'RRSP', 'FHSA'].includes(type)
        ? 'Registered'
        : ['Cash', 'Margin', 'Crypto'].includes(type)
          ? 'Non-Registered'
          : 'Other';
      registrationMap[registrationBucket] = (registrationMap[registrationBucket] || 0) + value;
      institutionCountryMap[inst?.country || 'Unknown'] = (institutionCountryMap[inst?.country || 'Unknown'] || 0) + value;
      accountMap[account.account_name || type] = (accountMap[account.account_name || type] || 0) + value;
    });

    const accountSizeTierMap = {};
    Object.entries(accountValueMap).forEach(([, value]) => {
      const bucket = bucketize(value, [
        { label: 'Under 10k', match: v => v < 10000 },
        { label: '10k - 50k', match: v => v >= 10000 && v < 50000 },
        { label: '50k - 100k', match: v => v >= 50000 && v < 100000 },
        { label: '100k+', match: v => v >= 100000 },
      ]);
      accountSizeTierMap[bucket] = (accountSizeTierMap[bucket] || 0) + value;
    });

    return {
      sector: buildAlloc(h => h.sector),
      assetClass: buildAlloc(h => h.asset_class ?? h.assetClass),
      currencyExposure,
      accountType: buildAlloc(h => {
        const acc = getAccount(h.account_id ?? h.accountId);
        return acc?.account_type ?? acc?.type;
      }),
      institution: buildAlloc(h => getInstitutionForAccount(h.account_id ?? h.accountId)?.name),
      holdingConcentration: buildAlloc(h => h.ticker),
      account: toRows(accountMap),
      country: buildAlloc(h => h.country),
      exchange: buildAlloc(h => h.exchange),
      registrationBucket: toRows(registrationMap),
      institutionCountry: toRows(institutionCountryMap),
      cashVsInvested: toRows({ Invested: holdingsTotal, Cash: cashTotal }),
      top5PlusOther: buildTopN(5),
      top10PlusOther: buildTopN(10),
      gainLossBuckets: buildAlloc(h => bucketize(safeNumber(h.unrealized_gain_loss_percent ?? h.unrealizedPct ?? 0), [
        { label: 'Loss > 10%', match: v => v < -10 },
        { label: 'Loss 0-10%', match: v => v >= -10 && v < 0 },
        { label: 'Gain 0-10%', match: v => v >= 0 && v < 10 },
        { label: 'Gain > 10%', match: v => v >= 10 },
      ])),
      dailyMoverBuckets: buildAlloc(h => bucketize(safeNumber(h.daily_pnl_percent ?? h.dailyPct ?? 0), [
        { label: 'Down > 2%', match: v => v < -2 },
        { label: 'Down 0-2%', match: v => v >= -2 && v < 0 },
        { label: 'Up 0-2%', match: v => v >= 0 && v < 2 },
        { label: 'Up > 2%', match: v => v >= 2 },
      ])),
      cadUsdOther: toRows(currencyExposure.reduce((map, row) => {
        const key = row.name === 'CAD' || row.name === 'USD' ? row.name : 'Other';
        map[key] = (map[key] || 0) + row.value;
        return map;
      }, {})),
      stocksEtfsCashOther: (() => {
        const map = { Cash: cashTotal };
        activeHoldings.forEach((h) => {
          const assetClass = h.asset_class ?? h.assetClass ?? 'Other';
          const key = assetClass === 'Stock' || assetClass === 'Equity'
            ? 'Stocks'
            : assetClass === 'ETF'
              ? 'ETFs'
              : 'Other';
          map[key] = (map[key] || 0) + convert(h.market_value ?? h.marketValue ?? 0, h.currency || 'USD');
        });
        return toRows(map);
      })(),
      regionBucket: buildAlloc(h => {
        const country = (h.country || '').toUpperCase();
        if (country === 'CANADA' || country === 'CA') return 'Canada';
        if (country === 'UNITED STATES' || country === 'US' || country === 'USA') return 'United States';
        return country ? 'International' : 'Unknown';
      }),
      accountSizeTier: toRows(accountSizeTierMap),
    };
  }, [activeHoldings, activeAccountIds, accounts, accountValueMap, convert, getAccount, getInstitution, getInstitutionForAccount]);

  const chartDefinitions = useMemo(() => ([
    { id: 'sector', title: 'By Sector' },
    { id: 'assetClass', title: 'By Asset Class' },
    { id: 'currencyExposure', title: 'By Currency' },
    { id: 'accountType', title: 'By Account Type' },
    { id: 'institution', title: 'By Institution' },
    { id: 'holdingConcentration', title: 'Holding Concentration' },
    { id: 'account', title: 'By Account' },
    { id: 'country', title: 'By Country' },
    { id: 'exchange', title: 'By Exchange' },
    { id: 'registrationBucket', title: 'Registered vs Non-Registered' },
    { id: 'institutionCountry', title: 'Institution Country' },
    { id: 'cashVsInvested', title: 'Cash vs Invested' },
    { id: 'top5PlusOther', title: 'Top 5 + Other' },
    { id: 'top10PlusOther', title: 'Top 10 + Other' },
    { id: 'gainLossBuckets', title: 'Unrealized Gain Buckets' },
    { id: 'dailyMoverBuckets', title: 'Daily Mover Buckets' },
    { id: 'cadUsdOther', title: 'CAD / USD / Other' },
    { id: 'stocksEtfsCashOther', title: 'Stocks / ETFs / Cash / Other' },
    { id: 'regionBucket', title: 'Canada / US / International' },
    { id: 'accountSizeTier', title: 'Account Size Tiers' },
  ]), []);

  const visibleChartDefs = prefs.orderedChartIds
    .filter(id => prefs.visibleChartIds.includes(id))
    .map(id => chartDefinitions.find(chart => chart.id === id))
    .filter(Boolean);

  const hasNoAccounts = activeAccountIds.length === 0;
  const hasNoHoldings = !hasNoAccounts && activeHoldings.length === 0;

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Breakdown</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setShowConfigurator(open => !open)}
            title="Choose and order breakdown charts"
          >
            <Settings2 className="w-4 h-4" />
          </Button>
        </div>
        <AccountsDropdown selectedAccounts={selectedAccounts} onToggle={toggleAccount} />
      </div>

      <ChartCustomizeModal
        open={showConfigurator}
        onClose={() => setShowConfigurator(false)}
        prefs={prefs}
        onSave={persistPrefs}
        chartDefinitions={chartDefinitions}
      />

      {hasNoAccounts && (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No accounts selected.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Use the Accounts dropdown to select accounts to include.</p>
        </div>
      )}

      {hasNoHoldings && (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No holdings available for this selection.</p>
        </div>
      )}

      {!hasNoAccounts && !hasNoHoldings && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleChartDefs.map((chart) => (
            <AllocationChart
              key={chart.id}
              data={chartDataById[chart.id] || []}
              title={chart.title}
              colors={chartColors}
              privacyMode={privacyMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
