import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { safeNumber } from '@/lib/safeNum';
import { cn } from '@/lib/utils';
import { usePortfolioData } from '@/lib/PortfolioDataContext';

const SORT_OPTIONS = [
  { id: 'realized_gain_loss_amount_desc', label: 'Biggest Gain' },
  { id: 'realized_gain_loss_amount_asc', label: 'Biggest Loss' },
  { id: 'realized_gain_loss_percent_desc', label: 'Highest Return %' },
  { id: 'close_date_desc', label: 'Most Recent Sale' },
  { id: 'holding_period_days_desc', label: 'Longest Held' },
];

function PnlCell({ value, pct }) {
  const n = safeNumber(value, null);
  if (n === null) return <td className="px-3 py-2.5 text-right text-muted-foreground/40 text-xs">—</td>;
  const isPos = n >= 0;
  return (
    <td className="px-3 py-2.5 text-right">
      <span className={cn('font-mono text-xs tabular-nums', isPos ? 'text-emerald-400' : 'text-red-400')}>
        {isPos ? '+' : ''}{formatCurrency(n)}
      </span>
      {pct !== undefined && (
        <div className={cn('text-[10px] font-mono tabular-nums', isPos ? 'text-emerald-400/70' : 'text-red-400/70')}>
          {isPos ? '+' : ''}{safeNumber(pct).toFixed(2)}%
        </div>
      )}
    </td>
  );
}

export default function RealizedPositionsTable({ positions, accountFilter, institutionFilter, assetClassFilter, currencyFilter }) {
  const [sortField, setSortField] = useState('close_date');
  const [sortDir, setSortDir] = useState('desc');
  const { getAccount, getInstitutionForAccount } = usePortfolioData();

  const filtered = useMemo(() => {
    return positions.filter(p => {
      const acc = getAccount(p.account_id);
      if (!acc) return true;
      const instId = acc.institution_id;
      if (accountFilter !== 'all' && (acc.account_type) !== accountFilter) return false;
      if (institutionFilter !== 'all' && instId !== institutionFilter) return false;
      if (assetClassFilter !== 'all' && p.asset_class !== assetClassFilter) return false;
      if (currencyFilter !== 'all' && p.currency !== currencyFilter) return false;
      return true;
    }).sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'ticker': aVal = a.ticker; bVal = b.ticker; break;
        case 'realized_gain_loss_amount': aVal = a.realized_gain_loss_amount; bVal = b.realized_gain_loss_amount; break;
        case 'realized_gain_loss_percent': aVal = a.realized_gain_loss_percent; bVal = b.realized_gain_loss_percent; break;
        case 'close_date': aVal = a.close_date; bVal = b.close_date; break;
        case 'holding_period_days': aVal = a.holding_period_days; bVal = b.holding_period_days; break;
        default: aVal = a.close_date; bVal = b.close_date;
      }
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [positions, accountFilter, institutionFilter, assetClassFilter, currencyFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortTh = ({ field, children, className }) => (
    <th
      className={cn('px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap', className)}
      onClick={() => handleSort(field)}
    >
      <div className={cn('flex items-center gap-1', className?.includes('text-right') && 'justify-end')}>
        {children}
        {sortField === field
          ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          : <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </div>
    </th>
  );

  if (filtered.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-muted-foreground text-sm">No realized positions found.</p>
        <p className="text-muted-foreground/60 text-xs mt-1">Realized positions will appear here once you fully sell a holding.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <SortTh field="ticker">Ticker</SortTh>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Company</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Account</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Institution</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Qty</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Avg Buy</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Avg Sell</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Cost Basis</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Sale Value</th>
              <SortTh field="realized_gain_loss_amount" className="text-right">Realized P&L</SortTh>
              <SortTh field="close_date" className="text-right">Sell Date</SortTh>
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Buy Date</th>
              <SortTh field="holding_period_days" className="text-right">Held</SortTh>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Asset Class</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Currency</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const acc = getAccount(p.account_id);
              const inst = getInstitutionForAccount(p.account_id);
              const isGain = p.realized_gain_loss_amount >= 0;

              return (
                <tr key={p.id} className={cn(
                  'border-b border-border/40 transition-colors',
                  i % 2 === 0 ? 'bg-card' : 'bg-secondary/5',
                  'opacity-75 hover:opacity-100'
                )}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-muted-foreground">{p.ticker}</span>
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded-full font-semibold',
                        isGain ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      )}>
                        {isGain ? 'GAIN' : 'LOSS'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[160px] truncate">{p.name}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{acc?.account_type}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{inst?.name}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs text-muted-foreground">{p.quantity}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs text-muted-foreground">${safeNumber(p.average_buy_price).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs text-muted-foreground">${safeNumber(p.average_sell_price).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs text-muted-foreground">{formatCurrency(p.total_cost_basis)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs text-muted-foreground">{formatCurrency(p.total_sale_value)}</td>
                  <PnlCell value={p.realized_gain_loss_amount} pct={p.realized_gain_loss_percent} />
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">{new Date(p.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">{new Date(p.open_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-muted-foreground font-mono">{p.holding_period_days}d</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.asset_class}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.currency}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
