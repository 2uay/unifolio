import React from 'react';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';
import usePersistentTableColumns from '@/hooks/usePersistentTableColumns';
import DraggableTableHeader, { TableColumnGrip } from '@/components/shared/DraggableTableHeader';

export default function PredictionMarketPositionsTable({ positions }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const [columnOrder, setColumnOrder] = usePersistentTableColumns('prediction_market_positions_table', ['platform', 'market', 'outcome', 'probability', 'avgPrice', 'currentPrice', 'positionValue', 'unrealized', 'realized', 'closes']);
  const PM = '••••••';

  const safePositions = Array.isArray(positions) ? positions.filter(Boolean) : [];
  const sortedPositions = [...safePositions].sort((a, b) => (b.unrealized_gain_loss || 0) - (a.unrealized_gain_loss || 0));

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <DraggableTableHeader
            columns={[
              { id: 'platform', label: 'Platform', headerClassName: 'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'market', label: 'Market', headerClassName: 'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'outcome', label: 'Outcome', headerClassName: 'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'probability', label: 'Probability', headerClassName: 'px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'avgPrice', label: 'Avg Price', headerClassName: 'px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'currentPrice', label: 'Current Price', headerClassName: 'px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'positionValue', label: 'Position Value', headerClassName: 'px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'unrealized', label: 'Unrealized P&L', headerClassName: 'px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'realized', label: 'Realized P&L', headerClassName: 'px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
              { id: 'closes', label: 'Closes', headerClassName: 'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider' },
            ]}
            orderedColumnIds={columnOrder}
            onOrderChange={setColumnOrder}
            rowClassName="border-b border-border/50 bg-secondary/30"
            renderCell={(column, dragHandleProps) => (
              <div className={cn('flex items-center gap-1.5', ['probability', 'avgPrice', 'currentPrice', 'positionValue', 'unrealized', 'realized'].includes(column.id) ? 'justify-end' : 'justify-start')}>
                <TableColumnGrip dragHandleProps={dragHandleProps} />
                <span>{column.label}</span>
              </div>
            )}
          />
          <tbody>
            {sortedPositions.map((position, i) => {
              const unrealizedPnL = position.unrealized_gain_loss || 0;
              const realizedPnL = position.realized_gain_loss || 0;
              const convertedValue = convert(position.current_market_value || 0, position.currency);
              const convertedUnrealized = convert(unrealizedPnL, position.currency);
              const convertedRealized = convert(realizedPnL, position.currency);

              return (
                <tr key={position.id} className={cn('border-b border-border/30 hover:bg-secondary/30 transition-colors', i % 2 === 1 && 'bg-secondary/10')}>
                  {columnOrder.map((columnId) => {
                    if (columnId === 'platform') return <td key={`${position.id}-platform`} className="px-4 py-3"><span className="text-xs font-semibold">{position.platform}</span></td>;
                    if (columnId === 'market') return <td key={`${position.id}-market`} className="px-4 py-3"><p className="text-xs font-medium text-foreground line-clamp-2">{position.market_title}</p></td>;
                    if (columnId === 'outcome') return <td key={`${position.id}-outcome`} className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{position.outcome}</span></td>;
                    if (columnId === 'probability') return <td key={`${position.id}-probability`} className="px-4 py-3 text-right"><span className="text-xs font-mono">{position.probability || '—'}%</span></td>;
                    if (columnId === 'avgPrice') return <td key={`${position.id}-avgPrice`} className="px-4 py-3 text-right"><span className="text-xs font-mono">{privacyMode ? PM : `$${(position.average_price || 0).toFixed(4)}`}</span></td>;
                    if (columnId === 'currentPrice') return <td key={`${position.id}-currentPrice`} className="px-4 py-3 text-right"><span className="text-xs font-mono">{privacyMode ? PM : `$${(position.current_price || 0).toFixed(4)}`}</span></td>;
                    if (columnId === 'positionValue') return <td key={`${position.id}-positionValue`} className="px-4 py-3 text-right"><span className="text-xs font-mono">{privacyMode ? PM : formatCurrency(convertedValue)}</span></td>;
                    if (columnId === 'unrealized') return <td key={`${position.id}-unrealized`} className="px-4 py-3 text-right"><PnlValue value={convertedUnrealized} className="text-xs" /></td>;
                    if (columnId === 'realized') return <td key={`${position.id}-realized`} className="px-4 py-3 text-right"><PnlValue value={convertedRealized} className="text-xs" /></td>;
                    if (columnId === 'closes') return <td key={`${position.id}-closes`} className="px-4 py-3 text-left"><span className="text-xs text-muted-foreground">{position.market_close_date ? new Date(position.market_close_date).toLocaleDateString() : '—'}</span></td>;
                    return null;
                  })}
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
