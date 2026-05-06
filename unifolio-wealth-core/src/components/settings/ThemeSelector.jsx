import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Palette, RotateCcw, Sparkles } from 'lucide-react';
import { getAllThemes, DEFAULT_THEME } from '@/lib/themes';
import { useTheme } from '@/lib/ThemeContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MonochromeColorPicker from './MonochromeColorPicker';
import { base44 } from '@/api/base44Client';

const DEFAULT_THEME_KEY = 'unifolio_default_theme';

export default function ThemeSelector() {
  const { selectedTheme, changeTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [showMonochrome, setShowMonochrome] = useState(false);
  const [defaultTheme, setDefaultTheme] = useState(() => localStorage.getItem(DEFAULT_THEME_KEY) || DEFAULT_THEME);
  const ref = useRef(null);
  const allThemes = getAllThemes();
  const current = selectedTheme === 'custom-monochrome'
    ? { id: 'custom-monochrome', name: 'Custom Monochrome', description: 'Custom color-based theme', swatches: ['#3b82f6'] }
    : allThemes.find(t => t.id === selectedTheme) || allThemes[0];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSetDefault = async () => {
    localStorage.setItem(DEFAULT_THEME_KEY, selectedTheme);
    setDefaultTheme(selectedTheme);
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        await base44.functions.invoke('updateUserPreference', {
          preferenceKey: 'theme_id',
          preferenceValue: selectedTheme
        });
      }
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
  };

  const handleResetToDefault = async () => {
    localStorage.setItem(DEFAULT_THEME_KEY, DEFAULT_THEME);
    setDefaultTheme(DEFAULT_THEME);
    changeTheme(DEFAULT_THEME);
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        await base44.functions.invoke('updateUserPreference', {
          preferenceKey: 'theme_id',
          preferenceValue: DEFAULT_THEME
        });
      }
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
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
            <div className="max-h-96 overflow-y-auto">
              {/* Custom Monochrome Button */}
              <button
                onClick={() => { setShowMonochrome(true); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 border-b border-border/50',
                  selectedTheme === 'custom-monochrome'
                    ? 'bg-primary/10 text-foreground'
                    : 'hover:bg-secondary/60 text-foreground'
                )}
              >
                <div className="flex gap-1 flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">Create Custom Monochrome</p>
                  <p className="text-[10px] text-muted-foreground truncate">Design from a single color</p>
                </div>
                {selectedTheme === 'custom-monochrome' && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              </button>

              {/* Preset Themes */}
              {allThemes.map((theme) => {
                const isSelected = selectedTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={async () => {
                      changeTheme(theme.id);
                      setOpen(false);
                      try {
                        const isAuth = await base44.auth.isAuthenticated();
                        if (isAuth) {
                          await base44.functions.invoke('updateUserPreference', {
                            preferenceKey: 'theme_id',
                            preferenceValue: theme.id
                          });
                        }
                      } catch (err) {
                        console.error('Failed to save theme:', err);
                      }
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
                      isSelected
                        ? 'bg-primary/10 text-foreground'
                        : 'hover:bg-secondary/60 text-foreground'
                    )}
                  >
                    {/* Swatches */}
                    <div className="flex gap-1 flex-shrink-0">
                      {theme.swatches.slice(0, 3).map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>

                    {/* Name + description */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{theme.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{theme.description}</p>
                    </div>

                    {/* Checkmark */}
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