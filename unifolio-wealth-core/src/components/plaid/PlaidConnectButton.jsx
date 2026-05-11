import React, { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Link2, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Inner component — only rendered when a real link_token is ready.
// This ensures usePlaidLink is never called with a null token.
function PlaidLinkOpener({ linkToken, onSuccess, onError, className }) {
  const [exchanging, setExchanging] = useState(false);

  const handleSuccess = useCallback(async (publicToken, metadata) => {
    setExchanging(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s?.session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          publicToken,
          institutionId: metadata?.institution?.institution_id || null,
          institutionName: metadata?.institution?.name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Exchange failed');
      onSuccess?.();
    } catch (err) {
      onError?.(err.message || 'Connection failed');
    } finally {
      setExchanging(false);
    }
  }, [onSuccess, onError]);

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
      disabled={!ready || exchanging}
      className={cn('gap-2 bg-primary hover:bg-primary/90 text-primary-foreground', className)}
    >
      {exchanging
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
        : <><Link2 className="w-4 h-4" /> Connect a Brokerage</>
      }
    </Button>
  );
}

export default function PlaidConnectButton({ onSuccess, className }) {
  const { user, isPro } = useAuth();
  const [linkToken, setLinkToken] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !isPro) return;
    let cancelled = false;
    setFetching(true);
    setError(null);
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token;
      if (!token || cancelled) { if (!cancelled) setFetching(false); return; }
      fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          if (d.link_token) setLinkToken(d.link_token);
          else setError(d.error || 'Could not start Plaid Link');
        })
        .catch(() => { if (!cancelled) setError('Network error fetching link token'); })
        .finally(() => { if (!cancelled) setFetching(false); });
    });
    return () => { cancelled = true; };
  }, [user?.id, isPro]);

  if (!isPro) return null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {fetching || !linkToken ? (
        <Button disabled className="gap-2 bg-primary text-primary-foreground opacity-70">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </Button>
      ) : (
        <PlaidLinkOpener
          linkToken={linkToken}
          onSuccess={() => { setLinkToken(null); onSuccess?.(); }}
          onError={setError}
        />
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
