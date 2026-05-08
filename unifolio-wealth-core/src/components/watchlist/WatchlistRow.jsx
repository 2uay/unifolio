import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Bell, ArrowRightLeft, StickyNote, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import { MiniSparkline, PnlValue, formatCurrency } from '@/components/shared/ValueDisplay';
import { cn } from '@/lib/utils';
import StockChart from '@/components/charts/StockChart';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { useStarredStocks } from '@/lib/StarredStocksContext';
import StarIcon from '@/components/shared/StarIcon';

function StatItem({ label, value, className }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-xs font-mono mt-0.5', className)}>{value}</p>
    </div>
  );
}

export default function WatchlistRow({ item, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const { privacyMode } = usePrivacy();
  const { convert, displayCurrency } = useCurrency();
  const { openWindow } = useResearchWindows();
  const { isStar, toggleStar } = useStarredStocks();
  const PM = '••••••';
  const isStarred = isStar(item.ticker);

  const seedVal = item.ticker.charCodeAt(0) * 31 + (item.ticker.charCodeAt(1) || 0) * 7;
  // Watchlist prices are in USD — convert to display currency
  const nativeCur = item.currency || 'USD';
  const convertedPrice = item.lastPrice > 0 ? convert(item.lastPrice, nativeCur) : 0;
  const convertedChange = convert(item.change || 0, nativeCur);
  const convertedTargetPrice = item.targetPrice ? convert(item.targetPrice, nativeCur) : null;
  const convertedHigh52 = item.high52 ? convert(item.high52, nativeCur) : null;
  const convertedLow52 = item.low52 ? convert(item.low52, nativeCur) : null;

  const upside = convertedTargetPrice && convertedPrice > 0
    ? ((convertedTargetPrice - convertedPrice) / convertedPrice) * 100
    : null;

  const accentBorder = item.changePct > 0
    ? 'border-l-[3px] border-l-emerald-500'
    : item.changePct < 0
    ? 'border-l-[3px] border-l-red-500'
    : 'border-l-[3px] border-l-transparent';

  return (
    <>
      {/* Main row */}
      <tr
        className={cn(
          'border-b border-border/50 hover:bg-secondary/20 cursor-pointer transition-colors select-none',
          expanded && 'bg-secondary/20',
          accentBorder
        )}
        onClick={() => setExpanded(p => !p)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">{item.ticker}</span>
            <button
              onClick={(e) => { e.stopPropagation(); toggleStar(item.ticker); }}
              title={isStarred ? 'Unstar' : 'Star'}
              className="inline-flex items-center justify-center transition-all hover:opacity-80 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <StarIcon isStarred={isStarred} className="w-3.5 h-3.5" interactive={false} />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[140px] truncate">{item.name}</p>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <MiniSparkline data={item.sparkline} width={72} height={22} />
        </td>
        <td className="px-4 py-3 text-right font-mono tabular-nums">
          {privacyMode ? PM : (convertedPrice > 0 ? formatCurrency(convertedPrice) : '—')}
        </td>
        <td className="px-4 py-3 text-right">
          <PnlValue value={convertedChange} className="text-xs" />
        </td>
        <td className="px-4 py-3 text-right">
          <span className={cn(
            'inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold font-mono tabular-nums',
            item.changePct > 0
              ? 'bg-emerald-500/10 text-emerald-400'
              : item.changePct < 0
              ? 'bg-red-500/10 text-red-400'
              : 'bg-secondary text-muted-foreground'
          )}>
            {item.changePct > 0 ? '+' : ''}{item.changePct?.toFixed(2)}%
          </span>
        </td>
        <td className="px-4 py-3 text-right hidden lg:table-cell">
          <span className="text-xs font-mono text-muted-foreground">{item.marketCap}</span>
        </td>
        <td className="px-4 py-3 text-right hidden lg:table-cell">
          <span className="text-xs font-mono text-muted-foreground">{item.volume}</span>
        </td>
        <td className="px-4 py-3 text-right hidden xl:table-cell">
          <div className="text-xs font-mono text-muted-foreground">
            {privacyMode ? <span className="tracking-widest">••••</span> : <>
              <span className="text-emerald-400">{convertedHigh52 ? '$' + convertedHigh52.toFixed(2) : '—'}</span>
              <span className="text-muted-foreground/40 mx-1">/</span>
              <span className="text-red-400">{convertedLow52 ? '$' + convertedLow52.toFixed(2) : '—'}</span>
            </>}
          </div>
        </td>
        <td className="px-4 py-3 text-center hidden xl:table-cell">
          <span className={cn('text-xs px-2 py-0.5 rounded font-medium', {
            'bg-emerald-500/15 text-emerald-400': item.analystRating === 'Buy' || item.analystRating === 'Strong Buy',
            'bg-amber-500/15 text-amber-400': item.analystRating === 'Hold',
            'bg-red-500/15 text-red-400': item.analystRating === 'Sell',
            'bg-secondary text-muted-foreground': !item.analystRating,
          })}>{item.analystRating || 'N/A'}</span>
        </td>
        <td className="px-4 py-3 text-right hidden md:table-cell">
          {convertedTargetPrice ? (
            <div>
              <span className="text-xs font-mono text-amber-400">{privacyMode ? '••••' : '$' + convertedTargetPrice.toFixed(2)}</span>
              {upside !== null && (
                <span className={cn('block text-[10px] font-mono', upside >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
                </span>
              )}
            </div>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); openWindow(item); }}
              className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
              title="Open Research Window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onRemove(item.id); }}
              className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-muted-foreground/30">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </div>
        </td>
      </tr>

      {/* Expanded panel */}
      {expanded && (
        <tr>
          <td colSpan={12} className="p-0">
            <div className="bg-secondary/10 border-b border-border p-4 md:p-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Company overview + stats */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Stats</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <StatItem label="Mkt Cap" value={item.marketCap || '—'} />
                      <StatItem label="Volume" value={item.volume || '—'} />
                      <StatItem label="P/E Ratio" value={item.pe || '—'} />
                      <StatItem label="52W High" value={privacyMode ? '••••' : (convertedHigh52 ? '$' + convertedHigh52.toFixed(2) : '—')} className="text-emerald-400" />
                      <StatItem label="52W Low" value={privacyMode ? '••••' : (convertedLow52 ? '$' + convertedLow52.toFixed(2) : '—')} className="text-red-400" />
                      <StatItem label="Div Yield" value={item.divYield || '—'} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Company Overview</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.overview || 'No overview available. Connect a market data source for company information.'}</p>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Star This Stock</h3>
                    <button
                      onClick={() => toggleStar(item.ticker)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border transition-colors text-xs font-medium"
                    >
                      <StarIcon isStarred={isStarred} className="w-4 h-4" interactive={false} />
                      {isStarred ? 'Remove from Starred' : 'Add to Starred Stocks'}
                    </button>
                  </div>

                  {item.relatedHolding && (
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                      <p className="font-semibold text-primary mb-1">You own this stock</p>
                      <p className="text-muted-foreground">{item.relatedHolding.position} shares{!privacyMode && ` @ $${item.relatedHolding.avgPrice?.toFixed(2)}`}</p>
                    </div>
                  )}
                </div>

                {/* Chart */}
                <div className="md:col-span-2">
                  <div className="relative">
                    <StockChart
                      ticker={item.ticker}
                      name={item.name}
                      lastPrice={item.lastPrice || 100}
                      seedVal={seedVal}
                      compact={true}
                      onChartClick={() => openWindow(item)}
                      clickableChart={true}
                      nativeCurrency={nativeCur}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); openWindow(item); }}
                      className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border bg-card/80 backdrop-blur-sm border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Research Window
                    </button>
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                      <TrendingUp className="w-3 h-3" /> Buy
                    </button>
                    <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                      <TrendingDown className="w-3 h-3" /> Sell
                    </button>
                    <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
                      <Bell className="w-3 h-3" /> Add Alert
                    </button>
                    <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
                      <StickyNote className="w-3 h-3" /> Add Note
                    </button>
                    <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
                      <ArrowRightLeft className="w-3 h-3" /> Compare
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openWindow(item); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Research Window
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}