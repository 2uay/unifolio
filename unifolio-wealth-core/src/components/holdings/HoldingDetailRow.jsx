import React from 'react';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { getAccount, getInstitutionForAccount } from '@/lib/mockData';
import { safeNumber } from '@/lib/safeNum';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import StockChart from '@/components/charts/StockChart';

export default function HoldingDetailRow({ holding }) {
  const { privacyMode } = usePrivacy();
  const { openWindow } = useResearchWindows();
  const PM = '••••••';
  const acc = getAccount(holding.account_id ?? holding.accountId);
  const inst = getInstitutionForAccount(holding.account_id ?? holding.accountId);
  const unrealizedAmt = safeNumber(holding.unrealized_gain_loss_amount ?? holding.unrealizedAmt);
  const marketValue   = safeNumber(holding.market_value ?? holding.marketValue);
  const currentPrice  = safeNumber(holding.current_price ?? holding.lastPrice ?? 0);
  const changePct     = safeNumber(holding.daily_pnl_percent ?? holding.dailyPct ?? 0);

  const purchaseHistory = holding.purchase_history ?? holding.purchaseHistory ?? [];

  const referenceLines = purchaseHistory.map((p, i) => ({
    price: safeNumber(p.price),
    label: `Lot ${i + 1}`,
    color: '#a78bfa',
  }));

  return (
    <tr>
      <td colSpan={100} className="p-0">
        <div className="bg-secondary/10 border-b border-border p-3 md:p-4">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Position Details */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Position Details</h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <span className="text-muted-foreground">Market Value</span>
                <span className="font-mono text-right">{privacyMode ? PM : formatCurrency(marketValue)}</span>
                <span className="text-muted-foreground">Cost Basis</span>
                <span className="font-mono text-right">{privacyMode ? PM : formatCurrency(safeNumber(holding.cost_basis ?? holding.costBasis))}</span>
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

            {/* Price Chart */}
            <div className="md:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Price Chart</h3>
              <StockChart
                ticker={holding.ticker}
                name={holding.name}
                lastPrice={currentPrice || 100}
                seedVal={42}
                compact={true}
                onChartClick={() => openWindow({
                  ticker: holding.ticker,
                  name: holding.name,
                  lastPrice: currentPrice,
                  changePct,
                  currency: holding.currency || 'USD',
                })}
                clickableChart={true}
                referenceLines={referenceLines}
              />

              {/* Purchase History badges */}
              {purchaseHistory.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Purchase History</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {purchaseHistory.map((p, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card border border-border text-xs">
                        <span className="text-[9px] font-semibold" style={{ color: '#a78bfa' }}>Lot {i + 1}</span>
                        <span className="text-muted-foreground">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                        <span className="font-mono text-emerald-400">+{safeNumber(p.qty)}</span>
                        <span className="text-muted-foreground">@</span>
                        <span className="font-mono">{privacyMode ? '••••' : '$' + safeNumber(p.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
