import React from 'react';
import { DollarSign, Layers, Minus, Hash } from 'lucide-react';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { cn } from '@/lib/utils';

export default function NetValueSummary({ investmentTotal, customAssetsGross, customAssetsLiability, customAssetsNet, customAssetsCount }) {
  const { privacyMode } = usePrivacy();
  const PM = '••••••';

  const netValue = investmentTotal + customAssetsNet;

  const cards = [
    {
      label: 'Net Value',
      value: netValue,
      sub: 'Investments + assets − liabilities',
      highlight: true,
      color: netValue >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
    {
      label: 'Investment Accounts',
      value: investmentTotal,
      sub: 'Connected brokerage value',
      icon: DollarSign,
    },
    {
      label: 'Custom Assets',
      value: customAssetsGross,
      sub: 'Gross estimated value',
      icon: Layers,
    },
    {
      label: 'Liabilities',
      value: -customAssetsLiability,
      sub: 'Debt on custom assets',
      icon: Minus,
      color: customAssetsLiability > 0 ? 'text-red-400' : undefined,
      prefix: customAssetsLiability > 0 ? '−' : '',
      rawValue: customAssetsLiability,
    },
    {
      label: 'Custom Assets',
      value: customAssetsCount,
      sub: 'Manually tracked assets',
      icon: Hash,
      isCurrency: false,
    },
  ];

  return (
    <div className="bg-card/60 rounded-2xl border border-primary/20 p-4 md:p-5 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Value Overview</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c, i) => (
          <div key={i} className={cn(
            'rounded-xl border p-3 md:p-4',
            c.highlight
              ? 'bg-primary/5 border-primary/30 col-span-2 sm:col-span-1'
              : 'bg-card border-border'
          )}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{c.label}</p>
            {c.isCurrency === false ? (
              <p className="text-xl font-bold font-mono mt-1">{c.value}</p>
            ) : (
              <p className={cn('text-xl font-bold font-mono mt-1 tabular-nums', c.color)}>
                {privacyMode ? PM : (
                  c.prefix
                    ? `${c.prefix}${formatCurrency(c.rawValue)}`
                    : formatCurrency(Math.abs(c.value))
                )}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}