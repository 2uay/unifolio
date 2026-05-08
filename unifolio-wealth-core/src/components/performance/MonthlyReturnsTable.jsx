import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { safeNumber, safeArray } from '@/lib/safeNum';
import { usePortfolioData } from '@/lib/PortfolioDataContext';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Derive monthly returns directly from portfolio snapshots.
 * Each month compares the last snapshot of the month vs. the last snapshot
 * of the prior month — never hardcoded values.
 */
function deriveMonthlyReturns(portfolioSnapshots) {
  // Build a map: "YYYY-MM" -> last snapshot value of that month
  const monthEndMap = {};
  safeArray(portfolioSnapshots).forEach(snap => {
    if (!snap?.date) return;
    const ym = snap.date.slice(0, 7);
    const v = safeNumber(snap.value, null);
    if (v !== null) monthEndMap[ym] = v;
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const years = [];
  for (let y = 2; y >= 0; y--) {
    const year = currentYear - y;
    const months = {};
    let yearStartValue = null;
    let yearEndValue = null;

    MONTHS.forEach((m, mi) => {
      // Skip future months
      if (year === currentYear && mi > currentMonth) {
        months[m] = null;
        return;
      }
      const ym    = `${year}-${String(mi + 1).padStart(2, '0')}`;
      const ymPrev = mi === 0
        ? `${year - 1}-12`
        : `${year}-${String(mi).padStart(2, '0')}`;

      const endVal   = safeNumber(monthEndMap[ym], null);
      const startVal = safeNumber(monthEndMap[ymPrev], null);

      if (endVal !== null && startVal !== null && startVal > 0) {
        months[m] = Math.round(((endVal - startVal) / startVal) * 1000) / 10;
        if (yearStartValue === null) yearStartValue = startVal;
        yearEndValue = endVal;
      } else {
        months[m] = null;
      }
    });

    const yearTotal = yearStartValue != null && yearEndValue != null && yearStartValue > 0
      ? Math.round(((yearEndValue - yearStartValue) / yearStartValue) * 1000) / 10
      : null;

    years.push({ year, months, yearTotal });
  }
  return years;
}

function ReturnCell({ value }) {
  if (value === null || value === undefined) {
    return <td className="px-2 py-2 text-center text-muted-foreground/30 text-xs">—</td>;
  }
  const isPos = value > 0.05;
  const isNeg = value < -0.05;
  return (
    <td className={cn(
      'px-2 py-2.5 text-center text-xs font-mono tabular-nums transition-colors cursor-default select-none',
      'border-r border-border/30',
      isPos && 'text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15',
      isNeg && 'text-red-400 bg-red-500/5 hover:bg-red-500/15',
      !isPos && !isNeg && 'text-muted-foreground hover:bg-secondary/50',
    )}>
      {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </td>
  );
}

export default function MonthlyReturnsTable() {
  const { portfolioSnapshots } = usePortfolioData();
  const data = useMemo(() => deriveMonthlyReturns(portfolioSnapshots), [portfolioSnapshots]);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Monthly Returns</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/40 border-b border-border">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-14 border-r border-border/50">Year</th>
              {MONTHS.map(m => (
                <th key={m} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/30 min-w-[52px]">{m}</th>
              ))}
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[64px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.year} className={cn('border-b border-border/30 hover:bg-secondary/20 transition-colors', i % 2 === 0 ? 'bg-card' : 'bg-secondary/10')}>
                <td className="px-4 py-2.5 text-xs font-semibold text-foreground border-r border-border/50 whitespace-nowrap">{row.year}</td>
                {MONTHS.map(m => <ReturnCell key={m} value={row.months[m]} />)}
                <td className={cn(
                  'px-3 py-2.5 text-center text-xs font-bold font-mono tabular-nums',
                  row.yearTotal == null ? 'text-muted-foreground/30' : row.yearTotal > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                )}>
                  {row.yearTotal == null ? '—' : `${row.yearTotal > 0 ? '+' : ''}${row.yearTotal.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
