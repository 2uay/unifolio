import React, { useState, useEffect } from 'react';
import { Check, PenLine } from 'lucide-react';

const STORAGE_KEY = 'unifolio_stock_notes';

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

export default function StockNotes({ ticker }) {
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [status, setStatus] = useState('idle'); // idle | unsaved | saving | saved

  useEffect(() => {
    const notes = loadNotes();
    const val = notes[ticker] || '';
    setDraft(val);
    setSaved(val);
    setStatus('idle');
  }, [ticker]);

  const handleChange = (e) => {
    setDraft(e.target.value);
    setStatus('unsaved');
  };

  const handleSave = () => {
    setStatus('saving');
    const notes = loadNotes();
    notes[ticker] = draft;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    setSaved(draft);
    setTimeout(() => setStatus('saved'), 300);
    setTimeout(() => setStatus('idle'), 2000);
  };

  const handleCancel = () => {
    setDraft(saved);
    setStatus('idle');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <PenLine className="w-3 h-3" /> Notes
        </p>
        {status === 'unsaved' && (
          <span className="text-[10px] text-amber-400">Unsaved changes</span>
        )}
        {status === 'saved' && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <Check className="w-2.5 h-2.5" /> Saved
          </span>
        )}
      </div>

      <textarea
        value={draft}
        onChange={handleChange}
        placeholder={`No notes yet. Add your thoughts about ${ticker}…`}
        rows={3}
        className="w-full text-xs rounded-lg bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground/50 resize-none p-2.5 focus:outline-none focus:border-primary/40 transition-colors leading-relaxed"
      />

      {status === 'unsaved' && (
        <div className="flex gap-2 mt-1.5">
          <button
            onClick={handleSave}
            className="text-[10px] px-2.5 py-1 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="text-[10px] px-2.5 py-1 rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}