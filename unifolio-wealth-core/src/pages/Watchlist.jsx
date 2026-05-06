import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { watchlist as initialWatchlist, holdings } from '@/lib/mockData';
import { formatCurrency } from '@/components/shared/ValueDisplay';
import PageHeader from '@/components/shared/PageHeader';
import WatchlistRow from '@/components/watchlist/WatchlistRow';
import WatchlistDropdown from '@/components/watchlist/WatchlistDropdown';
import NewWatchlistModal from '@/components/watchlist/NewWatchlistModal';
import ExploreCarousel from '@/components/watchlist/ExploreCarousel';
import { SAMPLE_WATCHLISTS } from '@/lib/watchlistData';
import { useLiveData } from '@/lib/LiveDataContext';
import { useStarredStocks } from '@/lib/StarredStocksContext';

// Enrich mock watchlist with extra data
function enrichItem(w) {
  const rng = (s) => { let x = s * 9301 + 49297; return (x % 233280) / 233280; };
  const c = w.ticker.charCodeAt(0) + (w.ticker.charCodeAt(1) || 0);
  const sl = Array.from({ length: 20 }, (_, i) => {
    const base = w.lastPrice || 100;
    return +(base * (0.95 + rng(c + i * 7) * 0.1)).toFixed(2);
  });
  const relatedHolding = holdings.find(h => h.ticker === w.ticker && h.position > 0) || null;

  return {
    ...w,
    sparkline: sl,
    marketCap: ['$2.1T', '$1.8T', '$890B', '$340B', '$210B', '$95B'][c % 6],
    volume: ['48.2M', '22.5M', '15.8M', '9.1M', '5.3M', '2.8M'][c % 6],
    high52: +(w.lastPrice * (1.1 + rng(c + 1) * 0.3)).toFixed(2),
    low52: +(w.lastPrice * (0.6 + rng(c + 2) * 0.25)).toFixed(2),
    pe: (15 + rng(c + 3) * 35).toFixed(1),
    divYield: rng(c + 4) > 0.5 ? (rng(c + 5) * 3).toFixed(2) + '%' : null,
    analystRating: ['Strong Buy', 'Buy', 'Hold', 'Buy', 'Strong Buy', 'Hold', 'Sell'][c % 7],
    overview: `${w.name} is a leading company in its sector. Connect a market data source to view full company overview, financials, and analyst reports.`,
    relatedHolding,
  };
}

const ENRICHED_INITIAL = initialWatchlist.map(enrichItem);

// Per-watchlist item storage: seed "Main" with the initial data
const INITIAL_ITEMS_MAP = {
  'wl-main': ENRICHED_INITIAL,
  'wl-tech': [],
  'wl-etfs': [],
  'wl-dividend': [],
};

