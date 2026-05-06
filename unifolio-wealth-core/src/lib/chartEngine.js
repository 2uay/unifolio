/**
 * Chart Engine
 * Handles OHLCV data generation, technical indicators, and chart configuration.
 */

// ─── Configuration Constants ───────────────────────────────────────────

export const CHART_TYPES = [
  { id: 'area', label: 'Area', icon: '📈' },
  { id: 'line', label: 'Line', icon: '📊' },
  { id: 'candle', label: 'Candle', icon: '🕯️' },
  { id: 'bar', label: 'Bar', icon: '📏' },
  { id: 'heikin', label: 'Heikin Ashi', icon: '🎯' },
];

export const TIME_RANGES = ['1D', '5D', '1W', '1M', '3M', '6M', '1Y', '2Y', '5Y', 'All'];

export const RANGE_DAYS = {
  '1D': 1,
  '5D': 5,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  '2Y': 730,
  '5Y': 1825,
  'All': 2555,
};

export const INTERVALS = [
  { id: '1m', label: '1m', soon: true },
  { id: '5m', label: '5m', soon: true },
  { id: '15m', label: '15m', soon: true },
  { id: '1h', label: '1h', soon: true },
  { id: '1d', label: '1d' },
  { id: '1w', label: '1w' },
];

export const COMPARE_OPTIONS = [
  { id: 'sp500', label: 'S&P 500', description: 'vs SPY', color: '#60a5fa' },
  { id: 'nasdaq', label: 'Nasdaq', description: 'vs QQQ', color: '#a78bfa' },
  { id: 'gold', label: 'Gold', description: 'vs GLD', color: '#fbbf24' },
  { id: 'btc', label: 'Bitcoin', description: 'vs BTC', color: '#f59e0b' },
  { id: 'vix', label: 'VIX', description: 'Volatility Index', color: '#f87171' },
];

export const EVENT_TYPES = [
  { id: 'earnings', label: 'Earnings', color: '#34d399' },
  { id: 'split', label: 'Stock Split', color: '#60a5fa' },
  { id: 'dividend', label: 'Dividend', color: '#fbbf24' },
  { id: 'news', label: 'News', color: '#f97316' },
];

export const ALL_INDICATORS = [
  // Trend
  { id: 'sma20', label: 'SMA(20)', category: 'trend', color: '#f59e0b', overlay: true },
  { id: 'sma50', label: 'SMA(50)', category: 'trend', color: '#60a5fa', overlay: true },
  { id: 'sma200', label: 'SMA(200)', category: 'trend', color: '#f472b6', overlay: true },
  { id: 'ema20', label: 'EMA(20)', category: 'trend', color: '#a78bfa', overlay: true },
  { id: 'ema50', label: 'EMA(50)', category: 'trend', color: '#818cf8', overlay: true },
  { id: 'wma', label: 'WMA', category: 'trend', color: '#fb923c', overlay: true },
  { id: 'vwap', label: 'VWAP', category: 'trend', color: '#38bdf8', overlay: true },
  // Volatility
  { id: 'bb', label: 'Bollinger Bands', category: 'volatility', color: '#34d399', overlay: true },
  { id: 'atr', label: 'ATR(14)', category: 'volatility', color: '#fb7185' },
  // Momentum
  { id: 'rsi', label: 'RSI(14)', category: 'momentum', color: '#f97316' },
  { id: 'macd', label: 'MACD', category: 'momentum', color: '#22d3ee' },
  { id: 'stoch', label: 'Stochastic', category: 'momentum', color: '#84cc16' },
  // Volume
  { id: 'volume', label: 'Volume', category: 'volume', color: '#6b7280' },
  { id: 'obv', label: 'OBV', category: 'volume', color: '#34d399' },
  // Reference lines
  { id: 'prevclose', label: 'Previous Close', category: 'trend', color: '#94a3b8', overlay: true },
  { id: 'high52', label: '52W High', category: 'trend', color: '#34d399', overlay: true },
  { id: 'low52', label: '52W Low', category: 'trend', color: '#f87171', overlay: true },
];

export const DEFAULT_LAYOUT = {
  range: '1M',
  chartType: 'area',
  interval: '1d',
  activeIndicators: [],
  compareLines: [],
  activeEvents: [],
  rightPanelOpen: true,
};

// ─── LocalStorage Persistence ─────────────────────────────────────────

export function saveChartLayout(layout) {
  try {
    localStorage.setItem('chartLayout', JSON.stringify(layout));
  } catch (e) {
    console.error('Failed to save chart layout:', e);
  }
}

export function loadChartLayout() {
  try {
    const saved = localStorage.getItem('chartLayout');
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
  } catch (e) {
    console.error('Failed to load chart layout:', e);
    return DEFAULT_LAYOUT;
  }
}

