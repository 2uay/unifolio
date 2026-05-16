import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlaidLink } from 'react-plaid-link';
import { Link2, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// MFA mandate cutover. Accounts created on or after this date must have at
// least one verified TOTP factor before they can connect a Plaid Item.
// Older accounts are grandfathered (we strongly encourage TOTP in Settings,
// but don't block them retroactively to avoid forcing existing users to
// scramble for an authenticator app the next time they sync).
const MFA_MANDATE_AFTER = new Date('2026-09-30T00:00:00Z');

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
      const res = await fetch('/api/plaid/action?action=exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          publicToken,
          institutionId: metadata?.institution?.institution_id || null,
          institutionName: metadata?.institution?.name || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Plan-cap rejection (402) carries upgradeUrl/addOnUrl so the
        // parent can route to the upgrade flow. The error string still
        // works as a fallback message for the existing toast UI.
        if (res.status === 402 && (data.upgradeUrl || data.addOnUrl)) {
          onError?.({
            message: data.message || 'Plan limit reached',
            planCap: true,
            upgradeUrl: data.upgradeUrl,
            addOnUrl: data.addOnUrl,
          });
          return;
        }
        throw new Error(data.error || data.message || 'Exchange failed');
      }
      onSuccess?.();
    } catch (err) {
      onError?.(err?.message || 'Connection failed');
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
  const { user, isPro, listMfaFactors } = useAuth();
  const navigate = useNavigate();
  const [linkToken, setLinkToken] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [planCapError, setPlanCapError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [mfaCheck, setMfaCheck] = useState({ loading: true, blocked: false });

  // Determine if this user must enroll TOTP before connecting Plaid.
  // Accounts created before MFA_MANDATE_AFTER are grandfathered.
  useEffect(() => {
    if (!user) return;
    const createdAt = user.created_at ? new Date(user.created_at) : new Date();
    if (createdAt < MFA_MANDATE_AFTER) {
      setMfaCheck({ loading: false, blocked: false });
      return;
    }
    let cancelled = false;
    listMfaFactors?.()
      .then(data => {
        if (cancelled) return;
        const verified = (data?.totp || []).some(f => f.status === 'verified');
        setMfaCheck({ loading: false, blocked: !verified });
      })
      .catch(() => {
        if (!cancelled) setMfaCheck({ loading: false, blocked: false });
      });
    return () => { cancelled = true; };
  }, [user, listMfaFactors]);

  useEffect(() => {
    if (!user || !isPro) return;
    if (mfaCheck.blocked || mfaCheck.loading) return;
    let cancelled = false;
    setFetching(true);
    setError(null);
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token;
      if (!token || cancelled) { if (!cancelled) setFetching(false); return; }
      fetch('/api/plaid/action?action=link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          if (d.link_token) setLinkToken(d.link_token);
          else setError(d.error || 'Could not start Plaid Link');
        })
        .catch(() => { if (!cancelled) setError('Network error — check connection'); })
        .finally(() => { if (!cancelled) setFetching(false); });
    });
    return () => { cancelled = true; };
  }, [user?.id, isPro, attempt, mfaCheck.blocked, mfaCheck.loading]);

  if (!isPro) return null;

  if (mfaCheck.blocked) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Two-factor authentication required</p>
            <p className="text-amber-200/80">Enable TOTP in Settings before connecting a brokerage.</p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/settings')}
          variant="outline"
          className="gap-2 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
        >
          <ShieldAlert className="w-4 h-4" /> Set up 2FA
        </Button>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <Button disabled className="gap-2 bg-primary text-primary-foreground opacity-70">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </Button>
      </div>
    );
  }

  if (linkToken) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <PlaidLinkOpener
          linkToken={linkToken}
          onSuccess={() => { setLinkToken(null); onSuccess?.(); }}
          onError={(errOrMessage) => {
            if (errOrMessage && typeof errOrMessage === 'object' && errOrMessage.planCap) {
              setPlanCapError(errOrMessage);
              setError(null);
            } else {
              setError(typeof errOrMessage === 'string' ? errOrMessage : errOrMessage?.message);
              setPlanCapError(null);
            }
          }}
        />
        {planCapError && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs space-y-1.5">
            <p className="text-amber-200">{planCapError.message}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(planCapError.upgradeUrl)}
                className="text-primary hover:underline"
              >
                Upgrade plan →
              </button>
              {planCapError.addOnUrl && (
                <button
                  type="button"
                  onClick={() => navigate(planCapError.addOnUrl)}
                  className="text-primary hover:underline"
                >
                  Add slot →
                </button>
              )}
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // No token yet (initial state or after error) — show connect button that triggers fetch
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Button
        onClick={() => setAttempt(a => a + 1)}
        className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <Link2 className="w-4 h-4" /> Connect a Brokerage
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
