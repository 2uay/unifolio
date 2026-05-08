import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import AccountsDropdown from '@/components/breakdown/AccountsDropdown';
import { useCurrency } from '@/lib/CurrencyContext';
import { useTheme } from '@/lib/ThemeContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { CustomPieTooltip } from '@/lib/chartTooltip';
import { usePortfolioData } from '@/lib/PortfolioDataContext';

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
  const { convert, displayCurrency } = useCurrency();
  const { chartColors } = useTheme();
  const { privacyMode } = usePrivacy();
  const { holdings, accounts, getAccount, getInstitutionForAccount } = usePortfolioData();
  const [selectedAccounts, setSelectedAccounts] = useState(['__all__']);

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
  }, [selectedAccounts]);

  const buildAlloc = (keyFn) => {
    const activeHoldings = holdings.filter(h => h.quantity > 0 && activeAccountIds.includes(h.account_id ?? h.accountId));
    const map = {};
    activeHoldings.forEach(h => {
      const key = keyFn(h) || 'Unknown';
      const converted = convert(h.market_value ?? 0, h.currency || 'USD');
      map[key] = (map[key] || 0) + converted;
    });
    const groupTotal = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, pct: groupTotal > 0 ? (value / groupTotal) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  };

  const currencyExposureData = useMemo(() => {
    const activeHoldings = holdings.filter(h => h.quantity > 0 && activeAccountIds.includes(h.account_id ?? h.accountId));
    const map = {};
    activeHoldings.forEach(h => {
      const cur = h.currency || 'USD';
      map[cur] = (map[cur] || 0) + convert(h.market_value ?? 0, cur);
    });
    activeAccountIds.forEach(id => {
      const acc = accounts.find(a => a.id === id);
      if (!acc) return;
      const cur = acc.base_currency || 'CAD';
      map[cur] = (map[cur] || 0) + convert(acc.cash_balance ?? 0, cur);
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [activeAccountIds, convert]);

  const sectorData      = useMemo(() => buildAlloc(h => h.sector), [activeAccountIds, convert, displayCurrency]);
  const assetClassData  = useMemo(() => buildAlloc(h => h.asset_class ?? h.assetClass), [activeAccountIds, convert, displayCurrency]);
  const accountTypeData = useMemo(() => buildAlloc(h => { const acc = getAccount(h.account_id ?? h.accountId); return acc?.account_type ?? acc?.type; }), [activeAccountIds, convert, displayCurrency]);
  const institutionData = useMemo(() => buildAlloc(h => getInstitutionForAccount(h.account_id ?? h.accountId)?.name), [activeAccountIds, convert, displayCurrency]);
  const concentrationData = useMemo(() => buildAlloc(h => h.ticker), [activeAccountIds, convert, displayCurrency]);

  const hasNoAccounts = activeAccountIds.length === 0;
  const hasNoHoldings = !hasNoAccounts && holdings.filter(h => h.quantity > 0 && activeAccountIds.includes(h.account_id ?? h.accountId)).length === 0;

  return (
    <div className="space-y-4 pt-4 border-t border-border">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Breakdown</h2>
        <AccountsDropdown selectedAccounts={selectedAccounts} onToggle={toggleAccount} />
      </div>

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
          <AllocationChart data={sectorData} title="By Sector" colors={chartColors} privacyMode={privacyMode} />
          <AllocationChart data={assetClassData} title="By Asset Class" colors={chartColors} privacyMode={privacyMode} />
          <AllocationChart data={currencyExposureData} title="By Currency" colors={chartColors} privacyMode={privacyMode} />
          <AllocationChart data={accountTypeData} title="By Account Type" colors={chartColors} privacyMode={privacyMode} />
          <AllocationChart data={institutionData} title="By Institution" colors={chartColors} privacyMode={privacyMode} />
          <AllocationChart data={concentrationData} title="Holding Concentration" colors={chartColors} privacyMode={privacyMode} />
        </div>
      )}
    </div>
  );
}
