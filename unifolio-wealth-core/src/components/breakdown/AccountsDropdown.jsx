import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePortfolioData } from '@/lib/PortfolioDataContext';

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const listener = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

// Derive summary label from selected state
function getSummaryLabel(selectedAccounts, connectedInsts, accounts) {
  if (selectedAccounts.includes('__all__')) return 'All';
  if (selectedAccounts.length === 0) return 'None selected';

  if (selectedAccounts.length === 1) {
    const val = selectedAccounts[0];
    if (val.startsWith('inst_')) {
      const inst = connectedInsts.find(i => 'inst_' + i.id === val);
      return inst ? inst.name.split(' ')[0] : '1 selected';
    }
    if (val.startsWith('type_')) {
      return val.replace('type_', '') + ' accounts';
    }
    const acc = accounts.find(a => a.id === val);
    if (acc) {
      const instId = acc.institution_id ?? acc.institutionId;
      const inst = connectedInsts.find(i => i.id === instId);
      return `${inst?.name.split(' ')[0] ?? ''} ${acc.account_type ?? acc.type}`.trim();
    }
  }

  // Check if all selected are from one institution
  if (selectedAccounts.every(v => v.startsWith('inst_'))) {
    const inst = connectedInsts.find(i => 'inst_' + i.id === selectedAccounts[0]);
    if (inst && selectedAccounts.length === 1) return inst.name.split(' ')[0];
  }

  return `${selectedAccounts.length} selected`;
}

export default function AccountsDropdown({ selectedAccounts, onToggle }) {
  const { accounts, institutions } = usePortfolioData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  useOutsideClick(ref, () => { setOpen(false); setSearch(''); });

  const connectedInsts = useMemo(() =>
    institutions.filter(i => (i.connection_status ?? i.status) === 'connected'),
    [institutions]
  );

  const individualAccounts = useMemo(() =>
    accounts.filter(acc => {
      const inst = connectedInsts.find(i => i.id === (acc.institution_id ?? acc.institutionId));
      return !!inst;
    }),
    [accounts, connectedInsts]
  );

  const accountTypes = useMemo(() =>
    [...new Set(accounts.map(a => a.account_type ?? a.type))].filter(Boolean),
    [accounts]
  );

  const summaryLabel = getSummaryLabel(selectedAccounts, connectedInsts, accounts);
  const isActive = (val) => selectedAccounts.includes(val);

  const groups = [
    { id: '__all__', label: 'All Accounts' },
    ...connectedInsts.map(i => ({ id: 'inst_' + i.id, label: `All ${i.name}` })),
    ...accountTypes.map(t => ({ id: 'type_' + t, label: `All ${t}` })),
  ];

  const allItems = [
    ...groups.map(g => ({ ...g, isGroup: true })),
    ...individualAccounts.map(acc => {
      const inst = connectedInsts.find(i => i.id === (acc.institution_id ?? acc.institutionId));
      return {
        id: acc.id,
        label: `${inst?.name.split(' ')[0] ?? ''} ${acc.account_type ?? acc.type}`.trim(),
        isGroup: false,
      };
    }),
  ];

  const filteredGroups = search
    ? groups.filter(g => g.label.toLowerCase().includes(search.toLowerCase()))
    : groups;

  const filteredIndividuals = search
    ? individualAccounts.filter(acc => {
        const inst = connectedInsts.find(i => i.id === (acc.institution_id ?? acc.institutionId));
        const label = `${inst?.name ?? ''} ${acc.account_type ?? acc.type}`.toLowerCase();
        return label.includes(search.toLowerCase());
      })
    : individualAccounts;

  const selectAll = () => onToggle('__all__');
  const clearAll = () => onToggle('__clear__');

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg border transition-colors',
          open || !selectedAccounts.includes('__all__')
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-border bg-secondary text-foreground hover:border-border/80 hover:bg-secondary/80'
        )}
      >
        <span className="font-medium">Accounts</span>
        <span className="text-xs opacity-70 font-normal">· {summaryLabel}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 ml-0.5 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => { setOpen(false); setSearch(''); }} />

          <div className={cn(
            'z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden',
            // Mobile: full-width bottom sheet
            'fixed bottom-0 left-0 right-0 sm:absolute',
            // Desktop: float above content without pushing down
            'sm:top-full sm:left-0 sm:mt-1.5 sm:w-72 sm:max-h-80',
            // Mobile height
            'w-full max-h-[70vh] sm:max-h-80',
          )}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filter Accounts</span>
              <div className="flex items-center gap-3">
                <button onClick={selectAll} className="text-[11px] text-primary hover:underline">All</button>
                <button onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-foreground">Clear</button>
              </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-border/40">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-secondary rounded-md border border-border/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
                />
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
              {/* Groups */}
              {filteredGroups.length > 0 && (
                <>
                  <p className="px-3 pt-2.5 pb-1 text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium">Groups</p>
                  {filteredGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => onToggle(g.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-secondary/70 transition-colors text-left"
                    >
                      <span className={cn(
                        'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                        isActive(g.id) ? 'bg-primary border-primary' : 'border-border'
                      )}>
                        {isActive(g.id) && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span className={isActive(g.id) ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                        {g.label}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* Individual accounts */}
              {filteredIndividuals.length > 0 && (
                <>
                  <p className="px-3 pt-3 pb-1 text-[9px] uppercase tracking-widest text-muted-foreground/50 font-medium">Individual</p>
                  {filteredIndividuals.map(acc => {
                    const inst = connectedInsts.find(i => i.id === (acc.institution_id ?? acc.institutionId));
                    return (
                      <button
                        key={acc.id}
                        onClick={() => onToggle(acc.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-secondary/70 transition-colors text-left"
                      >
                        <span className={cn(
                          'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                          isActive(acc.id) ? 'bg-primary border-primary' : 'border-border'
                        )}>
                          {isActive(acc.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className={isActive(acc.id) ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                          {(acc.account_type ?? acc.type)}
                          <span className="ml-1 opacity-50">· {inst?.name.split(' ')[0]}</span>
                        </span>
                      </button>
                    );
                  })}
                </>
              )}

              {filteredGroups.length === 0 && filteredIndividuals.length === 0 && (
                <p className="px-3 py-6 text-xs text-muted-foreground text-center">No results for "{search}"</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