// ─── OHLCV Data Generation ────────────────────────────────────────────

export function generateOHLC(basePrice, seed, points) {
  const rng = (s) => {
    let x = s * 9301 + 49297;
    return ((x >>> 0) % 233280) / 233280;
  };

  const data = [];
  let price = basePrice;
  let volume = 1e7;

  for (let i = 0; i < points; i++) {
    const dayNum = seed + i;
    const volatility = 0.015 * (1 + 0.5 * Math.sin(dayNum / 20));
    const trend = 0.0005 * Math.sin(dayNum / 50);
    const dailyReturn = (rng(dayNum * 7) - 0.48) * volatility + trend;

    const open = price;
    price = price * (1 + dailyReturn);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.abs(rng(dayNum * 11)) * 0.008);
    const low = Math.min(open, close) * (1 - Math.abs(rng(dayNum * 13)) * 0.008);
    volume = volume * (0.8 + rng(dayNum * 17) * 0.4);

    const date = new Date();
    date.setDate(date.getDate() - (points - i - 1));
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    data.push({
      date: dateStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
      timestamp: date.getTime(),
    });
  }

  return data;
}

// ─── Technical Indicators ─────────────────────────────────────────────

function SMA(data, period, key = 'close') {
  return data.map((d, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((s, x) => s + x[key], 0);
    return Math.round((sum / period) * 100) / 100;
  });
}

function EMA(data, period, key = 'close') {
  const result = [];
  const multiplier = 2 / (period + 1);
  let sma = null;

  data.forEach((d, i) => {
    if (i < period - 1) {
      result.push(null);
      return;
    }
    if (sma === null) {
      sma = data.slice(0, period).reduce((s, x) => s + x[key], 0) / period;
      result.push(Math.round(sma * 100) / 100);
      return;
    }
    sma = (d[key] - sma) * multiplier + sma;
    result.push(Math.round(sma * 100) / 100);
  });

  return result;
}

function WMA(data, period, key = 'close') {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    let wsum = 0,
      denom = 0;
    slice.forEach((d, j) => {
      wsum += d[key] * (j + 1);
      denom += j + 1;
    });
    result.push(Math.round((wsum / denom) * 100) / 100);
  }
  return result;
}

function RSI(data, period = 14) {
  const result = [];
  let gains = 0,
    losses = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }

    const change = data[i].close - data[i - 1].close;
    if (i < period) {
      if (change > 0) gains += change;
      else losses -= change;
      result.push(null);
      continue;
    }

    if (i === period) {
      if (change > 0) gains += change;
      else losses -= change;
      gains /= period;
      losses /= period;
    } else {
      const newGain = change > 0 ? change : 0;
      const newLoss = change < 0 ? -change : 0;
      gains = (gains * (period - 1) + newGain) / period;
      losses = (losses * (period - 1) + newLoss) / period;
    }

    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - 100 / (1 + rs);
    result.push(Math.round(rsi * 100) / 100);
  }

  return result;
}

function MACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = EMA(data, fastPeriod);
  const emaSlow = EMA(data, slowPeriod);
  const macd = emaFast.map((f, i) => f && emaSlow[i] ? Math.round((f - emaSlow[i]) * 100) / 100 : null);
  const signal = EMA(
    macd.map((m, i) => ({ close: m || 0 })),
    signalPeriod
  );
  const hist = macd.map((m, i) => m && signal[i] ? Math.round((m - signal[i]) * 100) / 100 : null);

  return {
    macd,
    macdSignal: signal,
    macdHist: hist,
  };
}

function Stochastic(data, period = 14, smoothK = 3, smoothD = 3) {
  const result = { stochK: [], stochD: [] };

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.stochK.push(null);
      result.stochD.push(null);
      continue;
    }

    const slice = data.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(d => d.high));
    const low = Math.min(...slice.map(d => d.low));
    const fastK = high === low ? 50 : ((data[i].close - low) / (high - low)) * 100;

    // Simple smoothing for demo (proper EMA would be better)
    const prevK = result.stochK[i - 1] || fastK;
    const k = (prevK * (smoothK - 1) + fastK) / smoothK;
    result.stochK.push(Math.round(k * 100) / 100);

    const prevD = result.stochD[i - 1] || k;
    const d = (prevD * (smoothD - 1) + k) / smoothD;
    result.stochD.push(Math.round(d * 100) / 100);
  }

  return result;
}

function ATR(data, period = 14) {
  const result = [];
  const tr = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low);
      result.push(null);
      continue;
    }

    const h = data[i].high;
    const l = data[i].low;
    const c = data[i - 1].close;
    const trValue = Math.max(h - l, Math.abs(h - c), Math.abs(l - c));
    tr.push(trValue);

    if (i < period) {
      result.push(null);
      continue;
    }

    if (i === period) {
      const atrValue = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result.push(Math.round(atrValue * 100) / 100);
    } else {
      const prevATR = result[i - 1];
      const atrValue = (prevATR * (period - 1) + trValue) / period;
      result.push(Math.round(atrValue * 100) / 100);
    }
  }

  return result;
}

