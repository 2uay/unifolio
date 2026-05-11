import React, { useMemo } from 'react';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { safeNumber } from '@/lib/safeNum';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import { calcTrueExposure } from '@/lib/etfOverlapEngine';
import { normalizeTicker } from '@/lib/etfHoldings';

export default function HoldingDetailRow({ holding, allHoldings, portfolioTotal }) {
  const { privacyMode } = usePrivacy();
  const { convert } = useCurrency();
  const { getAccount, getInstitutionForAccount } = usePortfolioData();
  const nativeCurrency = holding.currency || 'USD';
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
          </div>

          {/* Purchase lots — horizontal pills */}
          {purchaseHistory.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground/60 uppercase tracking-wider text-[10px] font-medium shrink-0 mr-1">Lots</span>
              {purchaseHistory.map((p, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-card border border-border text-[11px]">
                  <span className="font-semibold text-[9px]" style={{ color: '#a78bfa' }}>L{i + 1}</span>
                  <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                  <span className="font-mono text-emerald-400">+{safeNumber(p.qty ?? p.quantity)}</span>
                  <span className="font-mono text-muted-foreground">@{privacyMode ? '••••' : '$' + safeNumber(p.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

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
