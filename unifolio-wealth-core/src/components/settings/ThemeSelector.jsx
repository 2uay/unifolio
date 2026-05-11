import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, RotateCcw, Sparkles, Search, X, Crown, Lock, Star } from 'lucide-react';
import { getAllThemes, DEFAULT_THEME } from '@/lib/themes';
import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MonochromeColorPicker from './MonochromeColorPicker';
import { supabase } from '@/lib/supabaseClient';

const DEFAULT_THEME_KEY = 'unifolio_default_theme';

export default function ThemeSelector() {
  const { selectedTheme, changeTheme, previewTheme, clearThemePreview } = useTheme();
  const { isPro } = useAuth();
  const [open, setOpen] = useState(false);
  const [showMonochrome, setShowMonochrome] = useState(false);
  const [defaultTheme, setDefaultTheme] = useState(() => localStorage.getItem(DEFAULT_THEME_KEY) || DEFAULT_THEME);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const ref = useRef(null);
  const wasOpenRef = useRef(false);
  const allThemes = getAllThemes();
  const current = selectedTheme === 'custom-monochrome'
    ? { id: 'custom-monochrome', name: 'Custom Monochrome', description: 'Custom color-based theme', swatches: ['#3b82f6'] }
    : allThemes.find(t => t.id === selectedTheme) || allThemes[0];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
      if (wasOpenRef.current) clearThemePreview();
    }
  }, [open]);

  const q = searchQuery.trim().toLowerCase();
  const filteredThemes = (() => {
    const base = q
      ? allThemes.filter(t =>
          t.name.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.tags || []).some(tag => tag.toLowerCase().includes(q))
        )
      : allThemes;
    // Pro themes always float to top
    return [...base].sort((a, b) => (b.pro ? 1 : 0) - (a.pro ? 1 : 0));
  })();

  const handleSetDefault = async () => {
    localStorage.setItem(DEFAULT_THEME_KEY, selectedTheme);
    setDefaultTheme(selectedTheme);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('user_profiles').upsert({ user_id: user.id, theme_id: selectedTheme, updated_at: new Date().toISOString() });
    } catch { /* silent */ }
  };

  const handleResetToDefault = async () => {
    localStorage.setItem(DEFAULT_THEME_KEY, DEFAULT_THEME);
    setDefaultTheme(DEFAULT_THEME);
    changeTheme(DEFAULT_THEME);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('user_profiles').upsert({ user_id: user.id, theme_id: DEFAULT_THEME, updated_at: new Date().toISOString() });
    } catch { /* silent */ }
  };

  if (showMonochrome) {
    return (
      <div className="space-y-4">
        <Button
          onClick={() => setShowMonochrome(false)}
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 mb-2"
        >
          ← Back to Themes
        </Button>
        <MonochromeColorPicker />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
         <p className="text-xs font-semibold text-foreground mb-1">Theme Selection</p>
         <p className="text-[11px] text-muted-foreground">Choose a theme for the entire app including charts and interface</p>
       </div>

      <div ref={ref} className="relative w-full max-w-sm">
        {/* Trigger */}
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all duration-150',
            'bg-secondary border-border hover:border-primary/40 hover:bg-secondary/80',
            open && 'border-primary/40 bg-secondary/80'
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex gap-1 flex-shrink-0">
              {current.swatches.slice(0, 3).map((c, i) => (
                <div key={i} className="w-3.5 h-3.5 rounded-full border border-white/10" style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate">{current.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{current.description}</p>
            </div>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Search bar */}
            <div className="px-3 py-2 border-b border-border/50">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary border border-border/50 focus-within:border-primary/40">
                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search themes, tags…"
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none min-w-0"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="flex-shrink-0 opacity-60 hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto" onMouseLeave={clearThemePreview}>
              {/* Custom Monochrome Button — hide when searching */}
              {!searchQuery && (
                <button
                  onClick={() => { setShowMonochrome(true); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 border-b border-border/50',
                    selectedTheme === 'custom-monochrome'
                      ? 'bg-primary/10 text-foreground'
                      : 'hover:bg-secondary/60 text-foreground'
                  )}
                >
                  <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">Create Custom Monochrome</p>
                    <p className="text-[10px] text-muted-foreground truncate">Design from a single color</p>
                  </div>
                  {selectedTheme === 'custom-monochrome' && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                </button>
              )}

              {/* Preset Themes */}
              {filteredThemes.length === 0 && (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">No themes match "{searchQuery}"</p>
              )}
              <style>{`
                @keyframes uf-gold-sweep {
                  0% { transform: translateX(-120%) skewX(-18deg); }
                  100% { transform: translateX(320%) skewX(-18deg); }
                }
                @keyframes uf-star-spin {
                  0% { transform: rotate(0deg) scale(1); }
                  50% { transform: rotate(180deg) scale(1.25); }
                  100% { transform: rotate(360deg) scale(1); }
                }
                .uf-gold-sweep { animation: uf-gold-sweep 2.2s ease-in-out infinite; }
                .uf-star-spin { animation: uf-star-spin 3s ease-in-out infinite; }
              `}</style>
              {filteredThemes.map((theme) => {
                const isSelected = selectedTheme === theme.id;
                const isProTheme = !!theme.pro;
                const locked = isProTheme && !isPro;
                if (isProTheme) {
                  return (
                    <button
                      key={theme.id}
                      onMouseEnter={() => !locked && previewTheme(theme.id)}
                      onFocus={() => !locked && previewTheme(theme.id)}
                      onClick={() => { if (!locked) { changeTheme(theme.id); setOpen(false); } }}
                      disabled={locked}
                      className={cn(
                        'relative w-full flex items-center gap-3 px-4 py-3 text-left overflow-hidden transition-all duration-150',
                        'border-y border-amber-500/25',
                        locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                        isSelected
                          ? 'bg-amber-500/12 shadow-[inset_0_0_20px_rgba(234,179,8,0.08)]'
                          : 'bg-amber-500/6 hover:bg-amber-500/10',
                      )}
                    >
                      {/* Sweep shimmer */}
                      {!locked && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          <div className="uf-gold-sweep absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" />
                        </div>
                      )}
                      {/* Gold glow border top */}
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />
                      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent pointer-events-none" />

                      {/* Swatches */}
                      <div className="flex gap-1 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 3px rgba(255,200,0,0.5))' }}>
                        {theme.swatches.slice(0, 3).map((c, i) => (
                          <div key={i} className="w-3.5 h-3.5 rounded-full border border-amber-400/30" style={{ backgroundColor: c }} />
                        ))}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-amber-300 truncate">{theme.name}</p>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-300 flex-shrink-0">
                            <Crown className="w-2.5 h-2.5" />
                            PRO
                          </span>
                        </div>
                        <p className="text-[10px] truncate" style={{ color: locked ? 'rgba(180,140,0,0.6)' : 'rgba(234,179,8,0.7)' }}>
                          {locked ? 'Upgrade to Pro to unlock' : theme.description}
                        </p>
                      </div>

                      {/* Star + check/lock */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!locked && (
                          <Star
                            className="uf-star-spin w-3.5 h-3.5 text-amber-400"
                            fill="rgba(234,179,8,0.4)"
                          />
                        )}
                        {locked
                          ? <Lock className="w-3.5 h-3.5 text-amber-500/50" />
                          : isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />
                        }
                      </div>
                    </button>
                  );
                }
                return (
                  <button
                    key={theme.id}
                    onMouseEnter={() => previewTheme(theme.id)}
                    onFocus={() => previewTheme(theme.id)}
                    onClick={() => { changeTheme(theme.id); setOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
                      isSelected ? 'bg-primary/10 text-foreground' : 'hover:bg-secondary/60 text-foreground'
                    )}
                  >
                    <div className="flex gap-1 flex-shrink-0">
                      {theme.swatches.slice(0, 3).map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{theme.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{theme.description}</p>
                      {theme.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {theme.tags.slice(0, 4).map(tag => (
                            <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-secondary text-muted-foreground/70">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
          )}
          </div>

          {/* Default theme controls */}
          <div className="space-y-2 pt-3 border-t border-border">
          <p className="text-xs font-semibold text-foreground">Default Theme</p>
          <p className="text-[11px] text-muted-foreground">Set the default theme that appears when you first open the app</p>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
           <div>
             <p className="text-sm font-medium text-foreground">Current Default</p>
             <p className="text-xs text-muted-foreground">{defaultTheme === 'custom-monochrome' ? 'Custom Monochrome' : allThemes.find(t => t.id === defaultTheme)?.name || allThemes.find(t => t.id === DEFAULT_THEME)?.name}</p>
           </div>
           <Button
             onClick={handleSetDefault}
             size="sm"
             variant={selectedTheme === defaultTheme ? 'default' : 'outline'}
             className="text-xs gap-1.5"
           >
             <Check className="w-3 h-3" /> Set as Default
           </Button>
          </div>
          <Button
           onClick={handleResetToDefault}
           size="sm"
           variant="outline"
           className="w-full text-xs gap-1.5"
          >
           <RotateCcw className="w-3 h-3" /> Reset to Default Theme
          </Button>
          </div>
          </div>
          );
          }
