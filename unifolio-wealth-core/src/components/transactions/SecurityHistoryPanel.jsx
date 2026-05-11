import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, DollarSign, ArrowLeftRight, RefreshCw, Repeat } from 'lucide-react';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import InstitutionLogo from '@/components/shared/InstitutionLogo';
import { cn } from '@/lib/utils';
import usePersistentTableColumns from '@/hooks/usePersistentTableColumns';
import DraggableTableHeader, { TableColumnGrip } from '@/components/shared/DraggableTableHeader';

const TYPE_CFG = {
  buy:               { icon: ArrowDownLeft,  color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Buy' },
  sell:              { icon: ArrowUpRight,   color: 'text-red-400',     bg: 'bg-red-400/10',     label: 'Sell' },
  dividend:          { icon: DollarSign,     color: 'text-amber-400',   bg: 'bg-amber-400/10',   label: 'Dividend' },
  transfer:          { icon: ArrowLeftRight, color: 'text-purple-400',  bg: 'bg-purple-400/10',  label: 'Transfer' },
  transfer_in:       { icon: ArrowDownLeft,  color: 'text-purple-400',  bg: 'bg-purple-400/10',  label: 'Transfer In' },
  transfer_out:      { icon: ArrowUpRight,   color: 'text-purple-400',  bg: 'bg-purple-400/10',  label: 'Transfer Out' },
  position_transfer: { icon: ArrowLeftRight, color: 'text-cyan-400',    bg: 'bg-cyan-400/10',    label: 'Position Transfer' },
  currency_conversion: { icon: Repeat,       color: 'text-cyan-400',    bg: 'bg-cyan-400/10',    label: 'FX Conversion' },
};

function rowTint(type) {
  if (type === 'buy' || type === 'transfer_in') return 'bg-emerald-500/5';
  if (type === 'sell' || type === 'transfer_out') return 'bg-red-500/5';
  if (type === 'dividend') return 'bg-amber-500/5';
  if (type === 'transfer' || type === 'position_transfer') return 'bg-purple-500/5';
  return '';
}

export default function SecurityHistoryPanel({ ticker }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const { transactions, getAccount, getInstitutionForAccount } = usePortfolioData();
  const PM = '••••••';
  const [columnOrder, setColumnOrder] = usePersistentTableColumns('transactions_security_history_table', ['date', 'type', 'qty', 'price', 'total', 'running', 'account', 'institution']);

  const txs = useMemo(() => {
    if (!ticker) return [];
    const t = ticker.toUpperCase();
    return transactions
      .filter(tx => (tx.ticker || '').toUpperCase() === t)
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
      });
  }, [transactions, ticker]);

  const summary = useMemo(() => {
    let totalBought = 0, totalSold = 0, totalDividends = 0;
    txs.forEach(tx => {
      const qty = parseFloat(tx.qty ?? tx.quantity ?? 0) || 0;
      if (tx.type === 'buy' || tx.type === 'transfer_in') totalBought += qty;
      else if (tx.type === 'sell' || tx.type === 'transfer_out') totalSold += qty;
      else if (tx.type === 'dividend') totalDividends += parseFloat(tx.total ?? tx.total_amount ?? 0) || 0;
    });
    return { totalBought, totalSold, netHeld: totalBought - totalSold, totalDividends };
  }, [txs]);

  // Compute running position after each transaction
  const rows = useMemo(() => {
    let running = 0;
    return txs.map(tx => {
      const qty = parseFloat(tx.qty ?? tx.quantity ?? 0) || 0;
      if (tx.type === 'buy' || tx.type === 'transfer_in') running += qty;
      else if (tx.type === 'sell' || tx.type === 'transfer_out') running -= qty;
      return { ...tx, _runningQty: running };
    });
  }, [txs]);

  if (!ticker || txs.length === 0) {
    return (
      <div className="px-6 py-4 text-xs text-muted-foreground">
        No transaction history found for <span className="font-mono font-semibold text-foreground">{ticker}</span>.
      </div>
    );
  }

  return (
    <div className="bg-secondary/20 border-t border-border/40">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-b border-border/30 bg-card/30">
        <span className="font-mono text-xs font-bold text-primary">{ticker}</span>
        <span className="text-[11px] text-muted-foreground">
          Total bought: <span className="font-mono text-foreground">{summary.totalBought.toFixed(4)}</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          Total sold: <span className="font-mono text-foreground">{summary.totalSold.toFixed(4)}</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          Net held: <span className="font-mono text-foreground font-semibold">{summary.netHeld.toFixed(4)}</span>
        </span>
        {summary.totalDividends > 0 && (
          <span className="text-[11px] text-muted-foreground">
            Dividends: <span className="font-mono text-amber-400">
              {privacyMode ? PM : formatCurrency(convert(summary.totalDividends, 'USD'))}
            </span>
          </span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">{txs.length} transactions</span>
      </div>

      {/* Transaction table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <DraggableTableHeader
            columns={[
              { id: 'date', label: 'Date', headerClassName: 'px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70' },
              { id: 'type', label: 'Type', headerClassName: 'px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70' },
              { id: 'qty', label: 'Qty', headerClassName: 'px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70' },
              { id: 'price', label: 'Price', headerClassName: 'px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70' },
              { id: 'total', label: 'Total', headerClassName: 'px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70' },
              { id: 'running', label: 'Running', headerClassName: 'px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70' },
              { id: 'account', label: 'Account', headerClassName: 'px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70' },
              { id: 'institution', label: 'Institution', headerClassName: 'px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70' },
            ]}
            orderedColumnIds={columnOrder}
            onOrderChange={setColumnOrder}
            rowClassName="border-b border-border/30"
            renderCell={(column, dragHandleProps) => (
              <div className={cn('flex items-center gap-1.5', ['qty', 'price', 'total', 'running'].includes(column.id) ? 'justify-end' : 'justify-start')}>
                <TableColumnGrip dragHandleProps={dragHandleProps} />
                <span>{column.label}</span>
              </div>
            )}
          />
          <tbody>
            {rows.map((tx, idx) => {
              const cfg = TYPE_CFG[tx.type] ?? { icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-secondary', label: tx.type };
              const Icon = cfg.icon;
              const accountId = tx.account_id ?? tx.accountId;
              const acc = getAccount(accountId);
              const inst = getInstitutionForAccount(accountId);
              const qty = parseFloat(tx.qty ?? tx.quantity ?? 0) || 0;
              return (
                <tr key={tx.id ?? idx} className={cn('border-b border-border/20 hover:bg-secondary/30 transition-colors', rowTint(tx.type))}>
                  {columnOrder.map((columnId) => {
                    if (columnId === 'date') return <td key={`${tx.id}-date`} className="px-3 py-1.5 font-mono text-muted-foreground">{tx.date || '—'}</td>;
                    if (columnId === 'type') return (
                      <td key={`${tx.id}-type`} className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('p-0.5 rounded', cfg.bg)}><Icon className={cn('w-2.5 h-2.5', cfg.color)} /></div>
                          <span className={cn('font-medium', cfg.color)}>{cfg.label}</span>
                        </div>
                      </td>
                    );
                    if (columnId === 'qty') return <td key={`${tx.id}-qty`} className="px-3 py-1.5 text-right font-mono">{qty > 0 ? qty.toFixed(4) : '—'}</td>;
                    if (columnId === 'price') return <td key={`${tx.id}-price`} className="px-3 py-1.5 text-right font-mono">{privacyMode ? PM : (tx.price > 0 ? '$' + Number(tx.price).toFixed(2) : '—')}</td>;
                    if (columnId === 'total') return <td key={`${tx.id}-total`} className="px-3 py-1.5 text-right font-mono font-medium">{privacyMode ? PM : formatCurrency(convert(tx.total ?? tx.total_amount ?? 0, tx.currency || 'USD'))}</td>;
                    if (columnId === 'running') return <td key={`${tx.id}-running`} className={cn('px-3 py-1.5 text-right font-mono font-semibold', tx._runningQty >= 0 ? 'text-foreground' : 'text-red-400')}>{tx._runningQty.toFixed(4)}</td>;
                    if (columnId === 'account') return <td key={`${tx.id}-account`} className="px-3 py-1.5"><span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">{acc?.account_type ?? acc?.type ?? '—'}</span></td>;
                    if (columnId === 'institution') return <td key={`${tx.id}-institution`} className="px-3 py-1.5"><InstitutionLogo institution={inst} name={inst?.name} size="xs" /></td>;
                    return null;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
