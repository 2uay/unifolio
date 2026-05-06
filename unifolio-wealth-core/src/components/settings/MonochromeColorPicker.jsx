import React, { useState } from 'react';
import { useTheme } from '@/lib/ThemeContext';
import { generateMonochromeTheme } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import { RotateCcw, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  { label: 'Blue', hex: '#3b82f6' },
  { label: 'Purple', hex: '#a855f7' },
  { label: 'Green', hex: '#10b981' },
  { label: 'Orange', hex: '#fb923c' },
  { label: 'Cyan', hex: '#06b6d4' },
  { label: 'Pink', hex: '#ec4899' },
  { label: 'Indigo', hex: '#6366f1' },
  { label: 'Teal', hex: '#14b8a6' },
];

function MiniPreview({ theme }) {
  return (
    <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-secondary/20">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</div>
      
      {/* Mini card */}
      <div 
        className="rounded-lg p-3 border"
        style={{
          backgroundColor: `hsl(${theme.colors['--card']})`,
          borderColor: `hsl(${theme.colors['--border']})`,
        }}
      >
        <p 
          className="text-xs font-medium mb-1"
          style={{ color: `hsl(${theme.colors['--card-foreground']})` }}
        >
          Sample Card
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span 
            className="px-2 py-1 rounded"
            style={{ 
              backgroundColor: `hsl(${theme.colors['--accent']})`,
              color: `hsl(${theme.colors['--accent-foreground']})`
            }}
          >
            Badge
          </span>
        </div>
      </div>

      {/* Values preview */}
      <div className="grid grid-cols-2 gap-2">
        <div className="text-xs">
          <p 
            className="text-[10px] text-muted-foreground mb-0.5"
            style={{ color: `hsl(${theme.colors['--muted-foreground']})` }}
          >
            Gain
          </p>
          <p 
            className="text-xs font-mono"
            style={{ color: `hsl(${theme.colors['--gain']})` }}
          >
            +$1,234.56
          </p>
        </div>
        <div className="text-xs">
          <p 
            className="text-[10px] text-muted-foreground mb-0.5"
            style={{ color: `hsl(${theme.colors['--muted-foreground']})` }}
          >
            Loss
          </p>
          <p 
            className="text-xs font-mono"
            style={{ color: `hsl(${theme.colors['--loss']})` }}
          >
            -$567.89
          </p>
        </div>
      </div>

      {/* Sample button */}
      <button
        className="w-full py-2 rounded-lg text-xs font-medium transition-all text-white"
        style={{
          backgroundColor: `hsl(${theme.colors['--primary']})`,
          color: `hsl(${theme.colors['--primary-foreground']})`,
        }}
      >
        Apply Theme
      </button>
    </div>
  );
}

export default function MonochromeColorPicker() {
  const { selectedTheme, changeTheme, customMonochromeColor, setCustomMonochromeColor } = useTheme();
  const [tempColor, setTempColor] = useState(customMonochromeColor);
  const monoTheme = generateMonochromeTheme(tempColor);
  const isCustomSelected = selectedTheme === 'custom-monochrome';

  const handleColorChange = (e) => {
    setTempColor(e.target.value);
  };

  const handlePresetColor = (hex) => {
    setTempColor(hex);
  };

  const handleApply = () => {
    setCustomMonochromeColor(tempColor);
    changeTheme('custom-monochrome', tempColor);
  };

  const handleSetDefault = () => {
    localStorage.setItem('unifolio_default_theme', 'custom-monochrome');
    localStorage.setItem('unifolio_custom_monochrome_color', tempColor);
  };

  const handleReset = () => {
    setTempColor('#3b82f6');
  };

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <p className="text-xs font-semibold text-foreground mb-1">Custom Monochrome Theme</p>
        <p className="text-[11px] text-muted-foreground">
          Create a custom theme from a single base color. The app will generate complementary shades for all UI elements.
        </p>
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground block">Base Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={tempColor}
            onChange={handleColorChange}
            className="w-14 h-14 rounded-lg border-2 border-border cursor-pointer"
          />
          <input
            type="text"
            value={tempColor}
            onChange={(e) => setTempColor(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-xs font-mono text-foreground placeholder-muted-foreground"
            placeholder="#3b82f6"
          />
        </div>
      </div>

      {/* Preset Colors */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Presets</p>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.hex}
              onClick={() => handlePresetColor(preset.hex)}
              title={preset.label}
              className={cn(
                'w-full aspect-square rounded-lg border-2 transition-all hover:scale-105',
                tempColor.toLowerCase() === preset.hex.toLowerCase()
                  ? 'border-primary scale-110'
                  : 'border-border/50'
              )}
              style={{ backgroundColor: preset.hex }}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <MiniPreview theme={monoTheme} />

      {/* Actions */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex gap-2">
          <Button
            onClick={handleApply}
            variant={isCustomSelected ? 'default' : 'outline'}
            size="sm"
            className="flex-1 text-xs gap-1.5"
          >
            <Save className="w-3 h-3" /> Apply Theme
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>
        {isCustomSelected && (
          <Button
            onClick={handleSetDefault}
            variant="outline"
            size="sm"
            className="w-full text-xs"
          >
            Save as Default
          </Button>
        )}
      </div>
    </div>
  );
}