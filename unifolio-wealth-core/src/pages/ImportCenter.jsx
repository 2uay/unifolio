import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Upload, ChevronRight, ChevronLeft, Check, AlertTriangle,
  X, Download, BookOpen, RefreshCw, Database, FileSpreadsheet, RotateCcw,
  Link2, Loader2, Zap, Trash2, Lock, Building2,
} from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  parseFile, parseRows, parseHoldingsRows, composeParsedImports, verifyParsedSecurities, BROKER_LABELS, FIELD_LABELS,
} from '@/lib/csvParser';
import { bankExportInstructions, downloadInstructionAsset } from '@/lib/bankExportInstructions';
import { saveParsedImport } from '@/lib/importPersistence';
import { COLUMN_DEFINITIONS } from '@/lib/columnConfig';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import InstitutionLogo from '@/components/shared/InstitutionLogo';
import PlaidConnectButton from '@/components/plaid/PlaidConnectButton';

// ─── PLAID SECTION ───────────────────────────────────────────

function PlaidSection() {
  const { user, isPro } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);

  const loadItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('plaid_items')
        .select('id, item_id, institution_name, institution_logo, accounts, last_synced_at, status, error_code')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setItems(data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (isPro) loadItems(); }, [isPro, loadItems]);

  const handleSync = async (itemId) => {
    setSyncingId(itemId);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token;
      await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId }),
      });
      await loadItems();
    } finally { setSyncingId(null); }
  };

  const handleDisconnect = async (itemId) => {
    setDisconnectingId(itemId);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token;
      await fetch('/api/plaid/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId }),
      });
      await loadItems();
    } finally { setDisconnectingId(null); }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Live Brokerage Sync</p>
            <p className="text-[10px] text-muted-foreground">Connect via Plaid — holdings sync automatically</p>
          </div>
        </div>
        {isPro && <PlaidConnectButton onSuccess={loadItems} className="flex-shrink-0" />}
      </div>

      {/* Body */}
      {!isPro ? (
        <div className="flex items-center gap-3 px-4 py-4">
          <Lock className="w-4 h-4 text-primary/50 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Live brokerage sync is a <span className="text-primary font-medium">Pro</span> feature.{' '}
            <a href="https://unifolio.pro" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Plans →</a>
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading connections…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <Building2 className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No brokerages connected yet.</p>
          <p className="text-xs text-muted-foreground/60">Click "Connect a Brokerage" above to link your first account via Plaid.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/20">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                {item.institution_logo
                  ? <img src={`data:image/png;base64,${item.institution_logo}`} alt="" className="w-5 h-5 object-contain" />
                  : <Building2 className="w-4 h-4 text-muted-foreground" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.institution_name || 'Unknown Institution'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {item.status === 'error'
                    ? <span className="text-red-400">Error: {item.error_code || 'sync failed'}</span>
                    : item.last_synced_at
                      ? `Last synced ${new Date(item.last_synced_at).toLocaleString()}`
                      : 'Never synced'
                  }
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1"
                  disabled={syncingId === item.item_id}
                  onClick={() => handleSync(item.item_id)}
                >
                  {syncingId === item.item_id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />
                  }
                  Sync
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={disconnectingId === item.item_id}
                  onClick={() => handleDisconnect(item.item_id)}
                >
                  {disconnectingId === item.item_id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />
                  }
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const IMPORT_HISTORY_KEY = 'unifolio_import_history';
const TRANSFER_TYPES = new Set(['Position Transfer', 'Transfer In', 'Transfer Out', 'Deposit', 'Withdrawal']);

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(IMPORT_HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

// ─── STEP INDICATOR ──────────────────────────────────────────

function StepIndicator({ step, hasTransfers }) {
  const steps = ['Upload', 'Map & Preview', 'Accounts', ...(hasTransfers ? ['Transfers'] : []), 'Confirm'];
  const activeLabel = step === 1 ? 'Upload'
    : step === 2 ? 'Map & Preview'
    : step === 4 ? 'Accounts'
    : step === 5 && hasTransfers ? 'Transfers'
    : 'Confirm';
  const visibleStep = Math.max(1, steps.indexOf(activeLabel) + 1);
  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = visibleStep > idx;
        const active = visibleStep === idx;
        return (
          <React.Fragment key={label}>
            <div className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              done ? 'bg-primary/10 text-primary' : active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
            )}>
              {done ? <Check className="h-3 w-3" /> : <span className="text-[10px] font-bold">{idx}</span>}
              {label}
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── STEP 1: UPLOAD ──────────────────────────────────────────

function UploadStep({ onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef(null);

  const processFiles = useCallback(async (fileList) => {
    const files = [...(fileList || [])];
    if (files.length === 0) return;
    setParsing(true);
    setError(null);
    try {
      const invalid = files.filter(file => !['csv', 'txt', 'tsv'].includes(file.name.split('.').pop().toLowerCase()));
      if (invalid.length) {
        setError('Please upload only CSV, TSV, or TXT files. Excel (.xlsx) support coming soon.');
        return;
      }
      const parsedFiles = await Promise.all(files.map(async (file) => {
        const text = await file.text();
        return { ...parseFile(text, file.name), filename: file.name, fileSize: file.size };
      }));
      const failed = parsedFiles.find(result => result.error);
      if (failed) {
        setError(`${failed.filename}: ${failed.error}`);
        return;
      }
      const composed = composeParsedImports(parsedFiles);
      const verified = await Promise.all(composed.map(verifyParsedSecurities));
      onParsed(verified, parsedFiles);
    } catch (err) {
      setError('Failed to read files. Make sure they are valid CSVs.');
    } finally {
      setParsing(false);
    }
  }, [onParsed]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const onFileChange = (e) => processFiles(e.target.files);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all cursor-pointer py-14 px-6 text-center',
          dragging ? 'border-primary bg-primary/5' : 'border-border/60 bg-card/40 hover:border-primary/40 hover:bg-secondary/20',
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept=".csv,.txt,.tsv" className="sr-only" onChange={onFileChange} />
        {parsing ? (
          <>
            <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-foreground">Parsing file…</p>
          </>
        ) : (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-4">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Drop one or more CSV files here</p>
            <p className="text-xs text-muted-foreground">Upload holdings + activity files together — CSV, TSV, TXT accepted</p>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Supported formats + templates */}
      <div className="rounded-xl border border-border/40 bg-card/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Supported formats</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[
            { broker: 'ibkr', label: 'Interactive Brokers Flex Query' },
            { broker: 'wealthsimple_activity', label: 'Wealthsimple Activity CSV' },
            { broker: 'questrade', label: 'Questrade Account Activity' },
            { broker: 'td', label: 'TD Direct Investing' },
            { broker: 'unifolio', label: 'Unifolio Transaction Template' },
            { broker: 'unifolio_holdings', label: 'Unifolio Holdings Template' },
          ].map(({ broker, label }) => (
            <div key={broker} className="flex items-center gap-2 text-xs text-muted-foreground">
              <InstitutionLogo logo={BROKER_LABELS[broker]?.logo} broker={broker} name={BROKER_LABELS[broker]?.name || label} size="xs" />
              {label}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" asChild>
            <a href="/instructions"><BookOpen className="h-3 w-3" />Export instructions</a>
          </Button>
          {bankExportInstructions
            .find(b => b.id === 'ibkr')
            ?.downloads?.map(d => (
              <Button key={d.filename} variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => downloadInstructionAsset(d)}>
                <Download className="h-3 w-3" />
                {d.label}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── STEP 2: MAP & PREVIEW ───────────────────────────────────

const ALL_UNIFOLIO_FIELDS = Object.entries(FIELD_LABELS).map(([value, label]) => ({ value, label }));

function getImportTransactions(parsed) {
  return parsed?.importBundle?.transactions || (!parsed?.isHoldings ? parsed?.valid || [] : []);
}

function isTransferLike(row) {
  return TRANSFER_TYPES.has(row?.type)
    || /transfer|deposit|withdraw/i.test(`${row?.type || ''} ${row?.notes || ''} ${row?.rawActivityType || ''} ${row?.rawActivitySubType || ''}`);
}

function transferGroupId(row) {
  return [
    row.date || '',
    row.account || row.account_id || '',
    row.type || '',
    row.ticker || '',
    row.currency || '',
    row.transferDirection || row.transfer_direction || '',
  ].join('|');
}

function buildTransferGroups(parsed) {
  const map = new Map();
  getImportTransactions(parsed).filter(isTransferLike).forEach(row => {
    const id = transferGroupId(row);
    const existing = map.get(id) || {
      id,
      date: row.date,
      type: row.type,
      ticker: row.ticker || '',
      account: row.account || row.account_id || '',
      currency: row.currency || '',
      direction: row.transferDirection || row.transfer_direction || '',
      rows: [],
      quantity: 0,
      amount: 0,
    };
    existing.rows.push(row);
    existing.quantity += Number(row.quantity || 0);
    existing.amount += Number(row.netAmount ?? row.grossAmount ?? row.total_amount ?? row.total ?? 0);
    map.set(id, existing);
  });
  return [...map.values()];
}

function defaultTransferContext(group) {
  const account = group.account || '';
  const type = group.type || '';
  const direction = group.direction || '';
  const inbound = direction === 'in' || ['Transfer In', 'Deposit', 'Position Transfer'].includes(type);
  const outbound = direction === 'out' || ['Transfer Out', 'Withdrawal'].includes(type);
  return {
    sourceAccount: outbound ? account : '',
    destinationAccount: inbound ? account : '',
    notes: '',
    skipped: false,
  };
}

function applyTransferContext(parsed, contexts) {
  const transactions = getImportTransactions(parsed);
  if (!transactions.length) return parsed;
  const patchedTransactions = transactions.map(row => {
    if (!isTransferLike(row)) return row;
    const ctx = contexts[transferGroupId(row)];
    if (!ctx || ctx.skipped) return row;
    const transferContext = {
      sourceAccount: ctx.sourceAccount || '',
      destinationAccount: ctx.destinationAccount || '',
      notes: ctx.notes || '',
      groupId: transferGroupId(row),
    };
    const contextNote = [
      ctx.sourceAccount || ctx.destinationAccount ? `context:${ctx.sourceAccount || 'Unknown'} → ${ctx.destinationAccount || 'Unknown'}` : '',
      ctx.notes ? `memo:${ctx.notes}` : '',
    ].filter(Boolean).join(' · ');
    return {
      ...row,
      sourceAccount: ctx.sourceAccount || row.sourceAccount || '',
      destinationAccount: ctx.destinationAccount || row.destinationAccount || '',
      transferContext,
      notes: [row.notes, contextNote].filter(Boolean).join(' · '),
    };
  });
  return {
    ...parsed,
    importBundle: {
      ...(parsed.importBundle || {}),
      transactions: patchedTransactions,
      transferContexts: contexts,
    },
    valid: parsed.isHoldings ? parsed.valid : patchedTransactions,
  };
}

function brokerFamily(broker) {
  if (String(broker || '').startsWith('wealthsimple')) return 'Wealthsimple';
  if (String(broker || '').startsWith('ibkr')) return 'Interactive Brokers';
  return BROKER_LABELS[broker]?.name || broker || 'Imported Broker';
}

function rawAccountId(account) {
  return account?.clientAccountId || account?.account_id || account?.accountId || account?.id || account?.account || '';
}

function getParsedAccounts(parsed) {
  const bundleAccounts = Array.isArray(parsed?.importBundle?.accounts) ? parsed.importBundle.accounts : [];
  const raw = [
    ...bundleAccounts,
    ...(parsed?.importBundle?.positions || parsed?.valid || []).map(row => ({
      clientAccountId: row.account || row.account_id || row.accountId,
      accountType: row.accountType,
      currency: row.currency,
    })),
    ...(parsed?.importBundle?.transactions || []).map(row => ({
      clientAccountId: row.account || row.account_id || row.accountId,
      accountType: row.accountType,
      currency: row.currency,
    })),
    ...(parsed?.importBundle?.realizedPositions || []).map(row => ({
      clientAccountId: row.account || row.account_id || row.accountId,
      accountType: row.accountType,
      currency: row.currency,
    })),
  ].filter(account => rawAccountId(account));

  const byId = new Map();
  raw.forEach(account => {
    const id = rawAccountId(account);
    if (!byId.has(id)) byId.set(id, account);
    else byId.set(id, { ...byId.get(id), ...account });
  });
  return [...byId.values()].map(account => ({
    rawAccountId: rawAccountId(account),
    accountType: account.accountType || account.type || 'Brokerage',
    currency: account.currency || account.base_currency || 'USD',
    name: account.name || rawAccountId(account),
  }));
}

function findExistingAccountMatch(importAccount, existingAccounts, institutions, broker) {
  const family = brokerFamily(broker).toLowerCase();
  const accountType = String(importAccount.accountType || '').toLowerCase();
  const rawId = String(importAccount.rawAccountId || '').toLowerCase();
  const brokerAccountIds = new Set(
    institutions
      .filter(inst => String(inst.name || '').toLowerCase().includes(family.split(' ')[0]))
      .map(inst => inst.id),
  );

  const sameBrokerAccounts = existingAccounts.filter(account => {
    const instId = account.institution_id ?? account.institutionId;
    return brokerAccountIds.has(instId);
  });

  const exact = sameBrokerAccounts.find(account => String(account.account_name || '').toLowerCase() === rawId);
  if (exact) return { type: 'exact', account: exact };

  const sameType = sameBrokerAccounts.find(account => String(account.account_type || account.type || '').toLowerCase() === accountType);
  if (sameType) return { type: 'possible', account: sameType };

  return { type: 'new', account: null };
}

function applyAccountResolutions(parsed, resolutions) {
  return {
    ...parsed,
    importBundle: {
      ...(parsed.importBundle || {}),
      accountResolutions: resolutions,
    },
  };
}


function MapPreviewStep({ parsed, onUpdateMap, onNext, onBack }) {
  const { broker, headers, columnMap, valid, errors, isHoldings, filename, isSectioned, importBundle } = parsed;
  const brokerInfo = BROKER_LABELS[broker] || BROKER_LABELS.generic;
  const [previewTab, setPreviewTab] = useState('holdings');
  const sourceFiles = parsed.sourceFiles || importBundle?.sourceFiles || [];
  const reconciliationWarnings = parsed.reconciliationWarnings || importBundle?.reconciliationWarnings || [];

  const openHoldings = importBundle?.openHoldings || importBundle?.positions || valid;
  const realizedPositions = importBundle?.realizedPositions || [];
  const importedTransactions = importBundle?.transactions || (!isHoldings ? valid : []);
  const previewRows = (previewTab === 'realized'
    ? realizedPositions
    : previewTab === 'transactions'
    ? importedTransactions
    : openHoldings).slice(0, 12);
  const previewFields = previewTab === 'transactions'
    ? ['date', 'type', 'ticker', 'quantity', 'price', 'netAmount', 'fees', 'currency', 'account', 'institution']
    : COLUMN_DEFINITIONS.map(c => c.id);

  const renderPreviewValue = (row, field) => {
    const map = {
      company: row.name || row.asset_name,
      quantity: row.quantity ?? row.position,
      account: row.account || row.account_id,
      institution: row.institution || brokerInfo.name,
      accountType: row.accountType,
      price: row.price ?? row.current_price ?? row.lastPrice,
      avgPrice: row.avgPrice ?? row.average_price ?? row.average_buy_price,
      marketValue: row.marketValue ?? row.market_value ?? row.total_sale_value,
      nativeMarketValue: row.marketValue ?? row.market_value ?? row.total_sale_value,
      costBasis: row.costBasis ?? row.cost_basis ?? row.total_cost_basis,
      dailyPnl: row.dailyPnl ?? row.daily_pnl_amount,
      dailyPnlPct: row.dailyPct ?? row.daily_pnl_percent,
      unrealizedGain: row.unrealized_gain_loss_amount ?? row.unrealizedGL,
      unrealizedGainPct: row.unrealized_gain_loss_percent,
      realizedGain: row.realized_gain_loss_amount ?? row.realizedGL,
      realizedGainContrib: row.realized_gain_loss_percent,
      assetClass: row.asset_class ?? row.assetClass,
      pctPortfolio: row._portfolioWeight,
      pctAccount: row._accountWeight,
      pctAssetClass: row._assetClassWeight,
      trend: row.sparkline?.length ? 'sparkline' : '',
    };
    const value = map[field] ?? row[field];
    if (value === undefined || value === null || value === '') return <span className="opacity-30">—</span>;
    if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—';
    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* Detected broker */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-card/50 px-4 py-3">
        <InstitutionLogo logo={brokerInfo.logo} broker={broker} name={brokerInfo.name} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{filename}</p>
          <p className="text-xs text-muted-foreground">Detected format: <span className="text-foreground font-medium">{brokerInfo.name}</span></p>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="text-emerald-400 font-medium">{valid.length} rows ready</span>
          {errors.length > 0 && <span className="text-red-400 font-medium">{errors.length} errors</span>}
        </div>
      </div>

      {isSectioned && importBundle?.sectionSummary?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/50 p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Detected import sections</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {importBundle.sectionSummary
              .filter(section => section.rowCount > 0)
              .map(section => (
                <div key={section.code} className="rounded-lg border border-border/30 bg-secondary/30 px-3 py-2">
                  <p className="text-[11px] font-semibold text-foreground">{section.code}</p>
                  <p className="text-[10px] text-muted-foreground truncate" title={section.name}>{section.name}</p>
                  <p className="text-[10px] text-primary mt-1">{section.rowCount} rows</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {sourceFiles.length > 1 && (
        <div className="rounded-xl border border-border/40 bg-card/50 p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Parsed files in this group</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sourceFiles.map((file, index) => (
              <div key={`${file.filename}-${index}`} className="rounded-lg border border-border/30 bg-secondary/30 px-3 py-2">
                <p className="text-[11px] font-semibold text-foreground truncate" title={file.filename}>{file.filename}</p>
                <p className="text-[10px] text-muted-foreground">{BROKER_LABELS[file.broker]?.name || file.broker}</p>
                <p className="text-[10px] text-primary mt-1">{file.rowCount} rows · {file.errorCount || 0} issues</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {reconciliationWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-300 mb-2">Reconciliation notes</p>
          <div className="space-y-1">
            {reconciliationWarnings.slice(0, 6).map((warning, index) => (
              <p key={index} className="text-[11px] text-amber-200/80">{warning.message || String(warning)}</p>
            ))}
            {reconciliationWarnings.length > 6 && <p className="text-[11px] text-muted-foreground">+{reconciliationWarnings.length - 6} more</p>}
          </div>
        </div>
      )}

      {/* Preview table */}
      <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/30 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">Preview — first {previewRows.length} rows</p>
          {isSectioned ? (
            <div className="flex rounded-lg border border-border/40 bg-secondary/40 p-0.5">
              {[
                ['holdings', `Open Holdings (${openHoldings.length})`],
                ['realized', `Realized (${realizedPositions.length})`],
                ['transactions', `Transactions (${importedTransactions.length})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreviewTab(id)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[10px] transition-colors',
                    previewTab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">{isHoldings ? 'Holdings import' : 'Transaction import'}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/30 bg-secondary/30">
                {previewFields.map(f => (
                  <th key={f} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    {COLUMN_DEFINITIONS.find(c => c.id === f)?.shortLabel || FIELD_LABELS[f] || f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-secondary/20">
                  {previewFields.map(f => (
                    <td key={f} className="px-3 py-1.5 whitespace-nowrap text-muted-foreground max-w-[180px] truncate">
                      {renderPreviewValue(row, f)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column mapping editor */}
      {!isSectioned ? (
        <div className="rounded-xl border border-border/40 bg-card/50 p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Column mapping</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(FIELD_LABELS).map(([field, label]) => {
              const idx = columnMap[field] ?? -1;
              return (
                <div key={field} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-24 flex-shrink-0">{label}</span>
                  <select
                    value={idx}
                    onChange={(e) => onUpdateMap(field, Number(e.target.value))}
                    className="flex-1 h-7 rounded-md border border-border/50 bg-secondary px-2 text-[11px] text-foreground"
                  >
                    <option value={-1}>— skip —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-xs text-emerald-300">
            {broker === 'wealthsimple_activity'
              ? 'Wealthsimple activity export detected. Unifolio reconstructed open holdings from transfers and buys, matched sells into realized positions, and mapped dividends, interest, deposits, withdrawals, and transfers.'
              : 'IBKR Flex report detected. Unifolio automatically mapped account details, current positions, trades, dividends, fees, FX rows, securities, and conversion-rate sections.'}
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold text-amber-400 mb-2">{errors.length} rows have issues — they will be skipped</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {errors.slice(0, 10).map((e, i) => (
              <p key={i} className="text-[11px] text-muted-foreground">Row {e.rowIndex + 2}: {e.errors.join(', ')}</p>
            ))}
            {errors.length > 10 && <p className="text-[11px] text-muted-foreground">…and {errors.length - 10} more</p>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" size="sm" onClick={onBack}><ChevronLeft className="h-3.5 w-3.5 mr-1" />Back</Button>
        <Button size="sm" onClick={onNext} disabled={valid.length === 0}>
          Continue <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── STEP 3: TRANSFER CONTEXT ─────────────────────────────────

function TransferContextStep({ parsed, onApply, onSkip, onBack }) {
  const groups = useMemo(() => buildTransferGroups(parsed), [parsed]);
  const accountOptions = useMemo(() => {
    const raw = [
      ...(parsed.importBundle?.accounts || []).map(a => a.clientAccountId || a.account_id || a.accountId || a.id),
      ...(parsed.importBundle?.transactions || []).map(t => t.account || t.account_id),
      ...(parsed.importBundle?.positions || parsed.valid || []).map(h => h.account || h.account_id),
      'Interactive Brokers',
      'Wealthsimple',
      'Charles Schwab',
      'Questrade',
    ].filter(Boolean);
    return [...new Set(raw)];
  }, [parsed]);
  const [contexts, setContexts] = useState(() => Object.fromEntries(groups.map(group => [group.id, defaultTransferContext(group)])));

  const setField = (id, field, value) => {
    setContexts(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value, skipped: false },
    }));
  };

  const apply = () => onApply(applyTransferContext(parsed, contexts));
  const skip = () => onSkip(applyTransferContext(parsed, Object.fromEntries(groups.map(group => [group.id, { ...defaultTransferContext(group), skipped: true }]))));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">We found asset/cash transfers</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tell Unifolio where they came from or went. This helps explain account movement and tax context, but transfers will not create realized gains.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-border/30 bg-secondary/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="col-span-2">Transfer</span>
          <span className="col-span-3">Source</span>
          <span className="col-span-3">Destination</span>
          <span className="col-span-4">Notes</span>
        </div>
        <div className="divide-y divide-border/20">
          {groups.map(group => {
            const ctx = contexts[group.id] || defaultTransferContext(group);
            return (
              <div key={group.id} className="grid grid-cols-12 gap-2 px-3 py-3 items-start">
                <div className="col-span-12 md:col-span-2">
                  <p className="text-xs font-medium text-foreground">{group.type}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{group.date}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {group.ticker || group.currency || 'Cash'} · {group.rows.length} row{group.rows.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="col-span-12 md:col-span-3">
                  <input
                    list="transfer-account-options"
                    value={ctx.sourceAccount}
                    onChange={e => setField(group.id, 'sourceAccount', e.target.value)}
                    placeholder="Where from?"
                    className="h-8 w-full rounded-md border border-border/50 bg-secondary px-2 text-xs text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <div className="col-span-12 md:col-span-3">
                  <input
                    list="transfer-account-options"
                    value={ctx.destinationAccount}
                    onChange={e => setField(group.id, 'destinationAccount', e.target.value)}
                    placeholder="Where to?"
                    className="h-8 w-full rounded-md border border-border/50 bg-secondary px-2 text-xs text-foreground outline-none focus:border-primary/60"
                  />
                </div>
                <div className="col-span-12 md:col-span-4">
                  <input
                    value={ctx.notes}
                    onChange={e => setField(group.id, 'notes', e.target.value)}
                    placeholder="Optional context"
                    className="h-8 w-full rounded-md border border-border/50 bg-secondary px-2 text-xs text-foreground outline-none focus:border-primary/60"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <datalist id="transfer-account-options">
        {accountOptions.map(option => <option key={option} value={option} />)}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onBack}><ChevronLeft className="h-3.5 w-3.5 mr-1" />Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={skip}>Skip for now</Button>
          <Button size="sm" onClick={apply}>Save context <ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
        </div>
      </div>
    </div>
  );
}

// ─── STEP 3: ACCOUNT HANDLING ────────────────────────────────

function AccountHandlingStep({ parsed, existingAccounts, institutions, onApply, onBack }) {
  const parsedAccounts = useMemo(() => getParsedAccounts(parsed), [parsed]);
  const initialResolutions = useMemo(() => Object.fromEntries(parsedAccounts.map((account, index) => {
    const match = findExistingAccountMatch(account, existingAccounts, institutions, parsed.broker);
    const action = match.type === 'exact' ? 'replace' : match.type === 'possible' ? 'add_separate' : 'add';
    return [account.rawAccountId, {
      rawAccountId: account.rawAccountId,
      accountType: account.accountType,
      currency: account.currency,
      action,
      matchType: match.type,
      targetAccountId: match.account?.id || '',
      targetAccountName: match.account?.account_name || '',
      importSuffix: `${Date.now()}-${index}`,
    }];
  })), [parsedAccounts, existingAccounts, institutions, parsed.broker]);
  const [resolutions, setResolutions] = useState(initialResolutions);

  const setAction = (rawId, action) => {
    setResolutions(prev => ({
      ...prev,
      [rawId]: { ...(prev[rawId] || {}), action },
    }));
  };

  const apply = () => onApply(applyAccountResolutions(parsed, Object.values(resolutions)));

  if (parsedAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border/40 bg-card/50 px-4 py-5">
          <p className="text-sm font-semibold text-foreground">No account identifiers found</p>
          <p className="mt-1 text-xs text-muted-foreground">This import will be saved to a default imported account.</p>
        </div>
        <div className="flex items-center justify-between pt-1">
          <Button variant="outline" size="sm" onClick={onBack}><ChevronLeft className="h-3.5 w-3.5 mr-1" />Back</Button>
          <Button size="sm" onClick={apply}>Continue <ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Account handling</p>
        <p className="mt-1 text-xs text-muted-foreground">
          New accounts will be added to your portfolio. If this looks like an account you already imported, choose whether to replace that account's rows or keep a separate copy.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-border/30 bg-secondary/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="col-span-4">Imported account</span>
          <span className="col-span-3">Match</span>
          <span className="col-span-5">Action</span>
        </div>
        <div className="divide-y divide-border/20">
          {parsedAccounts.map(account => {
            const resolution = resolutions[account.rawAccountId] || {};
            const isDuplicate = resolution.matchType === 'exact' || resolution.matchType === 'possible';
            return (
              <div key={account.rawAccountId} className="grid grid-cols-12 gap-2 px-3 py-3 items-center">
                <div className="col-span-12 md:col-span-4 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{account.rawAccountId}</p>
                  <p className="text-[10px] text-muted-foreground">{account.accountType} · {account.currency}</p>
                </div>
                <div className="col-span-12 md:col-span-3">
                  {isDuplicate ? (
                    <>
                      <p className="text-xs text-amber-300">{resolution.matchType === 'exact' ? 'Exact account match' : 'Possible duplicate'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{resolution.targetAccountName}</p>
                    </>
                  ) : (
                    <p className="text-xs text-emerald-300">New account</p>
                  )}
                </div>
                <div className="col-span-12 md:col-span-5 flex flex-wrap gap-2">
                  {isDuplicate ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant={resolution.action === 'replace' ? 'default' : 'outline'}
                        className="h-7 text-[11px]"
                        onClick={() => setAction(account.rawAccountId, 'replace')}
                      >
                        Replace existing
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={resolution.action === 'add_separate' ? 'default' : 'outline'}
                        className="h-7 text-[11px]"
                        onClick={() => setAction(account.rawAccountId, 'add_separate')}
                      >
                        Add separately
                      </Button>
                    </>
                  ) : (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300">Will be added</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" size="sm" onClick={onBack}><ChevronLeft className="h-3.5 w-3.5 mr-1" />Back</Button>
        <Button size="sm" onClick={apply}>Continue <ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
      </div>
    </div>
  );
}

// ─── STEP 5: CONFIRM ─────────────────────────────────────────

function ConfirmStep({ parsed, onDone, onBack }) {
  const { valid, errors, isHoldings, filename, broker, importBundle } = parsed;
  const brokerInfo = BROKER_LABELS[broker] || BROKER_LABELS.generic;
  const [imported, setImported] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const handleImport = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveParsedImport(parsed);
      // Persist a re-importable snapshot to history so users can recover the
      // data after accidentally deleting an account.
      try {
        const positions = parsed?.importBundle?.positions || parsed?.valid || [];
        const transactions = parsed?.importBundle?.transactions || (!parsed?.isHoldings ? parsed?.valid : []) || [];
        saveHistory({
          id: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          importedAt: new Date().toISOString(),
          filename: parsed?.filename || 'imported.csv',
          broker: parsed?.broker || 'generic',
          brokerName: (BROKER_LABELS[parsed?.broker]?.name) || parsed?.broker || 'Unknown broker',
          rowCount: (positions.length || 0) + (transactions.length || 0),
          isHoldings: Boolean(parsed?.isHoldings),
          data: parsed?.valid || [],
          // Snapshot the whole parsed bundle so re-import can re-run
          // `saveParsedImport(parsed)` verbatim.
          parsedSnapshot: parsed,
        });
      } catch (histErr) {
        console.warn('[ImportCenter] history snapshot failed (continuing):', histErr?.message || histErr);
      }
      setImportResult(result);
      setImported(true);
      setTimeout(() => onDone(result), 1800);
    } catch (error) {
      setSaveError(error.message || 'Failed to save import.');
    } finally {
      setSaving(false);
    }
  };

  if (imported) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
          <Check className="h-7 w-7 text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">Import synced</p>
        <p className="text-xs text-muted-foreground">
          {importResult?.holdingsSaved ?? valid.length} holdings, {importResult?.realizedSaved ?? importBundle?.realizedPositions?.length ?? 0} realized positions, and {importResult?.transactionsSaved ?? importBundle?.transactions?.length ?? 0} transactions saved to {importResult?.backend === 'local' ? 'this browser' : 'Supabase'}{importResult?.duplicatesSkipped > 0 ? ` · ${importResult.duplicatesSkipped} duplicate${importResult.duplicatesSkipped === 1 ? '' : 's'} skipped` : ''}
        </p>
        {importResult?.batchWarning && (
          <p className="text-[11px] text-amber-400 mt-2">{importResult.batchWarning}</p>
        )}
      </div>
    );
  }

  const importedTransactions = importBundle?.transactions || (!isHoldings ? valid : []);
  const realizedPositions = importBundle?.realizedPositions || [];
  const buys = importedTransactions.filter(r => r.type === 'Buy').length;
  const sells = importedTransactions.filter(r => r.type === 'Sell').length;
  const divs = importedTransactions.filter(r => r.type === 'Dividend').length;
  const other = importedTransactions.length - buys - sells - divs;

  const accounts = [...new Set(valid.map(r => r.account).filter(Boolean))];
  const tickers = [...new Set(valid.map(r => r.ticker).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/40 bg-card/50 p-5">
        <div className="flex items-center gap-3 mb-4">
          <InstitutionLogo logo={brokerInfo.logo} broker={broker} name={brokerInfo.name} size="lg" />
          <div>
            <p className="text-sm font-semibold">{filename}</p>
            <p className="text-xs text-muted-foreground">{brokerInfo.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total rows', value: valid.length },
              { label: 'Skipped', value: errors.length },
              { label: isHoldings ? 'Securities' : 'Unique tickers', value: tickers.length },
              { label: 'Accounts', value: accounts.length },
              { label: 'Realized', value: realizedPositions.length },
              { label: 'Transactions', value: importedTransactions.length },
            ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-secondary/40 p-3 text-center">
              <p className="text-lg font-bold text-foreground">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {!isHoldings && (
          <div className="flex flex-wrap gap-2 mb-4">
            {buys > 0 && <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] text-emerald-400">{buys} Buys</span>}
            {sells > 0 && <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 text-[11px] text-red-400">{sells} Sells</span>}
            {divs > 0 && <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[11px] text-blue-400">{divs} Dividends</span>}
            {other > 0 && <span className="rounded-full bg-secondary border border-border/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">{other} Other</span>}
          </div>
        )}

        {tickers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tickers.slice(0, 20).map(t => (
              <span key={t} className="rounded bg-secondary border border-border/30 px-1.5 py-0.5 text-[10px] font-mono text-foreground/70">{t}</span>
            ))}
            {tickers.length > 20 && <span className="text-[11px] text-muted-foreground self-center">+{tickers.length - 20} more</span>}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <p className="text-xs text-amber-400">
          <strong>Note:</strong> This will save normalized positions and transactions to your Supabase account.
          A local history copy is kept for quick review, but Supabase is the source of truth.
        </p>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
          <p className="text-xs text-red-300">{saveError}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button variant="outline" size="sm" onClick={onBack}><ChevronLeft className="h-3.5 w-3.5 mr-1" />Back</Button>
        <Button size="sm" onClick={handleImport} disabled={saving} className="gap-1.5">
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save & sync'}
        </Button>
      </div>
    </div>
  );
}

// ─── IMPORT HISTORY ──────────────────────────────────────────

function ImportHistory({ onNewImport }) {
  const [history, setHistory] = useState(loadHistory);
  const [reimportingId, setReimportingId] = useState(null);

  const handleDelete = (id) => {
    const updated = history.filter(h => h.id !== id);
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(updated));
    setHistory(updated);
  };

  const handleReimport = async (entry) => {
    if (reimportingId) return;
    setReimportingId(entry.id);
    try {
      // Prefer the full parsedSnapshot when available (preserves realized
      // positions, FX rates, account metadata, etc.). Fall back to a minimal
      // bundle reconstructed from the history row's flattened `data` so older
      // entries (logged before parsedSnapshot was added) can still re-import.
      const parsed = entry.parsedSnapshot || {
        valid: entry.data || [],
        errors: [],
        isHoldings: Boolean(entry.isHoldings),
        broker: entry.broker || 'generic',
        filename: entry.filename || 'imported.csv',
        importBundle: entry.isHoldings
          ? { positions: entry.data || [], transactions: [], realizedPositions: [] }
          : { positions: [], transactions: entry.data || [], realizedPositions: [] },
      };
      const result = await saveParsedImport(parsed);
      window.dispatchEvent(new CustomEvent('unifolio:portfolio-imported'));
      const summary = `Re-imported ${entry.filename}. ${result?.holdingsSaved ?? 0} holdings, ${result?.transactionsSaved ?? 0} transactions${result?.duplicatesSkipped ? ` · ${result.duplicatesSkipped} duplicates skipped` : ''}.`;
      alert(summary);
    } catch (err) {
      console.error('[ImportCenter] re-import failed:', err);
      alert(err?.message || 'Re-import failed. Please try uploading the original file again.');
    } finally {
      setReimportingId(null);
    }
  };

  const handleExport = (entry) => {
    const csv = [
      entry.isHoldings
        ? 'ticker,name,assetClass,quantity,price,avgPrice,marketValue,currency,account,institution'
        : 'date,type,ticker,name,quantity,price,grossAmount,fees,currency,account,institution,notes',
      ...entry.data.map(r => {
        const fields = entry.isHoldings
          ? [r.ticker, r.name, r.assetClass, r.quantity, r.price, r.avgPrice, r.marketValue, r.currency, r.account, r.institution]
          : [r.date, r.type, r.ticker, r.name, r.quantity, r.price, r.grossAmount, r.fees, r.currency, r.account, r.institution, r.notes];
        return fields.map(v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`).join(',');
      }),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.filename.replace('.csv', '')}-unifolio-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/50 px-6 py-10 text-center">
        <FileSpreadsheet className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No imports yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Uploaded CSVs will appear here</p>
        <Button size="sm" variant="outline" className="mt-4" onClick={onNewImport}>Upload your first file</Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Import history</p>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={onNewImport}>
          <Upload className="h-3 w-3" />New import
        </Button>
      </div>
      <div className="divide-y divide-border/20">
        {history.map(entry => (
          <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
            <InstitutionLogo
              logo={BROKER_LABELS[entry.broker]?.logo || 'generic'}
              broker={entry.broker}
              name={entry.brokerName || BROKER_LABELS[entry.broker]?.name}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{entry.filename}</p>
              <p className="text-[11px] text-muted-foreground">
                {entry.brokerName} · {entry.rowCount} rows · {entry.isHoldings ? 'Holdings' : 'Transactions'} · {new Date(entry.importedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 text-primary hover:text-primary/90 border-primary/30 hover:bg-primary/10 disabled:opacity-40"
                title="Re-import this data (useful if you deleted the account and want to restore it)"
                disabled={reimportingId === entry.id}
                onClick={() => handleReimport(entry)}
              >
                {reimportingId === entry.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RotateCcw className="h-3 w-3" />}
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Export as CSV" onClick={() => handleExport(entry)}>
                <Download className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/10" title="Remove" onClick={() => handleDelete(entry.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────

export default function ImportCenter() {
  const [step, setStep] = useState(null); // null = show history
  const [parsed, setParsed] = useState(null);
  const [importQueue, setImportQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sessionResults, setSessionResults] = useState([]);
  const [completedSession, setCompletedSession] = useState([]);
  const { accounts: existingAccounts = [], institutions = [] } = usePortfolioData();
  const hasTransfers = useMemo(() => buildTransferGroups(parsed).length > 0, [parsed]);
  // Securities Review step is gone — verifyParsedSecurities silently auto-resolves
  // via Finnhub during composeParsedImports. If a row is ever mis-classified, the
  // user can fix it inline from the Holdings page (Edit security button).

  const handleParsed = (bundles) => {
    const queue = Array.isArray(bundles) ? bundles : [bundles].filter(Boolean);
    setImportQueue(queue);
    setQueueIndex(0);
    setSessionResults([]);
    setCompletedSession([]);
    setParsed(queue[0]);
    setStep(2);
  };

  const handleUpdateMap = (field, idx) => {
    setParsed(prev => {
      const newMap = { ...prev.columnMap, [field]: idx };
      const { valid, errors } = prev.isHoldings
        ? parseHoldingsRows(prev.rawRows, prev.headers, newMap)
        : parseRows(prev.rawRows, prev.headers, newMap);
      return { ...prev, columnMap: newMap, valid, errors };
    });
  };

  const handleBack = () => {
    if (step === 2) { setParsed(null); setStep(1); }
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(2);
    else if (step === 5) setStep(4);
    else if (step === 6) setStep(hasTransfers ? 5 : 4);
    else setStep(null);
  };

  const handleGroupDone = (result) => {
    const nextResults = [...sessionResults, result].filter(Boolean);
    setSessionResults(nextResults);
    const nextIndex = queueIndex + 1;
    if (nextIndex < importQueue.length) {
      setQueueIndex(nextIndex);
      setParsed(importQueue[nextIndex]);
      setStep(2);
    } else {
      setCompletedSession(nextResults);
      setStep(null);
      setParsed(null);
      setImportQueue([]);
      setQueueIndex(0);
    }
  };

  const cancelImport = () => {
    setStep(null);
    setParsed(null);
    setImportQueue([]);
    setQueueIndex(0);
    setSessionResults([]);
    setCompletedSession([]);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Import Center"
        description="Upload CSV exports from your broker to bring holdings and transactions into Unifolio."
        actions={(
          step !== null && (
            <Button variant="outline" size="sm" onClick={cancelImport}>
              <X className="h-3.5 w-3.5 mr-1.5" />Cancel import
            </Button>
          )
        )}
      />

      {step !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/30 bg-card/40 px-4 py-3">
          <StepIndicator step={step} hasTransfers={hasTransfers} />
          {importQueue.length > 1 && (
            <span className="text-[11px] text-muted-foreground">
              Group {queueIndex + 1} of {importQueue.length}
            </span>
          )}
        </div>
      )}

      {step === null && (
        <>
          <PlaidSection />
          {completedSession.length > 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Import session complete</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {completedSession.length} group{completedSession.length === 1 ? '' : 's'} synced · {' '}
                {completedSession.reduce((sum, row) => sum + (row?.holdingsSaved || 0), 0)} holdings · {' '}
                {completedSession.reduce((sum, row) => sum + (row?.transactionsSaved || 0), 0)} transactions · {' '}
                {completedSession.reduce((sum, row) => sum + (row?.realizedSaved || 0), 0)} realized positions
              </p>
            </div>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => setStep(1)}>
            <Upload className="h-3.5 w-3.5" />
            New Import
          </Button>
          <ImportHistory onNewImport={() => setStep(1)} />
        </>
      )}

      {step === 1 && <UploadStep onParsed={handleParsed} />}

      {step === 2 && parsed && (
        <MapPreviewStep
          parsed={parsed}
          onUpdateMap={handleUpdateMap}
          onNext={() => setStep(4)}
          onBack={handleBack}
        />
      )}

      {step === 4 && parsed && (
        <AccountHandlingStep
          parsed={parsed}
          existingAccounts={existingAccounts}
          institutions={institutions}
          onApply={(nextParsed) => { setParsed(nextParsed); setStep(buildTransferGroups(nextParsed).length > 0 ? 5 : 6); }}
          onBack={handleBack}
        />
      )}

      {step === 5 && parsed && (
        <TransferContextStep
          parsed={parsed}
          onApply={(nextParsed) => { setParsed(nextParsed); setStep(6); }}
          onSkip={(nextParsed) => { setParsed(nextParsed); setStep(6); }}
          onBack={handleBack}
        />
      )}

      {step === 6 && parsed && (
          <ConfirmStep
          parsed={parsed}
          onBack={handleBack}
          onDone={handleGroupDone}
        />
      )}
    </div>
  );
}
