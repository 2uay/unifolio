import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Plus, Upload, Trash2, Loader2, Pencil, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import PageHeader from '@/components/shared/PageHeader';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { Button } from '@/components/ui/button';
import { writeAudit } from '@/lib/auditLog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AssetAppraisalModal from '@/components/accounts/AssetAppraisalModal';
import MetalsBreakdownSection from '@/components/accounts/MetalsBreakdownSection';
import NetValueSummary from '@/components/accounts/NetValueSummary';
import { useLiveData } from '@/lib/LiveDataContext';
import { safeNumber } from '@/lib/safeNum';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import InstitutionLogo from '@/components/shared/InstitutionLogo';
import { useAuth } from '@/lib/AuthContext';
import { deleteImportedAccountData } from '@/lib/dataDeletion';
import { supabase } from '@/lib/supabaseClient';
import { usePlaidItems } from '@/lib/usePlaidItems';
import PlaidReconnectButton from '@/components/plaid/PlaidReconnectButton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import usePersistentTableColumns from '@/hooks/usePersistentTableColumns';
import DraggableTableHeader, { TableColumnGrip } from '@/components/shared/DraggableTableHeader';
import { cn } from '@/lib/utils';

const ACCOUNT_TABLE_ID = 'accounts_connected_table';
const ACCOUNT_COLUMNS = [
  { id: 'name', label: 'Account', align: 'left' },
  { id: 'type', label: 'Type', align: 'left' },
  { id: 'holdings', label: 'Holdings', align: 'right' },
  { id: 'cash', label: 'Cash', align: 'right' },
  { id: 'total', label: 'Total', align: 'right' },
  { id: 'dailyPnl', label: 'Daily P&L', align: 'right' },
  { id: 'currency', label: 'Currency', align: 'left' },
  { id: 'actions', label: 'Actions', align: 'right' },
];
const DEFAULT_ACCOUNT_ORDER = ['name', 'type', 'holdings', 'cash', 'total', 'dailyPnl', 'currency', 'actions'];

const CUSTOM_ASSET_TABLE_ID = 'accounts_custom_assets_table';
const CUSTOM_ASSET_COLUMNS = [
  { id: 'asset', label: 'Asset', align: 'left' },
  { id: 'type', label: 'Type', align: 'left' },
  { id: 'gross', label: 'Chosen Value', align: 'right' },
  { id: 'liability', label: 'Liability', align: 'right' },
  { id: 'net', label: 'Net Value', align: 'right' },
  { id: 'currency', label: 'Currency', align: 'left' },
  { id: 'status', label: 'Included', align: 'left' },
  { id: 'actions', label: 'Actions', align: 'right' },
];
const DEFAULT_CUSTOM_ASSET_ORDER = ['asset', 'type', 'gross', 'liability', 'net', 'currency', 'status', 'actions'];

