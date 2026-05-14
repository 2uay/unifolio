import React, { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { writeAudit } from '@/lib/auditLog';
import { cn } from '@/lib/utils';

// Inner component — only rendered when an update-mode link_token is ready.
function PlaidReconnectOpener({ linkToken, itemId, onReconnected, onError, className }) {
  const [busy, setBusy] = useState(false);

  const handleSuccess = useCallback(async () => {
    setBusy(true);
    try {
      // The reconnect itself doesn't return a public_token — Plaid quietly
      // rebinds the existing access_token. Trigger a fresh sync to clear the
      // error state and pull any data Plaid was holding back.
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token;
      if (token) {
        await fetch('/api/plaid/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ itemId }),
        });
      }
      writeAudit('plaid_item_reconnected', { item_id: itemId });
      onReconnected?.();
    } catch (err) {
      onError?.(err.message || 'Reconnect succeeded but sync failed');
    } finally {
      setBusy(false);
    }
  }, [itemId, onReconnected, onError]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: (err) => {
      if (err) onError?.(err.error_message || 'Plaid Link closed with error');
    },
  });

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || busy}
      size="sm"
      variant="outline"
      className={cn('gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10', className)}
    >
      {busy
        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reconnecting…</>
        : <><RefreshCw className="w-3.5 h-3.5" /> Reconnect</>
      }
    </Button>
  );
}

export default function PlaidReconnectButton({ itemId, onReconnected, onError, className }) {
  const [linkToken, setLinkToken] = useState(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    setFetching(true);
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token;
      if (!token || cancelled) { if (!cancelled) setFetching(false); return; }
      fetch('/api/plaid/link-token-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId }),
      })
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          if (data?.link_token) setLinkToken(data.link_token);
          else onError?.(data?.error || 'Could not generate reconnect link');
        })
        .catch(err => onError?.(err?.message || 'Network error'))
        .finally(() => { if (!cancelled) setFetching(false); });
    });
    return () => { cancelled = true; };
  }, [itemId, onError]);

  if (fetching || !linkToken) {
    return (
      <Button size="sm" variant="outline" disabled className={cn('gap-1.5', className)}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing…
      </Button>
    );
  }

  return (
    <PlaidReconnectOpener
      linkToken={linkToken}
      itemId={itemId}
      onReconnected={onReconnected}
      onError={onError}
      className={className}
    />
  );
}
