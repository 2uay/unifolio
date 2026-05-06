import React, { useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE } from '@/lib/chartTooltip';
import { formatCurrency, PnlValue } from '@/components/shared/ValueDisplay';
import { getAccount, getInstitutionForAccount } from '@/lib/mockData';
import { safeNumber, safeArray } from '@/lib/safeNum';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import { cn } from '@/lib/utils';

export default function HoldingDetailRow({ holding }) {
  const { privacyMode } = usePrivacy();
  const { openWindow } = useResearchWindows();
  const chartRef = useRef(null);
  const PM = '••••••';
  const acc = getAccount(holding.account_id ?? holding.accountId);
  const inst = getInstitutionForAccount(holding.account_id ?? holding.accountId);
  const unrealizedAmt = safeNumber(holding.unrealized_gain_loss_amount ?? holding.unrealizedAmt);
  const marketValue   = safeNumber(holding.market_value ?? holding.marketValue);
  const currentPrice = holding.current_price ?? holding.lastPrice ?? 0;
  const changePct = holding.daily_pnl_percent ?? holding.dailyPct ?? 0;

  // Build chart data with purchase markers
  const chartData = safeArray(holding.sparkline).map((price, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (holding.sparkline.length - 1 - i));
    return {
      date: date.toISOString().split('T')[0],
      price,
    };
  });

  // Map purchase dates onto chart (approximate positioning)
  const purchaseHistory = holding.purchase_history ?? holding.purchaseHistory ?? [];
  const purchaseMarkers = purchaseHistory.map(p => ({
    date: p.date,
    price: p.price,
    qty: p.qty,
  }));

  const handleChartClick = (e) => {
    // Prevent clicks on controls from opening research window
    if (e.target !== chartRef.current && chartRef.current?.contains(e.target)) {
      let el = e.target;
      while (el && el !== chartRef.current) {
        if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.classList?.contains('recharts-')) {
          return;
        }
        el = el.parentElement;
      }
    }

    const stockData = {
      ticker: holding.ticker,
      name: holding.name,
      lastPrice: currentPrice,
      changePct: changePct,
      currency: holding.currency || 'USD',
    };
    openWindow(stockData);
  };

  return (
    <tr>
      <td colSpan={16} className="p-0">
        <div className="bg-secondary/20 border-t border-border/30 p-4 md:p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Position Details */}
            <div className="space-y-3">
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

            {/* Price Chart with purchase annotations */}
            <div className="md:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Price Chart — Purchases Marked
              </h3>
              <div
                ref={chartRef}
                onClick={handleChartClick}
                style={{ height: 'clamp(180px, 40vh, 300px)' }}
                className={cn(
                  'w-full rounded-lg border transition-all cursor-pointer hover:border-primary/40 hover:shadow-md group/chart',
                  'border-border bg-card/30'
                )}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`grad-${holding.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={(holding.current_price ?? holding.lastPrice) >= ((holding.average_price ?? holding.avgPrice) || (holding.current_price ?? holding.lastPrice)) ? '#34d399' : '#f87171'} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={(holding.current_price ?? holding.lastPrice) >= ((holding.average_price ?? holding.avgPrice) || (holding.current_price ?? holding.lastPrice)) ? '#34d399' : '#f87171'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} interval={4} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} width={50} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={{ color: 'hsl(var(--foreground))', fontSize: '11px', fontFamily: 'monospace' }}
                      formatter={(val) => [privacyMode ? '••••••' : '$' + safeNumber(val).toFixed(2), 'Price']}
                    />
                    {(holding.average_price ?? holding.avgPrice ?? 0) > 0 && (
                      <ReferenceLine
                        y={holding.average_price ?? holding.avgPrice}
                        stroke="#fbbf24"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        label={{ value: 'Avg', position: 'right', fill: '#fbbf24', fontSize: 10 }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={(holding.current_price ?? holding.lastPrice) >= ((holding.average_price ?? holding.avgPrice) || (holding.current_price ?? holding.lastPrice)) ? '#34d399' : '#f87171'}
                      strokeWidth={1.5}
                      fill={`url(#grad-${holding.id})`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Purchase History */}
              {purchaseHistory.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Purchase History</h4>
                  <div className="flex flex-wrap gap-2">
                    {purchaseHistory.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card border border-border text-xs">
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