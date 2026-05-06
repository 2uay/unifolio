import React from 'react';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';

export default function PredictionMarketPositionsTable({ positions }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const PM = '••••••';

  const sortedPositions = [...positions].sort((a, b) => (b.unrealized_gain_loss || 0) - (a.unrealized_gain_loss || 0));

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/50 bg-secondary/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outcome</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Probability</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Price</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Price</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Position Value</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unrealized P&L</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Realized P&L</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Closes</th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((position, i) => {
              const unrealizedPnL = position.unrealized_gain_loss || 0;
              const realizedPnL = position.realized_gain_loss || 0;
              const convertedValue = convert(position.current_market_value || 0, position.currency);
              const convertedUnrealized = convert(unrealizedPnL, position.currency);
              const convertedRealized = convert(realizedPnL, position.currency);

              return (
                <tr key={position.id} className={cn('border-b border-border/30 hover:bg-secondary/30 transition-colors', i % 2 === 1 && 'bg-secondary/10')}>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold">{position.platform}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground line-clamp-2">{position.market_title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{position.outcome}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-mono">{position.probability || '—'}%</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-mono">{privacyMode ? PM : `$${(position.average_price || 0).toFixed(4)}`}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-mono">{privacyMode ? PM : `$${(position.current_price || 0).toFixed(4)}`}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-mono">{privacyMode ? PM : formatCurrency(convertedValue)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PnlValue value={convertedUnrealized} className="text-xs" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PnlValue value={convertedRealized} className="text-xs" />
                  </td>
                  <td className="px-4 py-3 text-left">
                    <span className="text-xs text-muted-foreground">{position.market_close_date ? new Date(position.market_close_date).toLocaleDateString() : '—'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2 divide-y divide-border/50">
        {sortedPositions.map((position) => {
          const unrealizedPnL = position.unrealized_gain_loss || 0;
          const convertedValue = convert(position.current_market_value || 0, position.currency);
          const convertedUnrealized = convert(unrealizedPnL, position.currency);

          return (
            <div key={position.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold">{position.platform}</p>
                  <p className="text-sm font-medium text-foreground line-clamp-2 mt-0.5">{position.market_title}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{position.outcome}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Probability</p>
                  <p className="font-mono font-semibold">{position.probability || '—'}%</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Current Price</p>
                  <p className="font-mono font-semibold">{privacyMode ? '••••' : `$${(position.current_price || 0).toFixed(4)}`}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Position Value</p>
                  <p className="font-mono font-semibold">{privacyMode ? PM : formatCurrency(convertedValue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Unrealized P&L</p>
                  <PnlValue value={convertedUnrealized} className="text-xs font-semibold" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}