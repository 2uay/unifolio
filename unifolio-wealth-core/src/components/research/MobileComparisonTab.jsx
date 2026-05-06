import React, { useState, useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { PnlValue, formatCurrency } from '@/components/shared/ValueDisplay';
import { assets } from '@/lib/sampleData';
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  generateOHLC, applyIndicators, ALL_INDICATORS
} from '@/lib/chartEngine.js';

const THEME_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

function generateComparisonData(tickers, days = 90) {
  // Generate percentage performance data for multiple tickers
  const data = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const point = { date: date.toISOString().split('T')[0] };

    tickers.forEach(ticker => {
      const asset = assets[ticker];
      if (!asset) return;
      const baseData = generateOHLC(asset.current_price || 100, ticker.charCodeAt(0) * 7, Math.min(days, 500));
      const normalized = ((baseData[i]?.close || asset.current_price) / asset.current_price - 1) * 100;
      point[ticker] = normalized;
    });

    data.push(point);
  }

  return data;
}

export default function MobileComparisonTab({ initialTicker }) {
  const { convert } = useCurrency();
  const { privacyMode } = usePrivacy();
  const [tickers, setTickers] = useState([initialTicker]);
  const [inputValue, setInputValue] = useState('');
  const [timeRange, setTimeRange] = useState('3M');

  const days = timeRange === '1M' ? 30 : timeRange === '3M' ? 90 : 365;
  const comparisonData = useMemo(() => generateComparisonData(tickers, days), [tickers, days]);

  const handleAddTicker = () => {
    const ticker = inputValue.toUpperCase();
    if (ticker && !tickers.includes(ticker) && assets[ticker]) {
      setTickers([...tickers, ticker]);
      setInputValue('');
    }
  };

  const handleRemoveTicker = (ticker) => {
    if (tickers.length > 1) {
      setTickers(tickers.filter(t => t !== ticker));
    }
  };

  const currentPrices = useMemo(() => {
    return tickers.map(ticker => {
      const asset = assets[ticker];
      return {
        ticker,
        price: asset?.current_price || 0,
        change: asset ? asset.current_price - asset.previous_close : 0,
        changePct: asset ? ((asset.current_price - asset.previous_close) / asset.previous_close * 100) : 0,
      };
    });
  }, [tickers]);

  return (
    <div className="p-4 space-y-4">
      {/* Add ticker input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add ticker (e.g., AAPL)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTicker()}
          className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={handleAddTicker}
          className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Selected tickers chips */}
      <div className="flex flex-wrap gap-2">
        {tickers.map((ticker, i) => (
          <div key={ticker} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-secondary border border-border text-sm">
            <span className="font-mono font-bold text-xs" style={{ color: THEME_COLORS[i % THEME_COLORS.length] }}>
              {ticker}
            </span>
            {tickers.length > 1 && (
              <button
                onClick={() => handleRemoveTicker(ticker)}
                className="text-muted-foreground hover:text-foreground ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Time range selector */}
      <div className="flex gap-1">
        {['1M', '3M', '1Y'].map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded transition-colors',
              timeRange === range
                ? 'bg-primary text-white'
                : 'bg-secondary border border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Comparison chart */}
      {comparisonData.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden bg-secondary/20 p-2 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={comparisonData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 8 }} interval={Math.floor(comparisonData.length / 4)} />
              <YAxis tick={{ fontSize: 8 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(v) => v?.toFixed(2) + '%'}
              />
              {tickers.map((ticker, i) => (
                <Area
                  key={ticker}
                  type="monotone"
                  dataKey={ticker}
                  stroke={THEME_COLORS[i % THEME_COLORS.length]}
                  fill={THEME_COLORS[i % THEME_COLORS.length]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Performance summary */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Performance</p>
        {currentPrices.map((item, i) => (
          <div key={item.ticker} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: THEME_COLORS[i % THEME_COLORS.length] }}
              />
              <span className="font-mono font-bold text-sm">{item.ticker}</span>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono">{privacyMode ? '••••' : formatCurrency(item.price)}</p>
              <PnlValue value={item.changePct} isCurrency={false} className="text-xs" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}