import React, { useState } from 'react';
import { Link2, CheckCircle, AlertCircle, Circle, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import { supabase } from '@/lib/supabaseClient';
import { IMPORT_PORTFOLIO_KEY } from '@/lib/importPersistence';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusConfig = {
  connected:     { icon: CheckCircle, color: 'text-emerald-400', label: 'Connected',     bg: 'bg-emerald-400/10 border-emerald-400/20' },
  disconnected:  { icon: AlertCircle, color: 'text-amber-400',   label: 'Disconnected',  bg: 'bg-amber-400/10 border-amber-400/20' },
  not_connected: { icon: Circle,      color: 'text-muted-foreground', label: 'Not Connected', bg: 'bg-secondary border-border' },
};

export default function Institutions() {
  const { institutions, accounts, holdings, calcAccountValue, isEmptyPortfolio, refreshPortfolioData } = usePortfolioData();
  const [pendingDelete, setPendingDelete] = useState(null); // inst object
  const [deleting, setDeleting] = useState(false);

  const connected  = institutions.filter(i => (i.connection_status ?? i.status) === 'connected');
  const available  = institutions.filter(i => (i.connection_status ?? i.status) !== 'connected');

  const handleDisconnect = (inst) => setPendingDelete(inst);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const inst = pendingDelete;
      const instAccounts = accounts.filter(a => (a.institution_id ?? a.institutionId) === inst.id);
      const accountIds = instAccounts.map(a => a.id);

      // Cascade delete in dependency order
      if (accountIds.length > 0) {
        await supabase.from('holdings').delete().in('account_id', accountIds);
        await supabase.from('transactions').delete().in('account_id', accountIds);
        await supabase.from('realized_positions').delete().in('account_id', accountIds).then(() => {});
        await supabase.from('import_batches').delete().in('account_id', accountIds).then(() => {});
      }
      await supabase.from('import_batches').delete().eq('institution_id', inst.id);
      await supabase.from('accounts').delete().eq('institution_id', inst.id);
      await supabase.from('institutions').delete().eq('id', inst.id);

      // Prune localStorage
      try {
        const raw = localStorage.getItem(IMPORT_PORTFOLIO_KEY);
        if (raw) {
          const bundle = JSON.parse(raw);
          bundle.accounts  = (bundle.accounts  || []).filter(a => (a.institution_id ?? a.institutionId) !== inst.id);
          bundle.holdings  = (bundle.holdings  || []).filter(h => !accountIds.includes(h.account_id ?? h.accountId));
          bundle.transactions = (bundle.transactions || []).filter(t => !accountIds.includes(t.account_id ?? t.accountId));
          localStorage.setItem(IMPORT_PORTFOLIO_KEY, JSON.stringify(bundle));
        }
      } catch { /* ignore */ }

      await refreshPortfolioData?.();
    } catch (err) {
      console.error('[Institutions] delete failed:', err);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-6">
        <PageHeader title="Connected Institutions" description="Manage your brokerage and bank connections" />
        <EmptyPortfolioState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Connected Institutions" description="Manage your brokerage and bank connections" />

      {/* Connected */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Active Connections</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {connected.map(inst => {
            const instAccounts = accounts.filter(a => (a.institution_id ?? a.institutionId) === inst.id);
            const instHoldings = holdings.filter(h => instAccounts.some(a => a.id === (h.account_id ?? h.accountId)) && h.quantity > 0);
            const totalValue   = instAccounts.reduce((sum, a) => sum + calcAccountValue(a.id), 0);
            const status = inst.connection_status ?? inst.status;
            const cfg = statusConfig[status] ?? statusConfig['not_connected'];
            const Icon = cfg.icon;

            return (
              <div key={inst.id} className={cn('rounded-xl border p-5', cfg.bg)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{inst.logo}</span>
                    <div>
                      <h3 className="font-semibold">{inst.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Icon className={cn('w-3 h-3', cfg.color)} />
                        <span className={cn('text-xs', cfg.color)}>{cfg.label}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-mono font-semibold">{formatCurrency(totalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Accounts</span>
                    <span className="font-mono">{instAccounts.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Positions</span>
                    <span className="font-mono">{instHoldings.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Sync</span>
                    <span className="text-xs text-muted-foreground">
                      {(inst.last_sync_time ?? inst.lastSync) ? new Date(inst.last_sync_time ?? inst.lastSync).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1">
                    <RefreshCw className="w-3 h-3" /> Sync
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 text-xs gap-1 text-red-400 hover:text-red-300 hover:border-red-400/40"
                    onClick={() => handleDisconnect(inst)}
                  >
                    <Trash2 className="w-3 h-3" /> Disconnect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Available Institutions</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {available.map(inst => {
            const status = inst.connection_status ?? inst.status;
            const cfg = statusConfig[status] ?? statusConfig['not_connected'];
            const Icon = cfg.icon;
            return (
              <div key={inst.id} className="rounded-xl border border-border bg-card p-5 opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{inst.logo}</span>
                  <div>
                    <h3 className="font-semibold">{inst.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Icon className={cn('w-3 h-3', cfg.color)} />
                      <span className={cn('text-xs', cfg.color)}>{cfg.label}</span>
                    </div>
                  </div>
                </div>
                <Button className="w-full mt-4" size="sm" variant="outline">
                  <Link2 className="w-3 h-3 mr-1" /> Connect
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm delete dialog */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all accounts, holdings, transactions, and import history for
              <strong className="text-foreground"> {pendingDelete?.name}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Deleting…</> : 'Yes, disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
