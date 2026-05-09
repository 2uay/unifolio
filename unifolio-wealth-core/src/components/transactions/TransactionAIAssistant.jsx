import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp, Bot, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { parseTransactionInput } from '@/lib/transactionAI';
import { usePortfolioData } from '@/lib/PortfolioDataContext';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label="Thinking">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'hsl(var(--muted-foreground))',
            animation: `twb-ai-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes twb-ai-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex items-start gap-2 text-xs', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3 h-3 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] px-3 py-2 rounded-lg',
          isUser
            ? 'bg-primary/15 text-foreground rounded-br-sm'
            : 'bg-secondary/60 text-foreground rounded-bl-sm'
        )}
      >
        {msg.pending ? <TypingDots /> : (
          <span
            dangerouslySetInnerHTML={{
              __html: (msg.content || '')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
            }}
          />
        )}
      </div>
    </div>
  );
}

function PatchPreview({ patches, onApply, onDiscard }) {
  return (
    <div className="mt-2 p-2.5 rounded-lg bg-primary/8 border border-primary/20 text-xs">
      <p className="font-semibold text-primary mb-2">Proposed changes ({patches.length}):</p>
      {patches.map((p, i) => (
        <div key={i} className="mb-1.5 pl-2 border-l-2 border-primary/40 text-muted-foreground">
          <span className="font-mono text-[10px] bg-secondary/80 px-1 py-0.5 rounded mr-1.5">{p.action?.toUpperCase()}</span>
          {p.type && <span className="font-medium text-foreground">{p.type}</span>}
          {p.ticker && <span className="font-mono text-primary ml-1">{p.ticker}</span>}
          {p.date && <span className="text-muted-foreground ml-1">on {p.date}</span>}
          {p.qty > 0 && <span className="ml-1">× {p.qty}</span>}
          {p.price > 0 && <span className="ml-1">@ ${p.price}</span>}
        </div>
      ))}
      <div className="flex gap-2 mt-2.5">
        <Button size="sm" className="h-6 text-[11px] gap-1 px-2" onClick={onApply}>
          <Check className="w-3 h-3" /> Apply
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1 px-2" onClick={onDiscard}>
          <X className="w-3 h-3" /> Discard
        </Button>
      </div>
    </div>
  );
}

const PLACEHOLDER = 'Describe a correction... e.g. "transferred VFV from WS to IBKR on Mar 3, add the transfer-in"';

export default function TransactionAIAssistant() {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 0, role: 'assistant', content: 'Hi! Describe a transaction correction in plain English and I\'ll parse it for you.' }
  ]);
  const [pendingPatches, setPendingPatches] = useState(null);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const { transactions, accounts, updateTransferTransaction, createTransaction } = usePortfolioData();

  useEffect(() => {
    if (expanded && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expanded]);

  const knownTickers = [...new Set(transactions.map(t => t.ticker).filter(Boolean))];

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    const userMsg = { id: Date.now(), role: 'user', content: text };
    const pendingMsg = { id: Date.now() + 1, role: 'assistant', pending: true, content: '' };

    setMessages(prev => [...prev, userMsg, pendingMsg]);
    setThinking(true);
    setExpanded(true);

    await new Promise(r => setTimeout(r, 400));

    const result = parseTransactionInput(text, { accounts, transactions, knownTickers });
    const hasPatch = result.patches && result.patches.length > 0 && result.action !== null;

    setMessages(prev => prev.map(m =>
      m.id === pendingMsg.id
        ? { ...m, pending: false, content: result.explanation, patches: hasPatch ? result.patches : null }
        : m
    ));
    if (hasPatch) setPendingPatches(result.patches);
    setThinking(false);
  };

  const applyPatches = async () => {
    if (!pendingPatches) return;
    setThinking(true);
    try {
      for (const patch of pendingPatches) {
        if (patch.action === 'edit' && patch.id) {
          await updateTransferTransaction(patch.id, patch);
        } else if (patch.action === 'create') {
          await createTransaction(patch);
        }
      }
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `✓ Applied ${pendingPatches.length} change${pendingPatches.length > 1 ? 's' : ''} successfully.`
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `Failed to apply: ${err.message}`
      }]);
    } finally {
      setPendingPatches(null);
      setThinking(false);
    }
  };

  const discardPatches = () => {
    setPendingPatches(null);
    setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: 'Discarded. Try rephrasing or describe another correction.' }]);
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      {/* Collapsed header / expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
      >
        <Bot className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="font-medium text-primary mr-1">AI Assistant</span>
        <span className="truncate text-muted-foreground flex-1 text-left">
          {expanded ? 'Transaction corrections in plain English' : PLACEHOLDER}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
      </button>

      {/* Message history */}
      {expanded && (
        <div className="border-t border-border/40 max-h-56 overflow-y-auto px-3 py-2.5 space-y-2.5">
          {messages.map(msg => (
            <div key={msg.id}>
              <MessageBubble msg={msg} />
              {msg.patches && pendingPatches && (
                <div className="ml-7">
                  <PatchPreview patches={msg.patches} onApply={applyPatches} onDiscard={discardPatches} />
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input row */}
      <div className={cn('flex items-center gap-2 px-3 py-2', expanded && 'border-t border-border/40')}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={PLACEHOLDER}
          disabled={thinking}
          className="flex-1 h-7 bg-transparent text-xs placeholder:text-muted-foreground/50 outline-none text-foreground"
        />
        <Button
          size="sm"
          className="h-7 w-7 p-0 flex-shrink-0"
          disabled={!input.trim() || thinking}
          onClick={send}
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