function BollingerBands(data, period = 20, stdDev = 2) {
  const sma = SMA(data, period);
  const bbUpper = [];
  const bbMid = [];
  const bbLower = [];

  data.forEach((d, i) => {
    if (i < period - 1) {
      bbUpper.push(null);
      bbMid.push(null);
      bbLower.push(null);
      return;
    }

    bbMid.push(sma[i]);

    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const variance = slice.reduce((sum, x) => sum + Math.pow(x.close - mean, 2), 0) / period;
    const std = Math.sqrt(variance);

    bbUpper.push(Math.round((mean + std * stdDev) * 100) / 100);
    bbLower.push(Math.round((mean - std * stdDev) * 100) / 100);
  });

  return { bbUpper, bbMid, bbLower };
}

function OBV(data) {
  const result = [];
  let obv = 0;

  data.forEach((d, i) => {
    if (i === 0) {
      obv = d.volume;
    } else {
      const change = d.close - data[i - 1].close;
      if (change > 0) obv += d.volume;
      else if (change < 0) obv -= d.volume;
    }
    result.push(obv);
  });

  return result;
}

function VWAP(data) {
  const result = [];
  let cumulativeTP = 0;
  let cumulativeVolume = 0;

  data.forEach(d => {
    const tp = (d.high + d.low + d.close) / 3;
    cumulativeTP += tp * d.volume;
    cumulativeVolume += d.volume;
    result.push(cumulativeVolume ? Math.round((cumulativeTP / cumulativeVolume) * 100) / 100 : 0);
  });

  return result;
}

export function applyIndicators(data, activeIndicators) {
  let result = [...data];

  activeIndicators.forEach(id => {
    switch (id) {
      case 'sma20':
        result = result.map((d, i) => ({ ...d, sma20: SMA(data, 20)[i] }));
        break;
      case 'sma50':
        result = result.map((d, i) => ({ ...d, sma50: SMA(data, 50)[i] }));
        break;
      case 'sma200':
        result = result.map((d, i) => ({ ...d, sma200: SMA(data, 200)[i] }));
        break;
      case 'ema20':
        result = result.map((d, i) => ({ ...d, ema20: EMA(data, 20)[i] }));
        break;
      case 'ema50':
        result = result.map((d, i) => ({ ...d, ema50: EMA(data, 50)[i] }));
        break;
      case 'wma':
        result = result.map((d, i) => ({ ...d, wma: WMA(data, 20)[i] }));
        break;
      case 'vwap':
        result = result.map((d, i) => ({ ...d, vwap: VWAP(data)[i] }));
        break;
      case 'rsi':
        result = result.map((d, i) => ({ ...d, rsi: RSI(data)[i] }));
        break;
      case 'macd': {
        const macdData = MACD(data);
        result = result.map((d, i) => ({ ...d, macd: macdData.macd[i], macdSignal: macdData.macdSignal[i], macdHist: macdData.macdHist[i] }));
        break;
      }
      case 'stoch': {
        const stochData = Stochastic(data);
        result = result.map((d, i) => ({ ...d, stochK: stochData.stochK[i], stochD: stochData.stochD[i] }));
        break;
      }
      case 'atr':
        result = result.map((d, i) => ({ ...d, atr: ATR(data)[i] }));
        break;
      case 'bb': {
        const bbData = BollingerBands(data);
        result = result.map((d, i) => ({ ...d, bbUpper: bbData.bbUpper[i], bbMid: bbData.bbMid[i], bbLower: bbData.bbLower[i] }));
        break;
      }
      case 'volume':
        // Volume is already in data
        break;
      case 'obv':
        result = result.map((d, i) => ({ ...d, obv: OBV(data)[i] }));
        break;
      default:
        break;
    }
  });

  return result;
}

// ─── Heikin Ashi ──────────────────────────────────────────────────────

export function toHeikinAshi(data) {
  const result = [];

  data.forEach((d, i) => {
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    let haOpen;
    if (i === 0) {
      haOpen = (d.open + d.close) / 2;
    } else {
      haOpen = (result[i - 1].haOpen + result[i - 1].haClose) / 2;
    }
    const haHigh = Math.max(d.high, haOpen, haClose);
    const haLow = Math.min(d.low, haOpen, haClose);

    result.push({
      ...d,
      haOpen: Math.round(haOpen * 100) / 100,
      haHigh: Math.round(haHigh * 100) / 100,
      haLow: Math.round(haLow * 100) / 100,
      haClose: Math.round(haClose * 100) / 100,
    });
  });

  return result;
}