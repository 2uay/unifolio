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

  return (
    <tr>
      <td colSpan={100} className="p-0">
        <div className="bg-secondary/10 border-b border-border p-3 md:p-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Position Details */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Position Details</h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <span className="text-muted-foreground">Market Value</span>
                <span className="font-mono text-right">{privacyMode ? PM : formatCurrency(convert(marketValue, nativeCurrency))}</span>
                <span className="text-muted-foreground">Cost Basis</span>
                <span className="font-mono text-right">{privacyMode ? PM : formatCurrency(convert(safeNumber(holding.cost_basis ?? holding.costBasis), nativeCurrency))}</span>
                <span className="text-muted-foreground">Unrealized P&L</span>
                <PnlValue value={unrealizedAmt} className="text-right block" />
                <span className="text-muted-foreground">Realized P&L</span>
                <PnlValue value={holding.realized_gain_loss_amount ?? holding.realizedGain} className="text-right block" />
                <span className="text-muted-foreground">Account Type</span>
                <span className="text-right text-primary">{acc?.account_type ?? acc?.type ?? '—'}</span>
                <span className="text-muted-foreground">Institution</span>
                <span className="text-right">{inst?.name ?? '—'}</span>
                <span className="text-muted-foreground">Currency</span>
                <span className="text-right">{holding.currency}</span>
                <span className="text-muted-foreground">Asset Class</span>
                <span className="text-right">{holding.asset_class ?? holding.assetClass}</span>
                <span className="text-muted-foreground">Sector</span>
                <span className="text-right">{holding.sector}</span>
              </div>
            </div>

            {/* Purchase History */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purchase History</h3>
              {purchaseHistory.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {purchaseHistory.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card border border-border text-xs">
                      <span className="text-[9px] font-semibold w-8 shrink-0" style={{ color: '#a78bfa' }}>Lot {i + 1}</span>
                      <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                      <span className="font-mono text-emerald-400 ml-auto">+{safeNumber(p.qty ?? p.quantity)}</span>
                      <span className="text-muted-foreground">@</span>
                      <span className="font-mono">{privacyMode ? '••••' : '$' + safeNumber(p.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50">No purchase history available.</p>
              )}
            </div>
          </div>

          {/* ETF True Exposure */}
          {overlapRow && (
            <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs ${overlapRow.isHighConcentration ? 'border-amber-500/40 bg-amber-500/8' : 'border-border/50 bg-secondary/20'}`}>
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">True Exposure</span>
              <span className="text-muted-foreground">Direct <span className="font-mono text-foreground">{safeNumber(overlapRow.directPct).toFixed(2)}%</span></span>
              <span className="text-muted-foreground/50">+</span>
              <span className="text-muted-foreground">Via ETFs <span className="font-mono text-foreground">{safeNumber(overlapRow.etfPct).toFixed(2)}%</span></span>
              <span className="text-muted-foreground/50">=</span>
              <span className={`font-semibold font-mono ${overlapRow.isHighConcentration ? 'text-amber-400' : 'text-foreground'}`}>
                {overlapRow.isHighConcentration && '⚠ '}{safeNumber(overlapRow.totalPct).toFixed(2)}% total
              </span>
              {overlapRow.sources?.length > 0 && (
                <span className="text-muted-foreground/70 text-[10px]">
                  via {overlapRow.sources.join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
