import React, { useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { PnlValue, formatCurrency } from '@/components/shared/ValueDisplay';
import StockChart from '@/components/charts/StockChart';
import StockNotes from '@/components/watchlist/StockNotes';
import StockNews from '@/components/watchlist/StockNews';
import StockAIReport from '@/components/watchlist/StockAIReport';
import MobileComparisonTab from './MobileComparisonTab';

function StatBox({ label, value }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2 text-center">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-[10px] font-mono mt-0.5">{value}</p>
    </div>
  );
}

export default function MobileResearchPopup({ win }) {
  const { closeWindow } = useResearchWindows();
  const { convert } = useCurrency();
  const { privacyMode } = usePrivacy();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'comparison' | 'notes' | 'news'
  const PM = '••••••';

  const item = win.item;
  const convertedPrice = item.lastPrice > 0 ? convert(item.lastPrice, item.currency || 'USD') : 0;
  const convertedChange = convert(item.change || 0, item.currency || 'USD');
  const convertedTarget = item.targetPrice ? convert(item.targetPrice, item.currency || 'USD') : null;
  const convertedHigh52 = item.high52 ? convert(item.high52, item.currency || 'USD') : null;
  const convertedLow52 = item.low52 ? convert(item.low52, item.currency || 'USD') : null;

  return (
    <div className="fixed inset-0 z-[500] bg-black/40 lg:hidden">
      {/* Mobile popup background */}
      <div className="absolute inset-0" onClick={() => closeWindow(item.ticker)} />

      {/* Popup container */}
      <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-2xl border border-border max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono font-bold text-lg">{item.ticker}</span>
            <span className="text-[12px] text-muted-foreground truncate">{item.name}</span>
          </div>
          <button
            onClick={() => closeWindow(item.ticker)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Price summary */}
        <div className="px-4 py-3 bg-secondary/20 border-b border-border flex-shrink-0">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold font-mono">{privacyMode ? PM : formatCurrency(convertedPrice)}</span>
            <PnlValue value={convertedChange} className="text-sm" />
            <PnlValue value={item.changePct} isCurrency={false} className="text-sm" />
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-1 px-3 py-2 bg-secondary/30 border-b border-border overflow-x-auto flex-shrink-0">
          {[
            { id: 'stock', label: 'Stock' },
            { id: 'comparison', label: 'Compare' },
            { id: 'notes', label: 'Notes' },
            { id: 'news', label: 'News' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors',
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'stock' && (
            <div className="space-y-3 p-4">
              {/* Chart */}
              <div className="rounded-lg border border-border overflow-hidden">
                <StockChart
                  ticker={item.ticker}
                  name={item.name}
                  lastPrice={item.lastPrice || 100}
                  seedVal={item.ticker.charCodeAt(0) * 31 + (item.ticker.charCodeAt(1) || 0) * 7}
                  compact={true}
                />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Volume" value={item.volume || '—'} />
                <StatBox label="Market Cap" value={item.marketCap || '—'} />
                {convertedHigh52 && <StatBox label="52W Hi" value={privacyMode ? PM : formatCurrency(convertedHigh52)} />}
                {convertedLow52 && <StatBox label="52W Lo" value={privacyMode ? PM : formatCurrency(convertedLow52)} />}
              </div>

              {/* Target price */}
              {convertedTarget && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">Analyst Target</p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-sm font-bold font-mono text-amber-400">
                      {privacyMode ? PM : formatCurrency(convertedTarget)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button className="py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20">
                  Add to Watchlist
                </button>
                <button className="py-2 rounded-lg bg-secondary border border-border text-muted-foreground text-xs font-medium hover:text-foreground">
                  Set Alert
                </button>
              </div>
            </div>
          )}

          {activeTab === 'comparison' && (
            <MobileComparisonTab initialTicker={item.ticker} />
          )}

          {activeTab === 'notes' && (
            <div className="p-4">
              <StockNotes ticker={item.ticker} />
            </div>
          )}

          {activeTab === 'news' && (
            <div className="p-4">
              <StockNews ticker={item.ticker} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}