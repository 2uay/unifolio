import React, { useMemo, useState } from 'react';
import { AlertTriangle, Info, CheckCircle, AlertCircle, Layers, Zap, Search, ChevronDown, ChevronUp, Shield, X } from 'lucide-react';
import { calcTrueExposure, getHeldETFs, buildEtfXRay } from '@/lib/etfOverlapEngine';
import { calcHealthScore } from '@/lib/healthScore';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import { safeNumber, safeDivide } from '@/lib/safeNum';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { useCurrency } from '@/lib/CurrencyContext';
import { usePortfolioData } from '@/lib/PortfolioDataContext';
import EmptyPortfolioState from '@/components/shared/EmptyPortfolioState';
import { Input } from '@/components/ui/input';

const PM = '••••';

function HealthScoreCard({ holdings, accounts, totalValue, cashTotal, portfolioSnapshots }) {
  const [expanded, setExpanded] = useState(false);
  const health = useMemo(() => calcHealthScore({ holdings, accounts, totalValue, cashTotal, portfolioSnapshots }), [holdings, accounts, totalValue, cashTotal]);
  const scoreColor = health.score >= 75 ? 'text-emerald-400' : health.score >= 50 ? 'text-amber-400' : 'text-red-400';
  const trackColor = health.score >= 75 ? 'bg-emerald-500' : health.score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button type="button" className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/20 transition-colors" onClick={() => setExpanded(v => !v)}>
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-secondary"><Shield className="h-6 w-6 text-muted-foreground" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-3xl font-bold font-mono', scoreColor)}>{health.score}</span>
            <span className="text-muted-foreground text-sm">/ 100</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold ml-1', health.score >= 75 ? 'bg-emerald-500/10 text-emerald-400' : health.score >= 50 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400')}>{health.grade}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{health.summary}</p>
        </div>
        <div className="hidden sm:block w-32 flex-shrink-0">
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', trackColor)} style={{ width: `${health.score}%` }} />
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border/30 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {health.factors.map(f => (
              <div key={f.id} className="flex items-start gap-3 rounded-lg bg-secondary/30 p-3">
                <div className="flex-shrink-0 mt-0.5">{f.good ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{f.label}</span>
                    <span className={cn('text-xs font-mono font-bold', f.good ? 'text-emerald-400' : 'text-amber-400')}>{f.score}/{f.max}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{f.note}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-secondary overflow-hidden">
                    <div className={cn('h-full rounded-full', f.good ? 'bg-emerald-500' : f.score > f.max * 0.4 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${(f.score / f.max) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Heatmap cell color for ETF weight (0..maxWeight). Uses theme primary.
function weightHeatStyle(weight, maxWeight) {
  if (!weight || weight <= 0) return { background: 'transparent' };
  const t = Math.min(1, weight / Math.max(maxWeight, 0.001));
  const opacity = 0.08 + t * 0.42; // 0.08 → 0.50
  return {
    background: `hsl(var(--primary) / ${opacity.toFixed(2)})`,
  };
}

function EtfXRayCard({ etf, onSelect, isSelected, privacyMode }) {
  const [expanded, setExpanded] = useState(true);
  const maxWeight = Math.max(...etf.underlyings.map(u => u.weight), 0.01);
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden transition-all', isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border')}>
      <button type="button" onClick={() => { setExpanded(v => !v); onSelect?.(etf.ticker); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 text-left">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Layers className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground font-mono">{etf.ticker}</span>
            <span className="text-[11px] text-muted-foreground truncate">{etf.name}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] font-mono text-muted-foreground">{privacyMode ? PM : formatCurrency(etf.marketValue)}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] font-mono text-muted-foreground">{etf.portfolioPct.toFixed(1)}% of portfolio</span>
            {etf.overlapTickers.length > 0 && (
              <>
                <span className="text-[11px] text-muted-foreground">·</span>
                <span className="text-[11px] font-medium text-amber-400">{etf.overlapTickers.length} overlap</span>
              </>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border/30">
          <table className="w-full text-[12px]">
            <thead className="bg-secondary/30">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Holding</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Weight</th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your $ via {etf.ticker}</th>
              </tr>
            </thead>
            <tbody>
              {etf.underlyings.map(u => (
                <tr key={u.ticker} className="border-t border-border/10">
                  <td className="px-3 py-1.5" style={weightHeatStyle(u.weight, maxWeight)}>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('font-mono font-semibold', u.overlapDirect ? 'text-amber-400' : 'text-foreground')}>{u.ticker}</span>
                      {u.overlapDirect && <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">OVERLAP</span>}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{u.weightPct.toFixed(2)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{privacyMode ? PM : formatCurrency(u.indirectValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {etf.overlapTickers.length > 0 && (
            <div className="px-3 py-2 border-t border-border/20 bg-amber-500/5 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">You also hold directly:</span>
              {etf.overlapTickers.map(t => (
                <span key={t} className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-amber-300">{t}</span>
              ))}
            </div>
          )}
          <div className="px-3 py-1.5 border-t border-border/20 bg-secondary/20">
            <p className="text-[10px] text-muted-foreground">
              Showing top {etf.underlyings.length} holdings · ~{etf.coveragePct.toFixed(0)}% of fund disclosed · Remainder spread across the rest of the index.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Insights() {
  const { privacyMode } = usePrivacy();
  const { convert, displayCurrency } = useCurrency();
  const { accounts, holdings, portfolioSnapshots, isEmptyPortfolio } = usePortfolioData();
  const [search, setSearch] = useState('');
  const [selectedEtf, setSelectedEtf] = useState(null);

  const allAccountIds = useMemo(() => accounts.filter(a => a.included_in_portfolio !== false && !a.excluded).map(a => a.id), [accounts]);
  const activeHoldings = useMemo(() => holdings.filter(h => h.quantity > 0 && allAccountIds.includes(h.account_id ?? h.accountId)), [holdings, allAccountIds]);

  const { totalValue, cashTotal } = useMemo(() => {
    let tv = 0, ct = 0;
    activeHoldings.forEach(h => { tv += convert(safeNumber(h.market_value), h.currency || 'USD'); });
    accounts.filter(a => allAccountIds.includes(a.id)).forEach(a => { ct += convert(safeNumber(a.cash_balance), a.base_currency || 'CAD'); });
    tv += ct;
    return { totalValue: tv, cashTotal: ct };
  }, [activeHoldings, accounts, allAccountIds, convert, displayCurrency]);

  const heldEtfs = useMemo(() => getHeldETFs(activeHoldings), [activeHoldings]);
  const xray = useMemo(() => buildEtfXRay(activeHoldings, totalValue, convert), [activeHoldings, totalValue, convert, displayCurrency]);
  const overlap = useMemo(() => calcTrueExposure(activeHoldings, totalValue, convert), [activeHoldings, totalValue, convert, displayCurrency]);

  // For the right-panel Total Exposure table, include EVERY underlying touched by your
  // ETFs plus your direct stocks — not just overlapping ones — so users can see the
  // full reach. Then sort by total exposure desc.
  const fullExposure = useMemo(() => {
    if (totalValue <= 0) return [];
    const direct = {};
    activeHoldings.forEach(h => {
      const t = (h.ticker || '').toUpperCase().replace(/\.TO$/, '');
      if (!t) return;
      // Skip the ETF itself in the underlying table (it is already accounted via lookthrough)
      const isEtf = xray.some(x => x.ticker === t);
      if (isEtf) return;
      const mv = convert(safeNumber(h.market_value), h.currency || 'USD');
      direct[t] = (direct[t] || 0) + mv;
    });
    const indirect = {}; // ticker → [{etfTicker, value}]
    xray.forEach(etf => {
      etf.underlyings.forEach(u => {
        if (!indirect[u.ticker]) indirect[u.ticker] = [];
        indirect[u.ticker].push({ etf: etf.ticker, value: u.indirectValue });
      });
    });
    const tickers = new Set([...Object.keys(direct), ...Object.keys(indirect)]);
    const rows = [];
    tickers.forEach(t => {
      const directValue = direct[t] || 0;
      const sources = indirect[t] || [];
      const indirectValue = sources.reduce((s, x) => s + x.value, 0);
      const totalValueT = directValue + indirectValue;
      rows.push({
        ticker: t,
        directValue,
        indirectValue,
        totalValue: totalValueT,
        directPct: totalValue > 0 ? (directValue / totalValue) * 100 : 0,
        indirectPct: totalValue > 0 ? (indirectValue / totalValue) * 100 : 0,
        totalPct: totalValue > 0 ? (totalValueT / totalValue) * 100 : 0,
        sources,
        hasOverlap: directValue > 0 && indirectValue > 0,
      });
    });
    return rows.sort((a, b) => b.totalValue - a.totalValue);
  }, [activeHoldings, xray, totalValue, convert]);

  const filteredXray = useMemo(() => {
    if (!search) return xray;
    const q = search.toLowerCase();
    return xray.filter(e => e.ticker.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || e.overlapTickers.some(t => t.toLowerCase().includes(q)));
  }, [xray, search]);

  const filteredExposure = useMemo(() => {
    let rows = fullExposure;
    if (selectedEtf) {
      rows = rows.filter(r => r.sources.some(s => s.etf === selectedEtf) || r.directValue > 0);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.ticker.toLowerCase().includes(q));
    }
    return rows;
  }, [fullExposure, selectedEtf, search]);

  if (isEmptyPortfolio) {
    return (
      <div className="space-y-6">
        <PageHeader title="Insights" description="ETF X-Ray: see what you really own" />
        <EmptyPortfolioState />
      </div>
    );
  }

  const overlapCount = fullExposure.filter(r => r.hasOverlap).length;
  const concentratedCount = fullExposure.filter(r => r.totalPct > 8).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" description="ETF X-Ray — see your true exposure once we look through every fund you hold." />

      <HealthScoreCard holdings={activeHoldings} accounts={accounts} totalValue={totalValue} cashTotal={cashTotal} portfolioSnapshots={portfolioSnapshots} />

      {/* Hero summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2"><Layers className="w-4 h-4 text-primary" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ETFs Held</span></div>
          <p className="text-xl font-bold font-mono">{heldEtfs.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{heldEtfs.map(e => e.ticker).slice(0, 3).join(', ')}{heldEtfs.length > 3 ? ` +${heldEtfs.length - 3}` : ''}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-amber-400" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Underlying Stocks Touched</span></div>
          <p className="text-xl font-bold font-mono">{fullExposure.length}</p>
          <p className="text-xs text-muted-foreground mt-1">unique tickers across direct + ETF</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overlapping Positions</span></div>
          <p className="text-xl font-bold font-mono">{overlapCount}</p>
          <p className="text-xs text-muted-foreground mt-1">held both directly + via ETFs</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-red-400" /><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Concentrated &gt;8%</span></div>
          <p className="text-xl font-bold font-mono">{concentratedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">positions over 8% true exposure</p>
        </div>
      </div>

      {heldEtfs.length === 0 && (
        <div className="rounded-xl border border-border/40 bg-card/50 p-8 text-center">
          <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No ETFs found in your portfolio.</p>
          <p className="text-[11px] text-muted-foreground/60 mt-1">Buy any ETF (VOO, VFV, XIC, QQQ, etc.) and the X-Ray will reveal what you really own.</p>
        </div>
      )}

      {heldEtfs.length > 0 && (
        <>
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search ETF, fund name, or underlying ticker (e.g. NVDA, AAPL)…"
                className="pl-9 h-9 text-xs"
              />
            </div>
            {selectedEtf && (
              <button
                type="button"
                onClick={() => setSelectedEtf(null)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/10 text-xs font-medium text-primary hover:bg-primary/20"
              >
                Filter: {selectedEtf} <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Two-pane layout */}
          <div className="grid lg:grid-cols-5 gap-4">
            {/* Left: held ETFs (3/5) */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Your ETFs — Look-through</h2>
                <span className="text-[11px] text-muted-foreground">{filteredXray.length} of {xray.length}</span>
              </div>
              {filteredXray.length === 0 && (
                <div className="rounded-xl border border-border/40 bg-card/50 p-6 text-center">
                  <p className="text-xs text-muted-foreground">No ETFs match "{search}".</p>
                </div>
              )}
              {filteredXray.map(etf => (
                <EtfXRayCard
                  key={etf.ticker}
                  etf={etf}
                  privacyMode={privacyMode}
                  isSelected={selectedEtf === etf.ticker}
                  onSelect={t => setSelectedEtf(s => s === t ? null : t)}
                />
              ))}
            </div>

            {/* Right: total exposure table (2/5) */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border bg-card overflow-hidden sticky top-4">
                <div className="px-4 py-3 border-b border-border/30">
                  <h2 className="text-sm font-semibold text-foreground">True Exposure</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Direct + indirect via ETFs. Sorted by total $.
                  </p>
                </div>
                <div className="max-h-[640px] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-secondary/30 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Asset</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Direct</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Via ETFs</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExposure.slice(0, 60).map(row => (
                        <tr key={row.ticker} className={cn('border-t border-border/10', row.totalPct > 8 && 'bg-amber-500/5')}>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-foreground">{row.ticker}</span>
                              {row.totalPct > 8 && <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />}
                            </div>
                            {row.sources.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {row.sources.slice(0, 3).map(s => (
                                  <span key={s.etf} className="rounded bg-secondary border border-border/30 px-1 py-0 text-[8px] text-muted-foreground">{s.etf}</span>
                                ))}
                                {row.sources.length > 3 && <span className="text-[8px] text-muted-foreground">+{row.sources.length - 3}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {row.directValue > 0 ? (
                              <div>
                                <div className="font-mono text-muted-foreground">{privacyMode ? PM : formatCurrency(row.directValue)}</div>
                                <div className="font-mono text-[9px] text-muted-foreground/60">{row.directPct.toFixed(2)}%</div>
                              </div>
                            ) : <span className="opacity-30">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {row.indirectValue > 0 ? (
                              <div>
                                <div className="font-mono text-blue-400">{privacyMode ? PM : formatCurrency(row.indirectValue)}</div>
                                <div className="font-mono text-[9px] text-blue-400/60">{row.indirectPct.toFixed(2)}%</div>
                              </div>
                            ) : <span className="opacity-30">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span className={cn('font-mono font-bold', row.totalPct > 8 ? 'text-amber-400' : 'text-foreground')}>{row.totalPct.toFixed(2)}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredExposure.length > 60 && (
                  <div className="px-3 py-2 border-t border-border/20 bg-secondary/20 text-center">
                    <p className="text-[10px] text-muted-foreground">Showing top 60 of {filteredExposure.length} positions</p>
                  </div>
                )}
                {overlap.some(r => r.isHighConcentration) && (
                  <div className="px-3 py-2 border-t border-border/20 bg-amber-500/5">
                    <p className="text-[10px] text-amber-400">
                      <strong>High concentration detected.</strong> Positions &gt;8% total exposure may be more concentrated than they look on the surface.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
