import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, DollarSign, RefreshCw, ArrowLeftRight, Receipt, Repeat, FileText, Pencil, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import PageHeader from '@/components/shared/PageHeader';
import TaxExportModal from '@/components/transactions/TaxExportModal';
import { cn } from '@/lib/utils';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import InstitutionLogo from '@/components/shared/InstitutionLogo';
import SecurityHistoryPanel from '@/components/transactions/SecurityHistoryPanel';
import TransactionAIAssistant from '@/components/transactions/TransactionAIAssistant';
import usePersistentTableColumns from '@/hooks/usePersistentTableColumns';
import DraggableTableHeader, { TableColumnGrip } from '@/components/shared/DraggableTableHeader';
import { safeNumber } from '@/lib/safeNum';

const TABLE_ID = 'transactions_main';

const typeConfig = {
  buy: { icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Buy' },
  sell: { icon: ArrowUpRight, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Sell' },
  dividend: { icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Dividend' },
  deposit: { icon: ArrowDownLeft, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Deposit' },
  withdrawal: { icon: ArrowUpRight, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Withdrawal' },
  transfer: { icon: ArrowLeftRight, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Transfer' },
  transfer_in: { icon: ArrowDownLeft, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Transfer In' },
  transfer_out: { icon: ArrowUpRight, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Transfer Out' },
  position_transfer: { icon: ArrowLeftRight, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Position Transfer' },
  fee: { icon: Receipt, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Fee' },
  currency_conversion: { icon: Repeat, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'FX Conversion' },
};

const DEFAULT_COLUMNS = ['date', 'type', 'ticker', 'security', 'status', 'quantity', 'price', 'total', 'fees', 'account', 'institution', 'edit'];

const COLUMN_DEFS = [
  { id: 'date', label: 'Date', align: 'left' },
  { id: 'type', label: 'Type', align: 'left' },
  { id: 'ticker', label: 'Ticker', align: 'left' },
  { id: 'security', label: 'Security', align: 'left' },
  { id: 'status', label: 'Status', align: 'left' },
  { id: 'quantity', label: 'Qty', align: 'right' },
  { id: 'price', label: 'Price', align: 'right' },
  { id: 'total', label: 'Total', align: 'right' },
  { id: 'fees', label: 'Fees', align: 'right' },
  { id: 'account', label: 'Account', align: 'left' },
  { id: 'institution', label: 'Institution', align: 'left' },
  { id: 'edit', label: 'Edit', align: 'right' },
];

function transferContextText(t) {
  if (!['transfer', 'transfer_in', 'transfer_out', 'position_transfer', 'deposit', 'withdrawal'].includes(t.type)) return '';
  const ctx = t.transfer_context || t.transferContext || {};
  const source = t.source_account_id || ctx.sourceAccount || '';
  const destination = t.destination_account_id || ctx.destinationAccount || '';
  if (!source && !destination) return '';
  return `${source || 'Unknown'} → ${destination || 'Unknown'}`;
}

function statusTone(status) {
  if (status === 'Realized Gain') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'Realized Loss') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (status === 'Closed Position') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-secondary text-muted-foreground border-border/50';
}

export default function Transactions() {
  const [showExport, setShowExport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [filterColumn, setFilterColumn] = useState('type');
  const [filterValue, setFilterValue] = useState('all');
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const { transactions, accounts, realizedPositions, getAccount, getInstitutionForAccount, isEmptyPortfolio, updateTransferTransaction } = usePortfolioData();
  const [visibleColumns, setVisibleColumns] = usePersistentTableColumns(TABLE_ID, DEFAULT_COLUMNS);
  const PM = '••••••';

  const editableTransferTypes = new Set(['transfer', 'transfer_in', 'transfer_out', 'position_transfer', 'deposit', 'withdrawal']);

  const enrichedTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id).localeCompare(String(b.id)));
    const running = new Map();
    const realizedByCloseKey = new Map();

    realizedPositions.forEach((position) => {
      const key = `${position.account_id ?? position.accountId}:${(position.security_key || position.securityKey || position.ticker || '').toUpperCase()}:${position.close_date || ''}`;
      if (!realizedByCloseKey.has(key)) realizedByCloseKey.set(key, []);
      realizedByCloseKey.get(key).push(position);
    });

    return sorted.map((tx) => {
      const accountId = tx.account_id ?? tx.accountId;
      const security = (tx.security_key || tx.securityKey || tx.ticker || '').toUpperCase();
      const positionKey = `${accountId}:${security}`;
      const currentQty = running.get(positionKey) || 0;
      const qty = safeNumber(tx.qty ?? tx.quantity);
      let nextQty = currentQty;
      if (['buy', 'transfer_in'].includes(tx.type)) nextQty += qty;
      if (['sell', 'transfer_out'].includes(tx.type)) nextQty -= qty;
      running.set(positionKey, nextQty);

      const closedPosition = ['sell', 'transfer_out'].includes(tx.type) && currentQty > 0 && nextQty <= 0;
      const closeMatchKey = `${accountId}:${security}:${tx.date || ''}`;
      const realizedMatch = realizedByCloseKey.get(closeMatchKey)?.[0] || null;

      const status = realizedMatch
        ? realizedMatch.realized_gain_loss_amount >= 0
          ? 'Realized Gain'
          : 'Realized Loss'
        : closedPosition
          ? 'Closed Position'
          : 'Open / Other';

      return {
        ...tx,
        accountId,
        securityName: tx.name || tx.asset_name || tx.assetName || tx.ticker || 'Unknown Security',
        closedPosition,
        realizedMatch,
        status,
        transferText: transferContextText(tx),
      };
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id)));
  }, [transactions, realizedPositions]);

  const filterOptions = useMemo(() => {
    const values = {
      type: ['all', ...Object.keys(typeConfig)],
      account: ['all', ...new Set(enrichedTransactions.map(tx => getAccount(tx.accountId)?.account_type ?? getAccount(tx.accountId)?.type).filter(Boolean))],
      institution: ['all', ...new Set(enrichedTransactions.map(tx => getInstitutionForAccount(tx.accountId)?.name).filter(Boolean))],
      currency: ['all', ...new Set(enrichedTransactions.map(tx => tx.currency).filter(Boolean))],
      ticker: ['all', ...new Set(enrichedTransactions.map(tx => tx.ticker).filter(Boolean))],
      status: ['all', 'Realized Gain', 'Realized Loss', 'Closed Position', 'Open / Other'],
    };
    return values[filterColumn] || ['all'];
  }, [enrichedTransactions, filterColumn, getAccount, getInstitutionForAccount]);

  const filtered = useMemo(() => {
    if (filterValue === 'all') return enrichedTransactions;
    return enrichedTransactions.filter((tx) => {
      if (filterColumn === 'type') return tx.type === filterValue;
      if (filterColumn === 'account') return (getAccount(tx.accountId)?.account_type ?? getAccount(tx.accountId)?.type) === filterValue;
      if (filterColumn === 'institution') return getInstitutionForAccount(tx.accountId)?.name === filterValue;
      if (filterColumn === 'currency') return tx.currency === filterValue;
      if (filterColumn === 'ticker') return tx.ticker === filterValue;
      if (filterColumn === 'status') return tx.status === filterValue;
      return true;
    });
  }, [enrichedTransactions, filterValue, filterColumn, getAccount, getInstitutionForAccount]);

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditDraft({
      source_account_id: t.source_account_id || t.transfer_context?.sourceAccount || '',
      destination_account_id: t.destination_account_id || t.transfer_context?.destinationAccount || '',
      notes: t.notes || '',
    });
  };

  const saveEdit = async (t) => {
    setSavingEdit(true);
    try {
      await updateTransferTransaction(t.id, {
        ...editDraft,
        transfer_context: {
          ...(t.transfer_context || t.transferContext || {}),
          sourceAccount: editDraft.source_account_id || '',
          destinationAccount: editDraft.destination_account_id || '',
          notes: editDraft.notes || '',
          editedManually: true,
        },
      });
      setEditingId(null);
      setEditDraft({});
    } finally {
      setSavingEdit(false);
    }
  };

  const renderCell = (tx, columnId) => {
    const cfg = typeConfig[tx.type] ?? { icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-secondary', label: tx.type || 'Other' };
    const account = getAccount(tx.accountId);
    const institution = getInstitutionForAccount(tx.accountId);
    const Icon = cfg.icon;
    const isEditing = editingId === tx.id;
    const canEdit = editableTransferTypes.has(tx.type);

    switch (columnId) {
      case 'date':
        return <span className="font-mono text-xs text-muted-foreground">{tx.date}</span>;
      case 'type':
        return (
          <div className="flex items-center gap-2">
            <div className={cn('p-1 rounded', cfg.bg)}><Icon className={cn('w-3 h-3', cfg.color)} /></div>
            <div>
              <span className="text-xs font-medium">{cfg.label}</span>
              {tx.transferText && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{tx.transferText}</p>}
            </div>
          </div>
        );
      case 'ticker':
        return <span className="font-mono font-semibold">{tx.ticker || '—'}</span>;
      case 'security':
        return (
          <div>
            <p className="text-xs font-medium">{tx.securityName}</p>
            <p className="text-[10px] text-muted-foreground/70">{tx.realizedMatch?.open_date ? `Opened ${tx.realizedMatch.open_date}` : 'Trade details available below'}</p>
          </div>
        );
      case 'status':
        return (
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', statusTone(tx.status))}>
            {tx.status}
          </span>
        );
      case 'quantity':
        return <span className="font-mono">{tx.qty || tx.quantity || '—'}</span>;
      case 'price':
        return <span className="font-mono">{privacyMode ? PM : (tx.price > 0 ? `$${Number(tx.price).toFixed(2)}` : '—')}</span>;
      case 'total':
        return <span className="font-mono font-medium">{privacyMode ? PM : formatCurrency(convert(tx.total ?? tx.total_amount ?? 0, tx.currency || 'USD'))}</span>;
      case 'fees':
        return <span className="font-mono text-muted-foreground">{privacyMode ? PM : (tx.fees > 0 ? formatCurrency(convert(tx.fees, tx.currency || 'USD')) : '—')}</span>;
      case 'account':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{account?.account_type ?? account?.type}</span>;
      case 'institution':
        return <InstitutionLogo institution={institution} name={institution?.name} size="xs" />;
      case 'edit':
        return canEdit ? (
          isEditing ? (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={savingEdit} onClick={(e) => { e.stopPropagation(); saveEdit(tx); }}><Check className="h-3 w-3" /></Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={savingEdit} onClick={(e) => { e.stopPropagation(); setEditingId(null); }}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); startEdit(tx); }}><Pencil className="h-3 w-3" /></Button>
          )
        ) : <span className="text-muted-foreground/40">—</span>;
      default:
        return <span>—</span>;
    }
  };

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-4">
        <PageHeader title="Transactions" description="All activity across your accounts" />
        <EmptyPortfolioState />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        description="All activity across your accounts"
        actions={
          <Button size="sm" variant="outline" onClick={() => setShowExport(true)} className="gap-1.5 h-8 text-xs">
            <FileText className="w-3.5 h-3.5" /> Export for Taxes
          </Button>
        }
      />
      {showExport && <TaxExportModal onClose={() => setShowExport(false)} />}

      <TransactionAIAssistant />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterColumn} onValueChange={(value) => { setFilterColumn(value); setFilterValue('all'); }}>
          <SelectTrigger className="w-44 h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Filter Column" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="type">Type</SelectItem>
            <SelectItem value="account">Account</SelectItem>
            <SelectItem value="institution">Institution</SelectItem>
            <SelectItem value="currency">Currency</SelectItem>
            <SelectItem value="ticker">Ticker</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterValue} onValueChange={setFilterValue}>
          <SelectTrigger className="w-44 h-8 text-xs bg-secondary border-border"><SelectValue placeholder="Filter Value" /></SelectTrigger>
          <SelectContent>
            {filterOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'All Values' : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} transactions</span>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <DraggableTableHeader
              columns={COLUMN_DEFS}
              orderedColumnIds={visibleColumns}
              onOrderChange={setVisibleColumns}
              rowClassName="border-b border-border bg-secondary/30"
              cellClassName="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              renderCell={(column, dragHandleProps) => (
                <div className={cn('flex items-center gap-1.5', column.align === 'right' ? 'justify-end' : 'justify-start')}>
                  <TableColumnGrip dragHandleProps={dragHandleProps} />
                  <span>{column.label}</span>
                </div>
              )}
            />
            <tbody>
              {filtered.map((tx) => {
                const isExpanded = expandedId === tx.id;
                const isEditing = editingId === tx.id;
                return (
                  <React.Fragment key={tx.id}>
                    <tr
                      className={cn('border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer', isExpanded && 'bg-secondary/20')}
                      onClick={() => setExpandedId(prev => prev === tx.id ? null : tx.id)}
                    >
                      {visibleColumns.map((columnId) => (
                        <td key={`${tx.id}-${columnId}`} className={cn('px-4 py-2.5', ['quantity', 'price', 'total', 'fees', 'edit'].includes(columnId) ? 'text-right' : 'text-left')}>
                          {renderCell(tx, columnId)}
                        </td>
                      ))}
                    </tr>
                    {isEditing && (
                      <tr className="border-b border-border/40 bg-secondary/10">
                        <td colSpan={visibleColumns.length} className="px-4 py-3">
                          <div className="grid gap-2 md:grid-cols-3">
                            <input
                              list="transaction-account-options"
                              value={editDraft.source_account_id || ''}
                              onChange={e => setEditDraft(prev => ({ ...prev, source_account_id: e.target.value }))}
                              placeholder="Source account"
                              className="h-8 rounded-md border border-border/50 bg-secondary px-2 text-xs text-foreground outline-none"
                            />
                            <input
                              list="transaction-account-options"
                              value={editDraft.destination_account_id || ''}
                              onChange={e => setEditDraft(prev => ({ ...prev, destination_account_id: e.target.value }))}
                              placeholder="Destination account"
                              className="h-8 rounded-md border border-border/50 bg-secondary px-2 text-xs text-foreground outline-none"
                            />
                            <input
                              value={editDraft.notes || ''}
                              onChange={e => setEditDraft(prev => ({ ...prev, notes: e.target.value }))}
                              placeholder="Transfer notes"
                              className="h-8 rounded-md border border-border/50 bg-secondary px-2 text-xs text-foreground outline-none"
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                    {isExpanded && (
                      <tr>
                        <td colSpan={visibleColumns.length} className="p-0">
                          <div className="bg-secondary/15 border-t border-border/30">
                            <div className="grid gap-3 px-4 py-3 md:grid-cols-4">
                              <div className="rounded-lg border border-border/40 bg-card/40 p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trade</p>
                                <p className="mt-1 text-sm font-medium">{tx.securityName}</p>
                                <p className="text-[11px] text-muted-foreground">{tx.ticker || 'No ticker'} · {tx.type}</p>
                              </div>
                              <div className="rounded-lg border border-border/40 bg-card/40 p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Position Impact</p>
                                <p className="mt-1 text-sm font-medium">{tx.closedPosition ? 'This trade fully closed the position.' : 'This trade did not fully close the position.'}</p>
                                {tx.realizedMatch && (
                                  <p className="text-[11px] text-muted-foreground mt-1">
                                    {tx.realizedMatch.realized_gain_loss_amount >= 0 ? 'Linked realized gain' : 'Linked realized loss'} of {privacyMode ? PM : formatCurrency(convert(tx.realizedMatch.realized_gain_loss_amount, tx.realizedMatch.currency || 'USD'))}
                                  </p>
                                )}
                              </div>
                              <div className="rounded-lg border border-border/40 bg-card/40 p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Account</p>
                                <p className="mt-1 text-sm font-medium">{getAccount(tx.accountId)?.account_type ?? getAccount(tx.accountId)?.type ?? '—'}</p>
                                <p className="text-[11px] text-muted-foreground">{getInstitutionForAccount(tx.accountId)?.name || 'Unknown Institution'}</p>
                              </div>
                              <div className="rounded-lg border border-border/40 bg-card/40 p-3">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Numbers</p>
                                <p className="mt-1 text-sm font-medium">{privacyMode ? PM : formatCurrency(convert(tx.total ?? tx.total_amount ?? 0, tx.currency || 'USD'))}</p>
                                <p className="text-[11px] text-muted-foreground">Qty {tx.qty || tx.quantity || '—'} · Fees {privacyMode ? PM : formatCurrency(convert(tx.fees || 0, tx.currency || 'USD'))}</p>
                              </div>
                            </div>
                            {tx.ticker && <SecurityHistoryPanel ticker={tx.ticker} />}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <datalist id="transaction-account-options">
            {accounts.map(account => (
              <option key={account.id} value={account.id}>{account.account_name || account.account_type || account.id}</option>
            ))}
          </datalist>
        </div>

        <div className="md:hidden divide-y divide-border">
          {filtered.map((tx) => {
            const cfg = typeConfig[tx.type] ?? { icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-secondary', label: tx.type || 'Other' };
            const Icon = cfg.icon;
            return (
              <button
                key={tx.id}
                type="button"
                onClick={() => setExpandedId(prev => prev === tx.id ? null : tx.id)}
                className="w-full text-left p-4 flex items-center gap-3"
              >
                <div className={cn('p-2 rounded-lg', cfg.bg)}><Icon className={cn('w-4 h-4', cfg.color)} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cfg.label}</span>
                    {tx.ticker && <span className="font-mono text-xs text-primary">{tx.ticker}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{tx.date} · {getAccount(tx.accountId)?.account_type ?? getAccount(tx.accountId)?.type} · {getInstitutionForAccount(tx.accountId)?.name}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{tx.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{privacyMode ? PM : formatCurrency(convert(tx.total ?? tx.total_amount ?? 0, tx.currency || 'USD'))}</span>
                  {expandedId === tx.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