export default function Accounts() {
  const navigate = useNavigate();
  const { convert, displayCurrency } = useCurrency();
  const { privacyMode } = usePrivacy();
  const PM = '••••••';
  const queryClient = useQueryClient();
  const { registerTicker, liveHoldings: liveMarketData } = useLiveData();
  const { accounts, holdings, getInstitution, isEmptyPortfolio, refreshPortfolioData, calcContributionTotals } = usePortfolioData();
  const { user } = useAuth();
  const { byInternalInstitutionId, refresh: refreshPlaidItems } = usePlaidItems();
  const [accountColumnOrder, setAccountColumnOrder] = usePersistentTableColumns(ACCOUNT_TABLE_ID, DEFAULT_ACCOUNT_ORDER);
  const [customAssetColumnOrder, setCustomAssetColumnOrder] = usePersistentTableColumns(CUSTOM_ASSET_TABLE_ID, DEFAULT_CUSTOM_ASSET_ORDER);
  const safeAccounts = useMemo(() => Array.isArray(accounts) ? accounts.filter(Boolean) : [], [accounts]);
  const safeHoldings = useMemo(() => Array.isArray(holdings) ? holdings.filter(Boolean) : [], [holdings]);

  useEffect(() => {
    safeHoldings.filter(h => safeNumber(h.quantity ?? h.position) > 0).forEach(h => {
      if (!h.ticker) return;
      registerTicker(h.quote_symbol || h.ticker, h.asset_class ?? h.assetClass ?? 'stock');
    });
  }, [registerTicker, safeHoldings]);

  const liveHoldings = useMemo(() => {
    return safeHoldings.map(holding => {
      const ticker = holding.quote_symbol || holding.ticker;
      const liveData = ticker ? liveMarketData?.[ticker] : null;
      const livePrice = liveData?.price;
      if (!livePrice || safeNumber(holding.quantity ?? holding.position) <= 0) return holding;
      const quantity = safeNumber(holding.quantity ?? holding.position ?? 0);
      const avgPrice = safeNumber(holding.average_price ?? holding.avgPrice ?? livePrice);
      const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis ?? (quantity * avgPrice));
      const oldPrice = safeNumber(holding.current_price ?? holding.lastPrice ?? 0);
      const newMarketValue = quantity * livePrice;
      const previousClose = safeNumber(liveData?.previousClose ?? liveData?.previous_close, oldPrice);
      const newDailyPnl = (livePrice - previousClose) * quantity;
      return {
        ...holding,
        current_price: livePrice,
        lastPrice: livePrice,
        market_value: newMarketValue,
        marketValue: newMarketValue,
        daily_pnl_amount: newDailyPnl,
        dailyPnl: newDailyPnl,
        unrealized_gain_loss_amount: newMarketValue - costBasis,
      };
    });
  }, [safeHoldings, liveMarketData]);

  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [pendingDeleteAcc, setPendingDeleteAcc] = useState(null);
  const [deletingAcc, setDeletingAcc] = useState(false);

  const handleDeleteAccount = (acc) => setPendingDeleteAcc(acc);

  const confirmDeleteAccount = async () => {
    if (!pendingDeleteAcc) return;
    setDeletingAcc(true);
    try {
      await deleteImportedAccountData(pendingDeleteAcc.id, user?.id);
      await refreshPortfolioData?.();
    } catch (err) {
      console.error('[Accounts] delete failed:', err);
      alert(err?.message || 'Account deletion failed. Please try again.');
    } finally {
      setDeletingAcc(false);
      setPendingDeleteAcc(null);
    }
  };

  // Custom assets are stored in Supabase. Core columns hold the headline
  // values (name, type, value, currency, liability, included-in-net-value,
  // notes); the long appraisal/valuation tail (purchase_price, location,
  // appraisal_low/mid/high, etc.) lives in `metadata` jsonb so the schema
  // doesn't need to churn as the form evolves.
  //
  // We marshal in both directions so the rest of the page (table, modal,
  // NetValueSummary) keeps its existing shape.
  const fromRow = (row) => row ? ({
    ...row,
    ...(row.metadata || {}),
    asset_name: row.asset_name,
    asset_type: row.asset_type,
    estimated_value: Number(row.estimated_value) || 0,
    chosen_value: Number(row.metadata?.chosen_value ?? row.estimated_value) || 0,
    liability_amount: Number(row.liability_amount) || 0,
    currency: row.currency || 'CAD',
    include_in_net_value: row.include_in_net_value !== false,
    created_date: row.created_at,
    updated_date: row.updated_at,
  }) : null;

  const toRow = (asset) => {
    const {
      id, asset_name, asset_type, estimated_value, currency,
      liability_amount, include_in_net_value, notes,
      created_at, updated_at, created_date, updated_date,
      created_by, user_id,
      ...rest
    } = asset || {};
    return {
      asset_name: asset_name || '',
      asset_type: asset_type || 'Other',
      estimated_value: Number(estimated_value) || 0,
      currency: currency || 'CAD',
      liability_amount: Number(liability_amount) || 0,
      include_in_net_value: include_in_net_value !== false,
      notes: notes || null,
      metadata: rest,
    };
  };

  const { data: customAssetsRaw = [] } = useQuery({
    queryKey: ['customAssets', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Belt-and-braces user_id filter. Supabase RLS should already scope
      // these rows to the current user, but an explicit filter prevents
      // accidental data leakage if RLS policies are ever weakened or
      // migrated incorrectly.
      const { data, error } = await supabase
        .from('custom_assets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[Accounts] custom_assets fetch failed:', error.message);
        return [];
      }
      return (Array.isArray(data) ? data : []).map(fromRow).filter(Boolean);
    },
  });
  const customAssets = Array.isArray(customAssetsRaw) ? customAssetsRaw.filter(Boolean) : [];

  const saveMutation = useMutation({
    mutationFn: async (asset) => {
      if (!user?.id) throw new Error('Sign in to save custom assets.');
      const row = toRow(asset);
      if (asset?.id) {
        const { data, error } = await supabase
          .from('custom_assets')
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq('id', asset.id)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) throw error;
        writeAudit('custom_asset_updated', { id: asset.id });
        return fromRow(data);
      }
      const { data, error } = await supabase
        .from('custom_assets')
        .insert({ ...row, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      writeAudit('custom_asset_created', { id: data?.id, asset_type: row.asset_type });
      return fromRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customAssets'] });
      setShowModal(false);
      setEditingAsset(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      if (!user?.id) throw new Error('Sign in to delete custom assets.');
      const { error } = await supabase
        .from('custom_assets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      writeAudit('custom_asset_deleted', { id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customAssets'] }),
  });

  const handleSave = (asset) => saveMutation.mutate(editingAsset ? { ...editingAsset, ...asset } : asset);
  const handleEdit = (asset) => { setEditingAsset(asset); setShowModal(true); };

  // Inline editing of account type (TFSA/RRSP/etc) so users can override
  // when an importer mis-classifies an account.
  const ACCOUNT_TYPE_OPTIONS = [
    'TFSA', 'RRSP', 'RESP', 'RDSP', 'FHSA', 'LIRA',
    'Cash', 'Margin', 'Joint', 'Individual',
    'Roth IRA', 'IRA', '401(k)', 'Brokerage',
  ];
  const [editingAccountTypeId, setEditingAccountTypeId] = useState(null);
  const [savingAccountTypeId, setSavingAccountTypeId] = useState(null);
  const handleAccountTypeChange = async (accountId, newType) => {
    setSavingAccountTypeId(accountId);
    setEditingAccountTypeId(null);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ account_type: newType, updated_at: new Date().toISOString() })
        .eq('id', accountId);
      if (error) throw error;
      await refreshPortfolioData?.();
    } catch (err) {
      console.error('[Accounts] failed to update account type:', err);
      alert(err?.message || 'Could not update account type. Please try again.');
    } finally {
      setSavingAccountTypeId(null);
    }
  };
  const handleCloseModal = () => { setShowModal(false); setEditingAsset(null); };

  const grouped = useMemo(() => {
    const groups = {};
    safeAccounts.forEach(acc => {
      const instId = acc.institution_id ?? acc.institutionId;
      if (!instId) return;
      if (!groups[instId]) groups[instId] = [];
      groups[instId].push(acc);
    });
    return groups;
  }, [safeAccounts]);

  const typeTotals = useMemo(() => {
    const totals = {};
    safeAccounts.forEach(acc => {
      const type = acc.account_type ?? acc.type ?? 'Account';
      const accountHoldings = liveHoldings.filter(h => (h.account_id ?? h.accountId) === acc.id && safeNumber(h.quantity) > 0);
      const holdingsValue = accountHoldings.reduce((sum, h) => sum + convert(safeNumber(h.market_value ?? h.marketValue ?? 0), h.currency || 'USD'), 0);
      const cashValue = convert(safeNumber(acc.cash_balance ?? acc.cashBalance ?? 0), acc.base_currency || 'CAD');
      totals[type] = (totals[type] || 0) + holdingsValue + cashValue;
    });
    return totals;
  }, [safeAccounts, liveHoldings, convert, displayCurrency]);

  const investmentTotal = useMemo(() => Object.values(typeTotals).reduce((s, v) => s + v, 0), [typeTotals]);
  const contributionTotals = calcContributionTotals();
  const convertedDeposited = useMemo(() => Object.entries(contributionTotals.byCurrency || {}).reduce((sum, [currency, value]) => (
    sum + convert(safeNumber(value.deposited), currency)
  ), 0), [contributionTotals, convert, displayCurrency]);
  const convertedNetContributions = useMemo(() => Object.entries(contributionTotals.byCurrency || {}).reduce((sum, [currency, value]) => (
    sum + convert(safeNumber(value.deposited) - safeNumber(value.withdrawn), currency)
  ), 0), [contributionTotals, convert, displayCurrency]);

  const includedAssets = customAssets.filter(a => a.include_in_net_value !== false);
  const customAssetsGross = useMemo(() => includedAssets.reduce((s, a) => s + convert(a.chosen_value || 0, a.currency || 'USD'), 0), [includedAssets, convert, displayCurrency]);
  const customAssetsLiability = useMemo(() => includedAssets.reduce((s, a) => s + convert(a.liability_amount || 0, a.currency || 'USD'), 0), [includedAssets, convert, displayCurrency]);
  const customAssetsNet = useMemo(() => includedAssets.reduce((s, a) => s + convert(a.net_value || 0, a.currency || 'USD'), 0), [includedAssets, convert, displayCurrency]);

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-6">
        <PageHeader title="Accounts" description="Connected accounts and custom assets" />
        <EmptyPortfolioState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Connected accounts and custom assets"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/import')} className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Import CSV
            </Button>
            <Button size="sm" onClick={() => { setEditingAsset(null); setShowModal(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Custom Asset
            </Button>
          </div>
        }
      />

      <NetValueSummary
        investmentTotal={investmentTotal}
        customAssetsGross={customAssetsGross}
        customAssetsLiability={customAssetsLiability}
        customAssetsNet={customAssetsNet}
        customAssetsCount={customAssets.length}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Deposited</p>
          <p className="text-lg font-bold font-mono mt-1">{privacyMode ? PM : formatCurrency(convertedDeposited)}</p>
          <p className="text-xs text-muted-foreground mt-1">External cash in</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Contributions</p>
          <p className="text-lg font-bold font-mono mt-1">{privacyMode ? PM : formatCurrency(convertedNetContributions)}</p>
          <p className="text-xs text-muted-foreground mt-1">Deposits minus withdrawals</p>
        </div>
        {Object.entries(typeTotals).slice(0, 2).map(([type, total]) => (
          <div key={type} className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{type}</p>
            <p className="text-lg font-bold font-mono mt-1">{privacyMode ? PM : formatCurrency(total)}</p>
            <p className="text-xs text-muted-foreground mt-1">{safeAccounts.filter(a => (a.account_type ?? a.type ?? 'Account') === type).length} account(s)</p>
          </div>
        ))}
      </div>

      {Object.entries(grouped).map(([instId, accs]) => {
        const inst = getInstitution(instId);
        const plaidItem = byInternalInstitutionId?.[instId];
        const itemStatus = plaidItem?.status;
        const itemNeedsAttention = itemStatus && itemStatus !== 'active';
        const errorCopy = itemStatus === 'login_required'
          ? 'Your bank requires you to sign in again to keep this connection active.'
          : itemStatus === 'pending_expiration'
          ? 'This connection will expire soon. Reconnect to keep your data syncing.'
          : 'This connection is in an error state and stopped syncing.';
        return (
          <div key={instId} className="rounded-2xl border border-border bg-card/70 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-4">
              <div className="flex items-center gap-3">
                <InstitutionLogo institution={inst} id={instId} size="lg" />
                <div>
                  <h2 className="font-semibold">{inst?.name}</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last synced: {(inst?.last_sync_time ?? inst?.lastSync) ? new Date(inst.last_sync_time ?? inst.lastSync).toLocaleString() : 'Never'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{accs.length} connected account{accs.length === 1 ? '' : 's'}</p>
            </div>

            {itemNeedsAttention && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <div className="flex items-start gap-2 text-amber-200">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium">{itemStatus === 'pending_expiration' ? 'Connection expiring soon' : 'Connection needs attention'}</p>
                    <p className="text-amber-200/80">{errorCopy}</p>
                  </div>
                </div>
                <PlaidReconnectButton
                  itemId={plaidItem.item_id}
                  onReconnected={() => { refreshPortfolioData?.(); refreshPlaidItems?.(); }}
                />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <DraggableTableHeader
                  columns={ACCOUNT_COLUMNS}
                  orderedColumnIds={accountColumnOrder}
                  onOrderChange={setAccountColumnOrder}
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
                  {accs.map(acc => {
                    const nativeCurrency = acc.base_currency || 'CAD';
                    const accHoldings = liveHoldings.filter(h => (h.account_id ?? h.accountId) === acc.id && safeNumber(h.quantity) > 0);
                    const holdingsValueNative = accHoldings.reduce((sum, h) => sum + safeNumber(h.market_value ?? h.marketValue ?? 0), 0);
                    const totalValueNative = holdingsValueNative + safeNumber(acc.cash_balance ?? acc.cashBalance ?? 0);
                    const dailyPnlNative = accHoldings.reduce((sum, h) => sum + safeNumber(h.daily_pnl_amount ?? h.dailyPnl ?? 0), 0);
                    const convertedTotal = convert(totalValueNative, nativeCurrency);
                    const convertedHoldings = convert(holdingsValueNative, nativeCurrency);
                    const convertedCash = convert(acc.cash_balance ?? acc.cashBalance ?? 0, nativeCurrency);
                    const convertedDailyPnl = convert(dailyPnlNative, nativeCurrency);

                    return (
                      <tr key={acc.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                        {accountColumnOrder.map((columnId) => {
                          const align = ACCOUNT_COLUMNS.find(col => col.id === columnId)?.align === 'right' ? 'text-right' : 'text-left';
                          if (columnId === 'name') {
                            return (
                              <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 ${align}`}>
                                <div>
                                  <p className="text-sm font-medium">{acc.account_name || `${acc.account_type ?? acc.type} Account`}</p>
                                  <p className="text-[11px] text-muted-foreground">{inst?.country ? `${inst.country} institution` : 'Connected account'}</p>
                                </div>
                              </td>
                            );
                          }
                          if (columnId === 'type') return (
                            <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 ${align}`}>
                              {editingAccountTypeId === acc.id ? (
                                <select
                                  autoFocus
                                  defaultValue={acc.account_type ?? acc.type ?? 'Brokerage'}
                                  disabled={savingAccountTypeId === acc.id}
                                  onBlur={() => setEditingAccountTypeId(null)}
                                  onChange={(e) => handleAccountTypeChange(acc.id, e.target.value)}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-card border border-primary/40 text-foreground font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  {ACCOUNT_TYPE_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                  {/* Preserve current type if it's not in our list */}
                                  {!ACCOUNT_TYPE_OPTIONS.includes(acc.account_type ?? acc.type) && (acc.account_type ?? acc.type) && (
                                    <option value={acc.account_type ?? acc.type}>{acc.account_type ?? acc.type}</option>
                                  )}
                                </select>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingAccountTypeId(acc.id)}
                                  title="Click to change account type (e.g. TFSA, RRSP)"
                                  className="group inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 hover:ring-1 hover:ring-primary/40 transition-all cursor-pointer"
                                >
                                  {savingAccountTypeId === acc.id
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : (acc.account_type ?? acc.type ?? '—')}
                                  <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                                </button>
                              )}
                            </td>
                          );
                          if (columnId === 'holdings') return <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 font-mono ${align}`}>{privacyMode ? PM : formatCurrency(convertedHoldings)}</td>;
                          if (columnId === 'cash') return <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 font-mono ${align}`}>{privacyMode ? PM : formatCurrency(convertedCash)}</td>;
                          if (columnId === 'total') return <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 font-mono font-semibold ${align}`}>{privacyMode ? PM : formatCurrency(convertedTotal)}</td>;
                          if (columnId === 'dailyPnl') return <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 ${align}`}><PnlValue value={convertedDailyPnl} className="justify-end" /></td>;
                          if (columnId === 'currency') return <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 ${align}`}><span className="font-mono text-xs">{nativeCurrency}</span></td>;
                          if (columnId === 'actions') {
                            return (
                              <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 ${align}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs text-destructive/80 hover:text-destructive"
                                  onClick={() => handleDeleteAccount(acc)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Remove
                                </Button>
                              </td>
                            );
                          }
                          return <td key={`${acc.id}-${columnId}`} className={`px-4 py-3 ${align}`}>—</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {customAssets.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/70 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-4">
            <div>
              <h2 className="font-semibold">Custom Assets</h2>
              <p className="text-xs text-muted-foreground">Manually tracked assets, cards, metals, and private holdings.</p>
            </div>
            <p className="text-xs text-muted-foreground">{customAssets.length} asset{customAssets.length === 1 ? '' : 's'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <DraggableTableHeader
                columns={CUSTOM_ASSET_COLUMNS}
                orderedColumnIds={customAssetColumnOrder}
                onOrderChange={setCustomAssetColumnOrder}
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
                {customAssets.map((asset) => (
                  <tr key={asset.id} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                    {customAssetColumnOrder.map((columnId) => {
                      const align = CUSTOM_ASSET_COLUMNS.find(col => col.id === columnId)?.align === 'right' ? 'text-right' : 'text-left';
                      if (columnId === 'asset') {
                        return (
                          <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 ${align}`}>
                            <div>
                              <p className="text-sm font-medium">{asset.asset_name}</p>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">{asset.location || asset.description || 'Custom tracked asset'}</p>
                            </div>
                          </td>
                        );
                      }
                      if (columnId === 'type') return <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 ${align}`}>{asset.asset_type}</td>;
                      if (columnId === 'gross') return <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 font-mono ${align}`}>{privacyMode ? PM : formatCurrency(convert(asset.chosen_value || 0, asset.currency || 'USD'))}</td>;
                      if (columnId === 'liability') return <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 font-mono ${align}`}>{privacyMode ? PM : formatCurrency(convert(asset.liability_amount || 0, asset.currency || 'USD'))}</td>;
                      if (columnId === 'net') return <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 font-mono font-semibold ${align}`}>{privacyMode ? PM : formatCurrency(convert(asset.net_value || 0, asset.currency || 'USD'))}</td>;
                      if (columnId === 'currency') return <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 ${align}`}><span className="font-mono text-xs">{asset.currency || 'USD'}</span></td>;
                      if (columnId === 'status') return <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 ${align}`}><span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', asset.include_in_net_value !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-secondary text-muted-foreground')}>{asset.include_in_net_value !== false ? 'Included' : 'Excluded'}</span></td>;
                      if (columnId === 'actions') {
                        return (
                          <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 ${align}`}>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleEdit(asset)}>
                                <Pencil className="w-3 h-3" />
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-destructive/80 hover:text-destructive" onClick={() => deleteMutation.mutate(asset.id)}>
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        );
                      }
                      return <td key={`${asset.id}-${columnId}`} className={`px-4 py-3 ${align}`}>—</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <MetalsBreakdownSection customAssets={customAssets} />

      {showModal && (
        <AssetAppraisalModal
          onClose={handleCloseModal}
          onSave={handleSave}
          initialData={editingAsset}
        />
      )}

      <AlertDialog open={Boolean(pendingDeleteAcc)} onOpenChange={(open) => !open && setPendingDeleteAcc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the imported account, its holdings, realized positions, and transactions from your portfolio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAcc}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAccount} disabled={deletingAcc} className="bg-destructive hover:bg-destructive/90">
              {deletingAcc ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
