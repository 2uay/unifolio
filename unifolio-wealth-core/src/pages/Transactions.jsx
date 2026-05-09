import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, DollarSign, RefreshCw, ArrowLeftRight, Receipt, Repeat, Filter, FileText, Pencil, Check, X } from 'lucide-react';
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

function transferContextText(t) {
  if (!['transfer', 'transfer_in', 'transfer_out', 'position_transfer', 'deposit', 'withdrawal'].includes(t.type)) return '';
  const ctx = t.transfer_context || t.transferContext || {};
  const source = t.source_account_id || ctx.sourceAccount || '';
  const destination = t.destination_account_id || ctx.destinationAccount || '';
  if (!source && !destination) return '';
  return `${source || 'Unknown'} → ${destination || 'Unknown'}`;
}

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [showExport, setShowExport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedTicker, setExpandedTicker] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const { privacyMode } = usePrivacy();
  const { convert, displayCurrency } = useCurrency();
  const { transactions, accounts, getAccount, getInstitutionForAccount, isEmptyPortfolio, updateTransferTransaction } = usePortfolioData();
  const PM = '••••••';

  const filtered = typeFilter === 'all' ? transactions : transactions.filter(t => t.type === typeFilter);
  const editableTransferTypes = new Set(['transfer', 'transfer_in', 'transfer_out', 'position_transfer', 'deposit', 'withdrawal']);
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

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} transactions</span>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ticker</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Price</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fees</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Institution</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const cfg = typeConfig[t.type] ?? { icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-secondary', label: t.type || 'Other' };
                const accountId = t.account_id ?? t.accountId;
                const acc = getAccount(accountId);
                const inst = getInstitutionForAccount(accountId);
                const Icon = cfg.icon;
                const transferText = transferContextText(t);
                const isEditing = editingId === t.id;
                const canEdit = editableTransferTypes.has(t.type);
                return (
                  <React.Fragment key={t.id}>
                  <tr className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.date}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1 rounded', cfg.bg)}><Icon className={cn('w-3 h-3', cfg.color)} /></div>
                        <div>
                          <span className="text-xs font-medium">{cfg.label}</span>
                          {transferText && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{transferText}</p>}
                          {isEditing && (
                            <div className="mt-2 grid gap-1.5 min-w-[260px]">
                              <input
                                list="transaction-account-options"
                                value={editDraft.source_account_id || ''}
                                onChange={e => setEditDraft(prev => ({ ...prev, source_account_id: e.target.value }))}
                                placeholder="Source account"
                                className="h-7 rounded-md border border-border/50 bg-secondary px-2 text-[11px] text-foreground outline-none"
                              />
                              <input
                                list="transaction-account-options"
                                value={editDraft.destination_account_id || ''}
                                onChange={e => setEditDraft(prev => ({ ...prev, destination_account_id: e.target.value }))}
                                placeholder="Destination account"
                                className="h-7 rounded-md border border-border/50 bg-secondary px-2 text-[11px] text-foreground outline-none"
                              />
                              <input
                                value={editDraft.notes || ''}
                                onChange={e => setEditDraft(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Transfer notes"
                                className="h-7 rounded-md border border-border/50 bg-secondary px-2 text-[11px] text-foreground outline-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      className={cn('px-4 py-2.5 font-mono font-semibold', t.ticker && 'cursor-pointer hover:text-primary transition-colors')}
                      onClick={() => t.ticker && setExpandedTicker(prev => prev === t.ticker ? null : t.ticker)}
                      title={t.ticker ? `View history for ${t.ticker}` : undefined}
                    >{t.ticker || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{t.qty || t.quantity || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{privacyMode ? PM : (t.price > 0 ? '$' + t.price.toFixed(2) : '—')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">{privacyMode ? PM : formatCurrency(convert(t.total ?? t.total_amount ?? 0, t.currency || 'USD'))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{privacyMode ? PM : (t.fees > 0 ? formatCurrency(convert(t.fees, t.currency || 'USD')) : '—')}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{acc?.account_type ?? acc?.type}</span>
                    </td>
                    <td className="px-4 py-2.5"><InstitutionLogo institution={inst} name={inst?.name} size="xs" /></td>
                    <td className="px-4 py-2.5 text-right">
                      {canEdit && (isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={savingEdit} onClick={() => saveEdit(t)}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={savingEdit} onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => startEdit(t)}><Pencil className="h-3 w-3" /></Button>
                      ))}
                    </td>
                  </tr>
                  {t.ticker && expandedTicker === t.ticker && (
                    <tr>
                      <td colSpan={100} className="p-0">
                        <SecurityHistoryPanel ticker={t.ticker} />
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

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-border">
          {filtered.map(t => {
            const cfg = typeConfig[t.type] ?? { icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-secondary', label: t.type || 'Other' };
            const accountId = t.account_id ?? t.accountId;
            const acc = getAccount(accountId);
            const inst = getInstitutionForAccount(accountId);
            const Icon = cfg.icon;
            const transferText = transferContextText(t);
            return (
              <div key={t.id} className="p-4 flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', cfg.bg)}><Icon className={cn('w-4 h-4', cfg.color)} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cfg.label}</span>
                    {t.ticker && <span className="font-mono text-xs text-primary">{t.ticker}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.date} · {acc?.account_type ?? acc?.type} · {inst?.name}</p>
                  {transferText && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{transferText}</p>}
                </div>
                <span className="font-mono text-sm font-medium">{privacyMode ? PM : formatCurrency(convert(t.total ?? t.total_amount ?? 0, t.currency || 'USD'))}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
