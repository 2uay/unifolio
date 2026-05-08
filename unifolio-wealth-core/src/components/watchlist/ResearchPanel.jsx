import React from 'react';
import { X, TrendingUp, TrendingDown, Bell, ArrowRightLeft } from 'lucide-react';
import StockChart from '@/components/charts/StockChart';
import { PnlValue, formatCurrency } from '@/components/shared/ValueDisplay';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { cn } from '@/lib/utils';
import StockNotes from './StockNotes';
import StockNews from './StockNews';
import StockAIReport from './StockAIReport';

function StatBox({ label, value }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xs font-mono mt-0.5">{value}</p>
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div className="border-t border-border/50 pt-4">
      {label && <p className="sr-only">{label}</p>}
    </div>
  );
}

export default function ResearchPanel({ item, onClose }) {
  const { convert } = useCurrency();
  const { privacyMode } = usePrivacy();
  const PM = '••••••';

  if (!item) return null;

  const convertedPrice = item.lastPrice > 0 ? convert(item.lastPrice, item.currency || 'USD') : 0;
  const convertedChange = convert(item.change || 0, item.currency || 'USD');
  const convertedTarget = item.targetPrice ? convert(item.targetPrice, item.currency || 'USD') : null;
  const convertedHigh52 = item.high52 ? convert(item.high52, item.currency || 'USD') : null;
  const convertedLow52 = item.low52 ? convert(item.low52, item.currency || 'USD') : null;

  return (
    <div className="fixed right-0 top-0 h-screen w-80 xl:w-96 bg-card border-l border-border shadow-2xl z-40 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold">{item.ticker}</span>
            <PnlValue value={item.changePct} isCurrency={false} className="text-xs" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{item.name}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Price */}
        <div className="flex items-end gap-3">
          <span className="text-2xl font-bold font-mono">
            {privacyMode ? PM : formatCurrency(convertedPrice)}
          </span>
          <div className="mb-0.5">
            <PnlValue value={convertedChange} className="text-sm block" />
          </div>
        </div>

        {/* Chart */}
        <StockChart
          ticker={item.ticker}
          name={item.name}
          lastPrice={item.lastPrice}
          seedVal={item.ticker?.charCodeAt(0) || 99}
          compact={true}
          nativeCurrency={item.currency || 'USD'}
        />

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatBox label="Market Cap" value={item.marketCap || '—'} />
          <StatBox label="Volume" value={item.volume || '—'} />
          <StatBox label="52W High" value={privacyMode ? PM : (convertedHigh52 ? formatCurrency(convertedHigh52) : '—')} />
          <StatBox label="52W Low" value={privacyMode ? PM : (convertedLow52 ? formatCurrency(convertedLow52) : '—')} />
          <StatBox label="P/E Ratio" value={item.pe || '—'} />
          <StatBox label="Analyst" value={item.analystRating || 'N/A'} />
        </div>

        {/* Target price */}
        {convertedTarget && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">Analyst Target</p>
            <p className="text-sm font-bold font-mono text-amber-400 mt-0.5">
              {privacyMode ? PM : formatCurrency(convertedTarget)}
            </p>
            {item.lastPrice > 0 && !privacyMode && (
              <p className={cn('text-xs font-mono mt-0.5', convertedTarget > convertedPrice ? 'text-emerald-400' : 'text-red-400')}>
                {convertedTarget > convertedPrice ? '+' : ''}
                {(((convertedTarget - convertedPrice) / convertedPrice) * 100).toFixed(1)}% upside
              </p>
            )}
          </div>
        )}

        {/* Notes */}
        <SectionDivider />
        <StockNotes ticker={item.ticker} />

        {/* News */}
        <SectionDivider />
        <StockNews ticker={item.ticker} />

        {/* AI Report */}
        <SectionDivider />
        <StockAIReport ticker={item.ticker} name={item.name} />

        {/* Actions */}
        <SectionDivider />
        <div className="grid grid-cols-2 gap-2 pb-4">
          <button className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
            <TrendingUp className="w-3 h-3" /> Buy
          </button>
          <button className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
            <TrendingDown className="w-3 h-3" /> Sell
          </button>
          <button className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
            <Bell className="w-3 h-3" /> Alert
          </button>
          <button className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRightLeft className="w-3 h-3" /> Compare
          </button>
        </div>
      </div>
    </div>
  );
}