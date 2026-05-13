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

  const purchaseHistory = holding.purchase_history ?? holding.purchaseHistory ?? [];

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
            <span className="text-muted-foreground">Unreal. <PnlValue value={unrealizedAmt} className="inline" /></span>
            <Dot />
            <span className="text-muted-foreground">Real. <PnlValue value={holding.realized_gain_loss_amount ?? holding.realizedGain} className="inline" /></span>
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
            // Trade-only weighted average using just buys (matches what the
            // user "remembers paying" — clean prices without commissions).
            let lotQty = 0;
            let lotCost = 0;
            purchaseHistory.forEach(p => {
              const q = safeNumber(p.qty ?? p.quantity);
              const px = safeNumber(p.price);
              if (q > 0 && px > 0) { lotQty += q; lotCost += q * px; }
            });
            const cleanAvg = lotQty > 0 ? lotCost / lotQty : 0;

            // Cost-basis-true weighted average (includes commissions and
            // transferred-in cost). This is the accounting figure used for
            // gain/loss math.
            const trueAvg = totalQty > 0 && costBasis > 0
              ? costBasis / totalQty
              : (cleanAvg || safeNumber(holding.average_price ?? holding.avgPrice));

            const transferQty = Math.max(0, totalQty - lotQty);
            const hasFeeDelta = lotQty === totalQty && Math.abs(trueAvg - cleanAvg) > 0.005;

            // Convert every per-share/per-lot value into the active display
            // currency so all pills move together with the top-left selector.
            const cvtPrice = (px) => convert(px, nativeCurrency);
            const convertedTrueAvg = cvtPrice(trueAvg);
            const convertedCleanAvg = cvtPrice(cleanAvg);
            const convertedFeeDelta = convert(costBasis - lotCost, nativeCurrency);

            return (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px] font-medium shrink-0 mr-1">Lots</span>
                {purchaseHistory.length === 0 && transferQty === 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-dashed border-border/50 text-[11px] text-muted-foreground/60">
                    No buy/transfer history available
                  </div>
                )}
                {purchaseHistory.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-border text-[11px]">
                    <span className="font-semibold text-[9px]" style={{ color: '#a78bfa' }}>L{i + 1}</span>
                    <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                    <span className="font-mono text-emerald-400">+{safeNumber(p.qty ?? p.quantity)}</span>
                    <span className="font-mono text-muted-foreground">@{privacyMode ? '••••' : formatCurrency(cvtPrice(safeNumber(p.price)))}</span>
                  </div>
                ))}
                {transferQty > 0 && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-amber-500/30 text-[11px]"
                    title="Shares received via security transfer (not a buy trade — no execution price)"
                  >
                    <span className="font-semibold text-[9px] text-amber-400">XFR</span>
                    <span className="font-mono text-emerald-400">+{transferQty.toFixed(transferQty < 100 ? 2 : 0)}</span>
                    <span className="text-muted-foreground/60 text-[10px]">transferred in</span>
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
