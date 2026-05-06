import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Award, AlertCircle, Hash } from 'lucide-react';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { cn } from '@/lib/utils';
import { safeNumber } from '@/lib/safeNum';

function SummaryCard({ label, value, sub, icon: IconComp, positive }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 md:p-4 flex items-start gap-3">
      <div className={cn('p-1.5 rounded-lg flex-shrink-0', positive === true ? 'bg-emerald-500/10' : positive === false ? 'bg-red-500/10' : 'bg-primary/10')}>
        <IconComp className={cn('w-3.5 h-3.5', positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-primary')} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={cn('text-sm font-bold font-mono mt-0.5 tabular-nums', positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-foreground')}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

export default function RealizedSummaryCards({ summary }) {
  const { total_gains, total_losses, net_pnl, best_trade, worst_trade, avg_return_pct, position_count } = summary;

  const cards = [
    {
      label: 'Total Gains',
      value: formatCurrency(total_gains),
      icon: TrendingUp,
      positive: true,
    },
    {
      label: 'Total Losses',
      value: formatCurrency(Math.abs(total_losses)),
      icon: TrendingDown,
      positive: false,
    },
    {
      label: 'Net Realized P&L',
      value: (net_pnl >= 0 ? '+' : '') + formatCurrency(net_pnl),
      icon: DollarSign,
      positive: net_pnl >= 0,
    },
    {
      label: 'Avg Return %',
      value: (avg_return_pct >= 0 ? '+' : '') + safeNumber(avg_return_pct).toFixed(2) + '%',
      icon: BarChart2,
      positive: avg_return_pct >= 0,
    },
    {
      label: 'Best Trade',
      value: best_trade ? `+${formatCurrency(best_trade.realized_gain_loss_amount)}` : '—',
      sub: best_trade ? `${best_trade.ticker} (+${safeNumber(best_trade.realized_gain_loss_percent).toFixed(1)}%)` : null,
      icon: Award,
      positive: true,
    },
    {
      label: 'Worst Trade',
      value: worst_trade ? formatCurrency(worst_trade.realized_gain_loss_amount) : '—',
      sub: worst_trade ? `${worst_trade.ticker} (${safeNumber(worst_trade.realized_gain_loss_percent).toFixed(1)}%)` : null,
      icon: AlertCircle,
      positive: false,
    },
    {
      label: 'Closed Positions',
      value: position_count,
      icon: Hash,
      positive: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 md:gap-3">
      {cards.map((c, i) => <SummaryCard key={i} {...c} />)}
    </div>
  );
}