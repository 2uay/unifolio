import React, { useState } from 'react';
import {
  Shield, Lock, Eye, EyeOff, Database, Download, Trash2,
  Link2Off, CheckCircle2, XCircle, Server, Smartphone, AlertTriangle,
  FileJson, FileSpreadsheet, ChevronRight, ChevronDown,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { deleteAllUserPortfolioData } from '@/lib/dataDeletion';

const ReadOnlyBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
    <Lock className="h-2.5 w-2.5" /> Read Only
  </span>
);

const CanDo = ({ children }) => (
  <li className="flex items-start gap-2 text-xs text-muted-foreground">
    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
    {children}
  </li>
);

const CannotDo = ({ children }) => (
  <li className="flex items-start gap-2 text-xs text-muted-foreground">
    <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500/70" />
    {children}
  </li>
);

function Section({ icon: Icon, title, children, accent }) {
  return (
    <div className={cn('rounded-xl border bg-card/60 p-5', accent ? 'border-primary/20' : 'border-border/50')}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent ? 'bg-primary/10' : 'bg-secondary')}>
          <Icon className={cn('h-4 w-4', accent ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ExpandableSection({ icon: Icon, title, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2.5 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-border/30">{children}</div>}
    </div>
  );
}

function DeleteConfirmModal({ onClose, onConfirm, deleting, error }) {
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!confirmed || deleting) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Delete All Data</h3>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>

        {step === 1 && (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              This will permanently delete all of your holdings, transactions, accounts, watchlists, and settings stored in Unifolio. Your brokerage accounts themselves are not affected — only the data within Unifolio.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={onClose} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setStep(2)} disabled={deleting}>Continue</Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              To confirm, check the box below:
            </p>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-xs">I understand this will permanently delete all my Unifolio data.</span>
            </label>
            <div className="flex gap-2 justify-end">
              {error && <p className="mr-auto text-[11px] text-red-300">{error}</p>}
              <Button variant="outline" size="sm" onClick={onClose} disabled={deleting}>Cancel</Button>
              <Button
                size="sm"
                className={cn('text-white', confirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600/40 cursor-not-allowed')}
                disabled={!confirmed || deleting}
                onClick={handleConfirm}
              >
                {deleting ? 'Deleting…' : 'Delete All Data'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PrivacyAndData() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const { user } = useAuth();
  const { refreshPortfolioData } = usePortfolioData();

  const handleExportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      source: 'Unifolio',
      note: 'Full data export — import this backup to restore your portfolio.',
      data: { message: 'Full export available in Settings → Export My Data.' },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unifolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAll = async () => {
    if (deletingAll) return;
    setDeletingAll(true);
    setDeleteError(null);
    try {
      await deleteAllUserPortfolioData(user?.id);
      await refreshPortfolioData?.();
      setShowDeleteModal(false);
    } catch (error) {
      console.error('[PrivacyAndData] delete all failed:', error);
      setDeleteError(error?.message || 'Delete failed. Please try again.');
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Privacy & Data Control"
        description="Everything you need to know about what Unifolio stores, where, and how to take it with you."
      />

      {/* Formal policy callout — links to the canonical, version-controlled
          policies on GitHub. The summaries below are the user-friendly view
          of the same commitments. */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Official Privacy Policy</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            The summaries below are the plain-English version. The canonical, dated, version-controlled policy documents live in the public Unifolio repository.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://github.com/2uay/unifolio/blob/main/unifolio-wealth-core/docs/PRIVACY_POLICY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
          >
            Privacy Policy →
          </a>
          <a
            href="https://github.com/2uay/unifolio/blob/main/unifolio-wealth-core/docs/INFOSEC_POLICY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground text-xs font-semibold hover:bg-secondary transition-colors"
          >
            Security Policy →
          </a>
          <a
            href="https://github.com/2uay/unifolio/blob/main/unifolio-wealth-core/docs/DATA_RETENTION_POLICY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground text-xs font-semibold hover:bg-secondary transition-colors"
          >
            Retention Policy →
          </a>
        </div>
      </div>

      {/* Hero commitment strip */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex flex-wrap items-center gap-4">
        <Shield className="h-8 w-8 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Your data stays under your control.</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unifolio is for tracking and analysis only. We cannot trade, transfer, or move money on your behalf — ever.
            Export everything, delete everything, disconnect anytime.
          </p>
        </div>
        <ReadOnlyBadge />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* What we store */}
        <Section icon={Database} title="What Unifolio stores">
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">We store</p>
              <ul className="space-y-1">
                {[
                  'Account names and types (e.g. TFSA, RRSP)',
                  'Holdings: ticker, quantity, purchase price',
                  'Transaction history you import or enter',
                  'Watchlist tickers and notes',
                  'Your display preferences and theme',
                  'Portfolio snapshots for performance charts',
                ].map(item => (
                  <CanDo key={item}>{item}</CanDo>
                ))}
              </ul>
            </div>
            <div className="border-t border-border/30 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">We never store</p>
              <ul className="space-y-1">
                {[
                  'Bank passwords or login credentials',
                  'Two-factor authentication codes',
                  'Real-time brokerage account access tokens',
                  'SIN numbers or government IDs',
                  'Payment card numbers',
                ].map(item => (
                  <CannotDo key={item}>{item}</CannotDo>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Where it's stored */}
        <Section icon={Server} title="Where your data lives">
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg bg-secondary/40 p-3">
              <Server className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Supabase (cloud)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Your account data is stored in a Supabase database hosted in the United States.
                  Data is encrypted in transit (TLS) and at rest. Supabase is SOC 2 Type II compliant.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg bg-secondary/40 p-3">
              <Smartphone className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">Your device (localStorage)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  UI preferences (theme, column order, heatmap mode) and quote caches are stored
                  locally in your browser. This data never leaves your device.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <p className="text-[11px] text-amber-400">
                <strong>No data selling.</strong> Unifolio does not sell, rent, share, or monetize your financial data with any third party.
              </p>
            </div>
          </div>
        </Section>

        {/* Read-only connections */}
        <Section icon={Lock} title="Account connections are read-only" accent>
          <p className="text-xs text-muted-foreground mb-3">
            When you connect a brokerage or bank account, Unifolio is granted view-only access.
            No trading, no transfers, no changes to your account.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500 mb-1.5">Unifolio can</p>
              <ul className="space-y-1">
                <CanDo>View account balances</CanDo>
                <CanDo>Read holdings and positions</CanDo>
                <CanDo>Read transaction history</CanDo>
                <CanDo>Read account metadata</CanDo>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-1.5">Unifolio cannot</p>
              <ul className="space-y-1">
                <CannotDo>Place trades or orders</CannotDo>
                <CannotDo>Withdraw or transfer funds</CannotDo>
                <CannotDo>Change account settings</CannotDo>
                <CannotDo>Access two-factor codes</CannotDo>
              </ul>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
            <ReadOnlyBadge />
            <p className="text-[11px] text-muted-foreground">All connections are view-only. You can disconnect any account at any time from the Institutions page.</p>
          </div>
        </Section>

        {/* Demo data */}
        <Section icon={Eye} title="Demo mode & sample data">
          <p className="text-xs text-muted-foreground mb-3">
            The demo portfolio shown when you click "Try Demo" is entirely fictional.
            It uses made-up holdings, fake account names, and simulated prices.
            No real investor data is used.
          </p>
          <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 space-y-1.5">
            {[
              ['Holdings shown in demo', 'Fictional — not real positions'],
              ['Institution names', 'Example names only'],
              ['Live prices in demo', 'Simulated from sample prices'],
              ['Transactions in demo', 'Made-up sample transactions'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-amber-400 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Export & Delete section */}
      <ExpandableSection icon={Download} title="Export your data" defaultOpen>
        <div className="pt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Your data is never trapped. Export everything at any time in your format of choice.
            Use these exports to migrate to another tool, back up your records, or prepare for tax filing.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { icon: FileJson, label: 'Full JSON Backup', desc: 'Complete portfolio snapshot — accounts, holdings, transactions, watchlist, settings.', onClick: handleExportJSON },
              { icon: FileSpreadsheet, label: 'Holdings CSV', desc: 'All active positions with quantity, avg price, market value, P&L, and allocations.', onClick: null },
              { icon: FileSpreadsheet, label: 'Transactions CSV', desc: 'Full transaction history — buys, sells, dividends, deposits, withdrawals.', onClick: null },
              { icon: FileSpreadsheet, label: 'Realized Gains CSV', desc: 'Closed positions with cost basis, proceeds, gain/loss, and holding period.', onClick: null },
            ].map(({ icon: Icon, label, desc, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick ?? (() => {})}
                disabled={!onClick}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  onClick
                    ? 'border-border/50 bg-secondary/20 hover:bg-secondary/50 cursor-pointer'
                    : 'border-border/20 bg-secondary/10 opacity-50 cursor-not-allowed'
                )}
              >
                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                  {!onClick && <span className="text-[10px] text-muted-foreground/50 italic">Coming soon</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </ExpandableSection>

      <ExpandableSection icon={Link2Off} title="Disconnect accounts">
        <div className="pt-4">
          <p className="text-xs text-muted-foreground mb-3">
            To disconnect a connected institution, navigate to the Institutions page. You can disconnect any account at any time.
            Disconnecting removes the live sync but does not delete imported historical data.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="/import">Manage in Import Center →</a>
          </Button>
        </div>
      </ExpandableSection>

      <ExpandableSection icon={Trash2} title="Delete all data">
        <div className="pt-4">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 mb-4">
            <p className="text-xs text-red-400 font-medium mb-1">Permanent action</p>
            <p className="text-[11px] text-muted-foreground">
              Deleting all data removes your holdings, transactions, accounts, watchlists, and preferences from Unifolio's database and your browser.
              Your actual brokerage accounts are completely unaffected — this only removes data from Unifolio.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete all my Unifolio data
          </Button>
        </div>
      </ExpandableSection>

      {showDeleteModal && (
        <DeleteConfirmModal
          onClose={() => {
            if (deletingAll) return;
            setShowDeleteModal(false);
            setDeleteError(null);
          }}
          onConfirm={handleDeleteAll}
          deleting={deletingAll}
          error={deleteError}
        />
      )}
    </div>
  );
}
