import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, DollarSign, RefreshCw, ArrowLeftRight, Receipt, Repeat, Filter, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { transactions, getAccount, getInstitutionForAccount } from '@/lib/mockData';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import PageHeader from '@/components/shared/PageHeader';
import TaxExportModal from '@/components/transactions/TaxExportModal';
import { cn } from '@/lib/utils';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';

const typeConfig = {
  buy: { icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Buy' },
  sell: { icon: ArrowUpRight, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Sell' },
  dividend: { icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Dividend' },
  deposit: { icon: ArrowDownLeft, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Deposit' },
  withdrawal: { icon: ArrowUpRight, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Withdrawal' },
  transfer: { icon: ArrowLeftRight, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Transfer' },
  fee: { icon: Receipt, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Fee' },
  currency_conversion: { icon: Repeat, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'FX Conversion' },
};

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [showExport, setShowExport] = useState(false);
  const { privacyMode } = usePrivacy();
  const { convert, displayCurrency } = useCurrency();
  const PM = '••••••';

  const filtered = typeFilter === 'all' ? transactions : transactions.filter(t => t.type === typeFilter);

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
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const cfg = typeConfig[t.type] ?? { icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-secondary', label: t.type || 'Other' };
                const acc = getAccount(t.accountId);
                const inst = getInstitutionForAccount(t.accountId);
                const Icon = cfg.icon;
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.date}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1 rounded', cfg.bg)}><Icon className={cn('w-3 h-3', cfg.color)} /></div>
                        <span className="text-xs font-medium">{cfg.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-semibold">{t.ticker || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{t.qty || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{privacyMode ? PM : (t.price > 0 ? '$' + t.price.toFixed(2) : '—')}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">{privacyMode ? PM : formatCurrency(convert(t.total ?? t.total_amount ?? 0, t.currency || 'USD'))}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{privacyMode ? PM : (t.fees > 0 ? formatCurrency(convert(t.fees, t.currency || 'USD')) : '—')}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{acc?.type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{inst?.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-border">
          {filtered.map(t => {
            const cfg = typeConfig[t.type] ?? { icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-secondary', label: t.type || 'Other' };
            const acc = getAccount(t.accountId);
            const inst = getInstitutionForAccount(t.accountId);
            const Icon = cfg.icon;
            return (
              <div key={t.id} className="p-4 flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', cfg.bg)}><Icon className={cn('w-4 h-4', cfg.color)} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cfg.label}</span>
                    {t.ticker && <span className="font-mono text-xs text-primary">{t.ticker}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.date} · {acc?.type} · {inst?.name}</p>
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