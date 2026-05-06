import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const ICONS = ['⭐', '💻', '📊', '💰', '🏦', '🌍', '⚡', '🔥', '💎', '🚀', '📈', '🏥'];
const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
];

export default function NewWatchlistModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('⭐');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: description.trim(), icon: selectedIcon, color: selectedColor });
    setName(''); setDescription(''); setSelectedIcon('⭐'); setSelectedColor('#3b82f6');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">New Watchlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div>
            <Label className="text-xs text-muted-foreground">Name *</Label>
            <Input
              placeholder="e.g. My Tech Picks"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 bg-secondary border-border"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Description (optional)</Label>
            <Input
              placeholder="Short description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="mt-1 bg-secondary border-border"
            />
          </div>

          {/* Icon picker */}
          <div>
            <Label className="text-xs text-muted-foreground">Icon</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-colors ${
                    selectedIcon === icon
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:bg-secondary/80'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex gap-1.5 mt-1.5">
              {COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className="w-6 h-6 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: color,
                    borderColor: selectedColor === color ? '#fff' : 'transparent',
                    transform: selectedColor === color ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 border border-border">
            <span className="text-xl">{selectedIcon}</span>
            <div>
              <p className="text-sm font-medium" style={{ color: selectedColor }}>{name || 'Watchlist Name'}</p>
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}