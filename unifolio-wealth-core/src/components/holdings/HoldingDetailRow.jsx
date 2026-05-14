import React, { useMemo, useState } from 'react';
import { Pencil, Check, X as XIcon } from 'lucide-react';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { safeNumber } from '@/lib/safeNum';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { calcTrueExposure } from '@/lib/etfOverlapEngine';
import { normalizeTicker } from '@/lib/etfHoldings';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';

export default function HoldingDetailRow({ holding, allHoldings, portfolioTotal }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const { getAccount, getInstitutionForAccount } = usePortfolioData();
  const nativeCurrency = holding.currency || 'USD';

  // Inline security-identity editor — for when an importer mis-classified a
  // row (e.g. tagged the underlying as a CDR or vice versa). The user can
  // toggle exchange/currency/identity right from the expanded row and we
  // persist the change to Supabase.
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityDraft, setIdentityDraft] = useState({
    listing_exchange: holding.listing_exchange || holding.exchange || '',
    listing_currency: holding.listing_currency || holding.currency || 'USD',
    security_identity: holding.security_identity || 'us',
  });
  const saveIdentity = async () => {
    if (!holding.id) { setEditingIdentity(false); return; }
    setSavingIdentity(true);
    try {
      const isCdr = identityDraft.security_identity === 'cdr';
      const baseTicker = String(holding.underlying_ticker || holding.ticker || '').toUpperCase().replace(/\.(NE|NEO|TO|TSX)$/i, '').replace(/\s+CDR$/i, '');
      const quoteSymbol = isCdr ? `${baseTicker}.NE` : baseTicker;
      const display = isCdr ? `${baseTicker} CDR` : baseTicker;
      const { error } = await supabase
        .from('holdings')
        .update({
          listing_exchange: identityDraft.listing_exchange,
          listing_currency: identityDraft.listing_currency,
          security_identity: identityDraft.security_identity,
          quote_symbol: quoteSymbol,
          display_ticker: display,
          ticker: display,
          security_key: `${baseTicker}@${identityDraft.listing_exchange || 'UNKNOWN'}:${identityDraft.listing_currency}`,
          identity_confidence: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', holding.id);
      if (error) throw error;
      // Reload-on-event so the breakdown/holdings table picks up the change
      window.dispatchEvent(new CustomEvent('unifolio:portfolio-imported'));
      setEditingIdentity(false);
    } catch (err) {
      console.error('[HoldingDetailRow] failed to update identity:', err);
      alert(err?.message || 'Could not update security. Please try again.');
    } finally {
      setSavingIdentity(false);
    }
  };
  const PM = '••••••';
  const acc = getAccount(holding.account_id ?? holding.accountId);
  const inst = getInstitutionForAccount(holding.account_id ?? holding.accountId);
  const unrealizedAmt = safeNumber(holding.unrealized_gain_loss_amount ?? holding.unrealizedAmt);
  const marketValue   = safeNumber(holding.market_value ?? holding.marketValue);
  const currentPrice  = safeNumber(holding.current_price ?? holding.lastPrice ?? 0);

  // Prefer engine-reconstructed lots when present — they include transfer-in
  // lots (flagged `is_transfer`) that the legacy `purchase_history` array
  // misses. Falls back to the legacy field when the transaction engine is
  // disabled or the row is from a pure-holdings-snapshot import.
  const engineLots = Array.isArray(holding._engine_lots) ? holding._engine_lots : null;
  const purchaseHistory = engineLots
    ? engineLots.map(l => ({
        date: l.date,
        quantity: l.qty,
        qty: l.qty,
        price: l.clean_price ?? l.price,
        currency: holding.currency,
        isTransfer: !!l.is_transfer,
        linkedSource: l.linked_source || null,
        transferDate: l.transfer_date || null,
      }))
    : (holding.purchase_history ?? holding.purchaseHistory ?? []);

  const overlapRow = useMemo(() => {
    if (!allHoldings?.length || !portfolioTotal) return null;
    const rows = calcTrueExposure(allHoldings, portfolioTotal, convert);
    const thisTicker = normalizeTicker(holding.ticker);
    return rows.find(r => normalizeTicker(r.ticker) === thisTicker) || null;
  }, [allHoldings, portfolioTotal, convert, holding.ticker]);

  const Dot = () => <span className="text-border/60 select-none">·</span>;

  return (
    <tr>
      <td colSpan={100} className="p-0">
        <div className="bg-secondary/10 border-b border-border px-4 py-2 space-y-1.5">

          {/* Single dense stat row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px] font-medium shrink-0">Position</span>
            <Dot />
            <span className="text-muted-foreground">Mkt Val <span className="font-mono text-foreground">{privacyMode ? PM : formatCurrency(convert(marketValue, nativeCurrency))}</span></span>
            <Dot />
            <span className="text-muted-foreground">Cost <span className="font-mono text-foreground">{privacyMode ? PM : formatCurrency(convert(safeNumber(holding.cost_basis ?? holding.costBasis), nativeCurrency))}</span></span>
            <Dot />
            <span className="text-muted-foreground">Unreal. <PnlValue value={convert(unrealizedAmt, nativeCurrency)} className="inline" /></span>
            <Dot />
            <span className="text-muted-foreground">Real. <PnlValue value={convert(safeNumber(holding.realized_gain_loss_amount ?? holding.realizedGain), nativeCurrency)} className="inline" /></span>
            <Dot />
            {(acc?.account_type ?? acc?.type) && <span className="text-primary font-medium">{acc?.account_type ?? acc?.type}</span>}
            {(acc?.account_type ?? acc?.type) && <Dot />}
            {inst?.name && <span className="text-muted-foreground">{inst.name}</span>}
            {inst?.name && <Dot />}
            {holding.currency && <span className="text-muted-foreground">{holding.currency}</span>}
            {(holding.asset_class ?? holding.assetClass) && <><Dot /><span className="text-muted-foreground">{holding.asset_class ?? holding.assetClass}</span></>}
            {holding.sector && <><Dot /><span className="text-muted-foreground">{holding.sector}</span></>}
            <Dot />
            {editingIdentity ? (
              <span className="inline-flex items-center gap-1.5 ml-auto">
                <select
                  value={identityDraft.security_identity}
                  onChange={(e) => setIdentityDraft(d => ({ ...d, security_identity: e.target.value }))}
                  disabled={savingIdentity}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border text-foreground"
                >
                  <option value="us">US listing</option>
                  <option value="tsx">TSX native</option>
                  <option value="cdr">CDR (CAD-hedged)</option>
                </select>
                <select
                  value={identityDraft.listing_exchange}
                  onChange={(e) => setIdentityDraft(d => ({ ...d, listing_exchange: e.target.value }))}
                  disabled={savingIdentity}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border text-foreground"
                >
                  <option value="">—</option>
                  <option value="NYSE">NYSE</option>
                  <option value="NASDAQ">NASDAQ</option>
                  <option value="TSX">TSX</option>
                  <option value="NEO">Cboe Canada (NEO)</option>
                  <option value="TSXV">TSXV</option>
                </select>
                <select
                  value={identityDraft.listing_currency}
                  onChange={(e) => setIdentityDraft(d => ({ ...d, listing_currency: e.target.value }))}
                  disabled={savingIdentity}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border text-foreground"
                >
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                </select>
                <button onClick={saveIdentity} disabled={savingIdentity}
                  className="p-1 rounded bg-primary/15 hover:bg-primary/25 text-primary disabled:opacity-40"
                  title="Save"
                ><Check className="w-3 h-3" /></button>
                <button onClick={() => setEditingIdentity(false)} disabled={savingIdentity}
                  className="p-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground disabled:opacity-40"
                  title="Cancel"
                ><XIcon className="w-3 h-3" /></button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditingIdentity(true)}
                title="Reclassify this security (e.g. swap underlying ↔ CDR)"
                className="ml-auto inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary/40 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <Pencil className="w-2.5 h-2.5" />
                <span>Edit security</span>
              </button>
            )}
          </div>

          {/* Purchase lots — horizontal pills. Renders for EVERY holding
              with a position, even when purchase_history is empty (e.g.
              shares received via security transfer). All prices convert to
              the user's selected display currency (top-left selector). */}
          {(() => {
            const totalQty = safeNumber(holding.quantity ?? holding.position);
            if (totalQty <= 0) return null;

            const costBasis = safeNumber(holding.cost_basis ?? holding.costBasis);
            // Split lots into purchases and transfers. Transfers have either an
            // explicit `isTransfer` flag (from the engine) or come from rows
            // that the legacy parser flagged with `sourceSection: 'TRFR'`.
            const purchases = purchaseHistory.filter(p => !p.isTransfer);
            const transfers = purchaseHistory.filter(p => p.isTransfer);

            // Trade-only weighted average using just buys (matches what the
            // user "remembers paying" — clean prices without commissions).
            let buyQty = 0;
            let buyCost = 0;
            purchases.forEach(p => {
              const q = safeNumber(p.qty ?? p.quantity);
              const px = safeNumber(p.price);
              if (q > 0 && px > 0) { buyQty += q; buyCost += q * px; }
            });
            const cleanAvg = buyQty > 0 ? buyCost / buyQty : 0;

            // Quantity actually represented by lots (buys + recorded transfers).
            const recordedQty = buyQty + transfers.reduce((s, t) => s + safeNumber(t.qty ?? t.quantity), 0);

            // Cost-basis-true weighted average (includes commissions and
            // transferred-in cost). This is the accounting figure used for
            // gain/loss math.
            const trueAvg = totalQty > 0 && costBasis > 0
              ? costBasis / totalQty
              : (cleanAvg || safeNumber(holding.average_price ?? holding.avgPrice));

            // Reconciliation gap: shares the broker says we have but no
            // transaction or transfer record explains. Usually means a transfer
            // happened before the IBKR statement window — user needs to upload
            // the source-broker statement to fill the gap.
            const reconcileQty = Math.max(0, totalQty - recordedQty);
            const hasFeeDelta = recordedQty === totalQty && Math.abs(trueAvg - cleanAvg) > 0.005;

            // Convert every per-share/per-lot value into the active display
            // currency so all pills move together with the top-left selector.
            const cvtPrice = (px) => convert(px, nativeCurrency);
            const convertedTrueAvg = cvtPrice(trueAvg);
            const convertedCleanAvg = cvtPrice(cleanAvg);
            const convertedFeeDelta = convert(costBasis - buyCost, nativeCurrency);

            return (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px] font-medium shrink-0 mr-1">Lots</span>
                {purchaseHistory.length === 0 && reconcileQty === 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-dashed border-border/50 text-[11px] text-muted-foreground/60">
                    No buy/transfer history available
                  </div>
                )}
                {purchases.map((p, i) => (
                  <div key={`buy-${i}`} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-border text-[11px]">
                    <span className="font-semibold text-[9px]" style={{ color: '#a78bfa' }}>L{i + 1}</span>
                    <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                    <span className="font-mono text-emerald-400">+{safeNumber(p.qty ?? p.quantity)}</span>
                    <span className="font-mono text-muted-foreground">@{privacyMode ? '••••' : formatCurrency(cvtPrice(safeNumber(p.price)))}</span>
                  </div>
                ))}
                {transfers.map((t, i) => {
                  const q = safeNumber(t.qty ?? t.quantity);
                  const px = safeNumber(t.price);
                  const linked = t.linkedSource;
                  const sourceBroker = linked?.sourceBroker;
                  const tooltip = linked?.note
                    || (sourceBroker
                          ? `Transferred from ${sourceBroker} — cost basis carried from original buy.`
                          : 'Shares received via security transfer.');
                  return (
                    <div
                      key={`xfr-${i}`}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border text-[11px]',
                        linked?.price ? 'border-emerald-500/40' : 'border-amber-500/40',
                      )}
                      title={tooltip}
                    >
                      <span className={cn('font-semibold text-[9px]', linked?.price ? 'text-emerald-400' : 'text-amber-400')}>XFR</span>
                      {t.date && <span className="text-muted-foreground">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}
                      <span className="font-mono text-emerald-400">+{q.toFixed(q < 100 ? 2 : 0)}</span>
                      {px > 0 && <span className="font-mono text-muted-foreground">@{privacyMode ? '••••' : formatCurrency(cvtPrice(px))}</span>}
                      {sourceBroker && (
                        <span className="text-[9px] text-muted-foreground/70 italic">from {sourceBroker.split(/[\s/]/)[0]}</span>
                      )}
                    </div>
                  );
                })}
                {reconcileQty > 0 && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-[11px]"
                    title={`Broker reports ${totalQty.toFixed(2)} shares but we only have ${recordedQty.toFixed(2)} accounted for. The remaining ${reconcileQty.toFixed(2)} likely came from a transfer-in that predates this statement. Upload the source-broker statement (e.g. Wealthsimple history covering the transfer date) to fill the gap.`}
                  >
                    <span className="font-semibold text-[9px] text-amber-400">⚠ GAP</span>
                    <span className="font-mono text-amber-300">+{reconcileQty.toFixed(reconcileQty < 100 ? 2 : 0)}</span>
                    <span className="text-amber-400/80 text-[10px]">untracked — likely transferred in</span>
                  </div>
                )}
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[11px] ml-1"
                  title={
                    hasFeeDelta
                      ? `Cost basis includes ${formatCurrency(convertedFeeDelta)} in commissions/fees. Trade-only avg: ${formatCurrency(convertedCleanAvg)}`
                      : 'Weighted average cost = total cost basis ÷ total quantity (includes commissions and transferred shares)'
                  }
                >
                  <span className="font-semibold text-[9px] text-primary">AVG</span>
                  <span className="text-muted-foreground">{totalQty.toFixed(totalQty < 100 ? 2 : 0)} sh</span>
                  <span className="font-mono text-primary">@{privacyMode ? '••••' : formatCurrency(convertedTrueAvg)}</span>
                  {hasFeeDelta && (
                    <span className="text-[9px] text-muted-foreground/60 italic">incl. fees</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ETF True Exposure */}
          {overlapRow && (
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border px-2.5 py-1 text-[11px] ${overlapRow.isHighConcentration ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/40 bg-secondary/10'}`}>
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[9px] font-medium">Exposure</span>
              <span className="text-muted-foreground">Direct <span className="font-mono text-foreground">{safeNumber(overlapRow.directPct).toFixed(2)}%</span></span>
              <span className="text-border/50">+</span>
              <span className="text-muted-foreground">ETFs <span className="font-mono text-foreground">{safeNumber(overlapRow.etfPct).toFixed(2)}%</span></span>
              <span className="text-border/50">=</span>
              <span className={`font-semibold font-mono ${overlapRow.isHighConcentration ? 'text-amber-400' : 'text-foreground'}`}>
                {overlapRow.isHighConcentration && '⚠ '}{safeNumber(overlapRow.totalPct).toFixed(2)}%
              </span>
              {overlapRow.sources?.length > 0 && (
                <span className="text-muted-foreground/50 text-[10px]">via {overlapRow.sources.join(', ')}</span>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
