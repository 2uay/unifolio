import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Wallet, Hash, Plus, Upload, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import PageHeader from '@/components/shared/PageHeader';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AssetAppraisalModal from '@/components/accounts/AssetAppraisalModal';
import CustomAssetCard from '@/components/accounts/CustomAssetCard';
import MetalsBreakdownSection from '@/components/accounts/MetalsBreakdownSection';
import NetValueSummary from '@/components/accounts/NetValueSummary';
import { useLiveData } from '@/lib/LiveDataContext';
import { safeNumber } from '@/lib/safeNum';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import { supabase } from '@/lib/supabaseClient';
import { IMPORT_PORTFOLIO_KEY } from '@/lib/importPersistence';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Accounts() {
  const navigate = useNavigate();
  const { convert, displayCurrency } = useCurrency();
  const { privacyMode } = usePrivacy();
  const PM = '••••••';
  const queryClient = useQueryClient();
  const { registerTicker, liveHoldings: liveMarketData } = useLiveData();
  const { accounts, holdings, getInstitution, calcAccountValue, isEmptyPortfolio, refreshPortfolioData } = usePortfolioData();
  const safeAccounts = useMemo(() => Array.isArray(accounts) ? accounts.filter(Boolean) : [], [accounts]);
  const safeHoldings = useMemo(() => Array.isArray(holdings) ? holdings.filter(Boolean) : [], [holdings]);

  // Register tickers
  useEffect(() => {
    safeHoldings.filter(h => safeNumber(h.quantity ?? h.position) > 0).forEach(h => {
      if (!h.ticker) return;
      registerTicker(h.ticker, h.asset_class ?? h.assetClass ?? 'stock');
    });
  }, [registerTicker, safeHoldings]);

  // Use live-updated holdings for account values with recalculated dependent values
  const liveHoldings = useMemo(() => {
    return safeHoldings.map(holding => {
      const ticker = holding.ticker;
      const liveData = ticker ? liveMarketData?.[ticker] : null;
      const livePrice = liveData?.price;
      
      if (!livePrice || safeNumber(holding.quantity ?? holding.position) <= 0) return holding;

      const quantity = safeNumber(holding.quantity ?? holding.position ?? 0);
      const avgPrice = safeNumber(holding.average_price ?? holding.avgPrice ?? livePrice);
      const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis ?? (quantity * avgPrice));
      const oldPrice = safeNumber(holding.current_price ?? holding.lastPrice ?? 0);

      const newMarketValue = quantity * livePrice;
      const newUnrealizedGainLoss = newMarketValue - costBasis;
      const previousClose = safeNumber(liveData?.previousClose ?? liveData?.previous_close, oldPrice);
      const newDailyPnl = (livePrice - previousClose) * quantity;

      return {
        ...holding,
        current_price: livePrice,
        lastPrice: livePrice,
        market_value: newMarketValue,
        marketValue: newMarketValue,
        unrealized_gain_loss_amount: newUnrealizedGainLoss,
        unrealizedAmt: newUnrealizedGainLoss,
        daily_pnl_amount: newDailyPnl,
        dailyPnl: newDailyPnl,
        sparkline: liveData?.sparkline || holding.sparkline,
        price_source: liveData?.priceSource ?? holding.price_source,
        valuation_status: liveData?.valuationStatus ?? holding.valuation_status,
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
      const accId = pendingDeleteAcc.id;
      await supabase.from('holdings').delete().eq('account_id', accId);
      await supabase.from('transactions').delete().eq('account_id', accId);
      await supabase.from('realized_positions').delete().eq('account_id', accId).then(() => {});
      await supabase.from('import_batches').delete().eq('account_id', accId).then(() => {});
      await supabase.from('accounts').delete().eq('id', accId);

      try {
        const raw = localStorage.getItem(IMPORT_PORTFOLIO_KEY);
        if (raw) {
          const bundle = JSON.parse(raw);
          bundle.accounts     = (bundle.accounts     || []).filter(a => a.id !== accId);
          bundle.holdings     = (bundle.holdings     || []).filter(h => (h.account_id ?? h.accountId) !== accId);
          bundle.transactions = (bundle.transactions || []).filter(t => (t.account_id ?? t.accountId) !== accId);
          localStorage.setItem(IMPORT_PORTFOLIO_KEY, JSON.stringify(bundle));
        }
      } catch { /* ignore */ }

      await refreshPortfolioData?.();
    } catch (err) {
      console.error('[Accounts] delete failed:', err);
    } finally {
      setDeletingAcc(false);
      setPendingDeleteAcc(null);
    }
  };

  // ── Custom assets from DB ──────────────────────────────────────
  const { data: customAssetsRaw = [], isLoading: customAssetsLoading, isError: customAssetsError } = useQuery({
    queryKey: ['customAssets'],
    queryFn: async () => {
      try {
        const list = await base44?.entities?.CustomAsset?.list?.('-created_date');
        return Array.isArray(list) ? list : [];
      } catch (err) {
        console.warn('[Accounts] custom assets unavailable:', err?.message || err);
        return [];
      }
    },
  });
  const customAssets = Array.isArray(customAssetsRaw) ? customAssetsRaw.filter(Boolean) : [];

  const saveMutation = useMutation({
    mutationFn: (asset) => {
      if (!base44?.entities?.CustomAsset) throw new Error('Custom assets service unavailable');
      if (asset.id) {
        const { id, created_date, updated_date, created_by, ...data } = asset;
        return base44.entities.CustomAsset.update(id, data);
      }
      return base44.entities.CustomAsset.create(asset);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customAssets'] });
      setShowModal(false);
      setEditingAsset(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (!base44?.entities?.CustomAsset) throw new Error('Custom assets service unavailable');
      return base44.entities.CustomAsset.delete(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customAssets'] }),
  });

  const handleSave = (asset) => saveMutation.mutate(editingAsset ? { ...editingAsset, ...asset } : asset);
  const handleEdit = (asset) => { setEditingAsset(asset); setShowModal(true); };
  const handleCloseModal = () => { setShowModal(false); setEditingAsset(null); };

  // ── Investment account totals ─────────────────────────────────
  const grouped = useMemo(() => {
    const g = {};
    safeAccounts.forEach(acc => {
      if (!acc?.id) return;
      const instId = acc.institution_id ?? acc.institutionId;
      if (!instId) return;
      if (!g[instId]) g[instId] = [];
      g[instId].push(acc);
    });
    return g;
  }, [safeAccounts]);

  const typeTotals = useMemo(() => {
    const t = {};
    safeAccounts.forEach(acc => {
      if (!acc?.id) return;
      const type = acc.account_type ?? acc.type ?? 'Account';
      const nativeValue = calcAccountValue(acc.id);
      const nativeCurrency = acc.base_currency || 'CAD';
      t[type] = (t[type] || 0) + convert(nativeValue, nativeCurrency);
    });
    return t;
  }, [safeAccounts, calcAccountValue, convert, displayCurrency]);

  const investmentTotal = useMemo(() =>
    Object.values(typeTotals).reduce((s, v) => s + v, 0),
    [typeTotals]);

  // ── Custom asset totals (convert each to display currency) ────
  const includedAssets = customAssets.filter(a => a.include_in_net_value !== false);
  const customAssetsGross = useMemo(() =>
    includedAssets.reduce((s, a) => s + convert(a.estimated_value || 0, a.currency || 'USD'), 0),
    [includedAssets, convert, displayCurrency]);
  const customAssetsLiability = useMemo(() =>
    includedAssets.reduce((s, a) => s + convert(a.liability_amount || 0, a.currency || 'USD'), 0),
    [includedAssets, convert, displayCurrency]);
  const customAssetsNet = useMemo(() =>
    includedAssets.reduce((s, a) => s + convert(a.net_value || 0, a.currency || 'USD'), 0),
    [includedAssets, convert, displayCurrency]);

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
            <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Custom Asset
            </Button>
          </div>
        }
      />

      {/* Net Value Summary */}
      <NetValueSummary
        investmentTotal={investmentTotal}
        customAssetsGross={customAssetsGross}
        customAssetsLiability={customAssetsLiability}
        customAssetsNet={customAssetsNet}
        customAssetsCount={customAssets.length}
      />

      {/* Account Type Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.entries(typeTotals).map(([type, total]) => {
          const count = safeAccounts.filter(a => (a.account_type ?? a.type ?? 'Account') === type).length;
          return (
            <div key={type} className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{type} Total</p>
              <p className="text-lg font-bold font-mono mt-1">{privacyMode ? PM : formatCurrency(total)}</p>
              <p className="text-xs text-muted-foreground mt-1">{count} account{count > 1 ? 's' : ''}</p>
            </div>
          );
        })}
      </div>

      {/* Grouped by Institution */}
      {Object.entries(grouped).map(([instId, accs]) => {
        const inst = getInstitution(instId);
        return (
          <div key={instId} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{inst?.logo}</span>
              <div>
                <h2 className="font-semibold">{inst?.name}</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last synced: {(inst?.last_sync_time ?? inst?.lastSync) ? new Date(inst.last_sync_time ?? inst.lastSync).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accs.map(acc => {
                const nativeCurrency = acc.base_currency || 'CAD';
                const accHoldings = liveHoldings.filter(h => (h.account_id ?? h.accountId) === acc.id && h.quantity > 0);
                const holdingsValueNative = accHoldings.reduce((sum, h) => sum + safeNumber(h.market_value ?? h.marketValue ?? 0), 0);
                const totalValueNative = holdingsValueNative + (acc.cash_balance ?? acc.cashBalance ?? 0);
                const dailyPnlNative = accHoldings.reduce((sum, h) => sum + safeNumber(h.daily_pnl_amount ?? h.dailyPnl ?? 0), 0);

                const convertedTotal = convert(totalValueNative, nativeCurrency);
                const convertedHoldings = convert(holdingsValueNative, nativeCurrency);
                const convertedDailyPnl = convert(dailyPnlNative, nativeCurrency);
                const showConversion = nativeCurrency !== displayCurrency;
                
                // International account indicator
                const instCountry = inst?.country;
                const isInternational = instCountry && instCountry !== 'CA';

                return (
                  <div key={acc.id} className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{acc.account_type ?? acc.type}</span>
                          {isInternational && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
                              US Account
                            </span>
                          )}
                        </div>
                        <p className="text-2xl font-bold font-mono mt-2">{privacyMode ? PM : formatCurrency(convertedTotal)}</p>
                        {showConversion && <p className="text-xs text-muted-foreground">{displayCurrency} equivalent</p>}
                        {showConversion && !privacyMode && (
                          <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">
                            {formatCurrency(totalValueNative)} {nativeCurrency} native
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 ml-2 flex-shrink-0">
                        {showConversion && (
                          <span className="text-[10px] text-muted-foreground/50">{nativeCurrency} → {displayCurrency}</span>
                        )}
                        <button
                          onClick={() => handleDeleteAccount(acc)}
                          title="Delete account"
                          className="p-1 rounded text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" /> Holdings</span>
                        <div className="text-right">
                          <span className="font-mono">{privacyMode ? PM : formatCurrency(convertedHoldings)}</span>
                          {showConversion && !privacyMode && (
                            <p className="text-[10px] text-muted-foreground/50 font-mono">{formatCurrency(holdingsValueNative)} {nativeCurrency}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cash</span>
                        <span className="font-mono">{privacyMode ? PM : formatCurrency(convert(acc.cash_balance ?? acc.cashBalance ?? 0, nativeCurrency))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Positions</span>
                        <span className="font-mono">{accHoldings.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Daily P&L</span>
                        <PnlValue value={convertedDailyPnl} className="text-xs" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Precious Metals Breakdown Section */}
      {customAssets.some(a => a.asset_type === 'Precious Metals') && (
        <div className="space-y-3">
          <h2 className="font-semibold">Precious Metals Portfolio</h2>
          <MetalsBreakdownSection customAssets={customAssets} />
        </div>
      )}

      {/* Custom Assets Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">All Custom Assets</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Manually tracked assets like property, vehicles, and more</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowModal(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Asset
          </Button>
        </div>

        {customAssets.length === 0 ? (
          <div className="bg-card rounded-xl border border-border border-dashed p-10 text-center">
            <p className="text-sm text-muted-foreground">No custom assets added yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Track real estate, vehicles, precious metals, and more.</p>
            <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add your first custom asset
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customAssets.filter(a => a.asset_type !== 'Precious Metals').map(asset => (
              <CustomAssetCard
                key={asset.id}
                asset={asset}
                onEdit={handleEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <AssetAppraisalModal
          onClose={handleCloseModal}
          onSave={handleSave}
          initialData={editingAsset}
        />
      )}

      {/* Confirm account delete dialog */}
      <AlertDialog open={!!pendingDeleteAcc} onOpenChange={(open) => { if (!open && !deletingAcc) setPendingDeleteAcc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the
              <strong className="text-foreground"> {pendingDeleteAcc?.account_type ?? pendingDeleteAcc?.type} </strong>
              account and all its holdings, transactions, and import history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAcc}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAccount}
              disabled={deletingAcc}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingAcc ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Deleting…</> : 'Yes, delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