export default function Watchlist() {
  const liveData = useLiveData();
  const starredStocks = useStarredStocks();
  const [watchlists, setWatchlists] = useState(SAMPLE_WATCHLISTS);
  const [activeWatchlistId, setActiveWatchlistId] = useState('wl-main');
  const [itemsMap, setItemsMap] = useState(INITIAL_ITEMS_MAP);
  const [newListModalOpen, setNewListModalOpen] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [search, setSearch] = useState('');

  // Items for the active watchlist with live prices
  const baseItems = itemsMap[activeWatchlistId] || [];
  const items = useMemo(() => {
    if (!liveData?.getLivePrice) return baseItems;
    return baseItems.map(w => {
      const livePrice = liveData.getLivePrice(w.ticker, w.lastPrice, 'Stock');
      const change = livePrice - (w.lastPrice || livePrice);
      const changePct = w.lastPrice > 0 ? (change / w.lastPrice) * 100 : 0;
      
      // Subscribe to this ticker for live updates
      if (liveData?.subscribeTicker) {
        liveData.subscribeTicker(w.ticker);
      }
      
      return {
        ...w,
        lastPrice: livePrice,
        change: +change.toFixed(2),
        changePct: +changePct.toFixed(2),
      };
    });
  }, [baseItems, liveData]);

  const setItems = (updater) => {
    setItemsMap(prev => ({
      ...prev,
      [activeWatchlistId]: typeof updater === 'function' ? updater(prev[activeWatchlistId] || []) : updater,
    }));
  };

  const handleAdd = () => {
    if (!newTicker.trim()) return;
    const raw = {
      id: 'w' + Date.now(),
      ticker: newTicker.toUpperCase().trim(),
      name: newTicker.toUpperCase().trim(),
      lastPrice: 0,
      change: 0,
      changePct: 0,
      targetPrice: parseFloat(newTarget) || null,
      notes: newNotes,
    };
    setItems(prev => [...prev, enrichItem(raw)]);
    setNewTicker(''); setNewTarget(''); setNewNotes('');
    setDialogOpen(false);
  };

  const handleRemove = (id) => {
    setItems(prev => prev.filter(w => w.id !== id));
  };

  const handleCreateWatchlist = ({ name, description, icon, color }) => {
    const id = 'wl-' + Date.now();
    const newWl = { id, name, description, icon, color };
    setWatchlists(prev => [...prev, newWl]);
    setItemsMap(prev => ({ ...prev, [id]: [] }));
    setActiveWatchlistId(id);
  };

  // Add explore stock to a specific watchlist
  const handleAddExploreStock = (stock, watchlistId) => {
    const raw = {
      id: 'w' + Date.now() + stock.ticker,
      ticker: stock.ticker,
      name: stock.name,
      lastPrice: stock.price,
      change: +(stock.price * stock.changePct / 100).toFixed(2),
      changePct: stock.changePct,
      targetPrice: null,
      notes: '',
    };
    const enriched = enrichItem(raw);
    setItemsMap(prev => {
      const existing = prev[watchlistId] || [];
      if (existing.find(i => i.ticker === stock.ticker)) return prev; // already added
      return { ...prev, [watchlistId]: [...existing, enriched] };
    });
  };

  const starredTickers = useMemo(() => starredStocks?.getStarredTickers?.() || [], [starredStocks]);

  const filtered = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    let result = safeItems.filter(w =>
      !search || w.ticker.toLowerCase().includes(search.toLowerCase()) || w.name.toLowerCase().includes(search.toLowerCase())
    );
    if (showStarredOnly) {
      result = result.filter(w => starredTickers.includes(w.ticker));
    }
    return result;
  }, [items, search, showStarredOnly, starredTickers]);

  const gainers = useMemo(() => filtered.filter(w => w.changePct > 0).length, [filtered]);
  const losers = useMemo(() => filtered.filter(w => w.changePct < 0).length, [filtered]);
  const allTickers = useMemo(() => Object.values(itemsMap).flat().map(i => i.ticker), [itemsMap]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Watchlist"
        description="Track and research securities you're interested in"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-36 bg-secondary border-border"
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 h-8"><Plus className="w-3.5 h-3.5" /> Add</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>Add to Watchlist</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input placeholder="Ticker symbol (e.g. AAPL)" value={newTicker} onChange={e => setNewTicker(e.target.value)} className="bg-secondary border-border" />
                  <Input placeholder="Target price (optional)" type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)} className="bg-secondary border-border" />
                  <Input placeholder="Notes (optional)" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="bg-secondary border-border" />
                  <Button onClick={handleAdd} className="w-full">Add to Watchlist</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Watchlist selector row */}
      <div className="flex items-center gap-2 flex-wrap">
        <WatchlistDropdown
          watchlists={watchlists}
          activeId={activeWatchlistId}
          onSelect={id => { setActiveWatchlistId(id); setSearch(''); setShowStarredOnly(false); }}
          onNew={() => setNewListModalOpen(true)}
          onSelectStarred={() => { setShowStarredOnly(true); setSearch(''); }}
          showStarredOnly={showStarredOnly}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 sm:h-8 gap-1 text-[10px] sm:text-xs px-2 sm:px-3"
          onClick={() => setNewListModalOpen(true)}
        >
          <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">New Watchlist</span><span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
        <span>{filtered.length} securities</span>
        <span className="text-emerald-400">{gainers} gaining</span>
        <span className="text-red-400">{losers} declining</span>
        {showStarredOnly && starredTickers.length === 0 && (
          <span className="ml-auto text-muted-foreground/60 italic">No starred stocks yet. Open a stock and click the star to add it here.</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-left text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ticker / Name</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-left text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Trend</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-right text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Price</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-right text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Chg %</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-right text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Mkt Cap</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-right text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Volume</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-right text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">52W H/L</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-center text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Rating</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-right text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Target</th>
                <th className="px-2 sm:px-4 py-1.5 sm:py-2.5 w-16 sm:w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => (
                <WatchlistRow
                  key={w.id}
                  item={w}
                  onRemove={handleRemove}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-2 sm:px-4 py-8 sm:py-12 text-center text-muted-foreground text-[10px] sm:text-sm">
                    {search
                      ? 'No securities match your search.'
                      : <span>This watchlist is empty. <button className="text-primary hover:underline" onClick={() => setDialogOpen(true)}>Add a security</button> or pick one from Explore below.</span>
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explore section */}
      <ExploreCarousel
        watchlistTickers={allTickers}
        watchlists={watchlists}
        currentWatchlistId={activeWatchlistId}
        onAddToWatchlist={handleAddExploreStock}
      />

      {/* New Watchlist Modal */}
      <NewWatchlistModal
        open={newListModalOpen}
        onClose={() => setNewListModalOpen(false)}
        onCreate={handleCreateWatchlist}
      />
    </div>
  );
}