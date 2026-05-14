// Sign-in MFA prompt.
//
// Rendered after a successful password sign-in when the user has at least
// one verified TOTP factor and the session AAL is still aal1 (i.e. AAL2 is
// required to access protected routes). Lists the user's TOTP factors,
// challenges the chosen one, and verifies the 6-digit code. On success the
// session AAL upgrades to aal2 and the parent dismisses this view.

import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function MfaChallenge({ onVerified, onCancel }) {
  const { listMfaFactors, challengeMfa, verifyMfaChallenge, logout } = useAuth();
  const [factors, setFactors] = useState([]);
  const [factorId, setFactorId] = useState(null);
  const [challengeId, setChallengeId] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  // Load factors + start challenge on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listMfaFactors();
        const verified = (data?.totp || []).filter(f => f.status === 'verified');
        if (cancelled) return;
        if (verified.length === 0) {
          setError('No verified MFA factor found. Contact support.');
          return;
        }
        setFactors(verified);
        const first = verified[0];
        setFactorId(first.id);
        const ch = await challengeMfa(first.id);
        if (cancelled) return;
        setChallengeId(ch.id);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not start MFA challenge');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [listMfaFactors, challengeMfa]);

  const verify = async () => {
    if (!factorId || !challengeId || code.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyMfaChallenge(factorId, challengeId, code);
      onVerified?.();
    } catch (err) {
      setError(err?.message || 'Invalid code. Try again.');
      setCode('');
      // Restart the challenge so a fresh challenge_id is used next attempt.
      try {
        const ch = await challengeMfa(factorId);
        setChallengeId(ch.id);
      } catch (chErr) {
        setError(chErr?.message || 'Could not refresh challenge');
      }
    } finally {
      setVerifying(false);
    }
  };

  const cancel = async () => {
    // Failure-to-verify means we need to drop the partial session — otherwise
    // the user is left holding an aal1 token that can't access protected routes
    // but isn't expired yet either.
    try { await logout(); } catch { /* ignore */ }
    onCancel?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold">Two-factor verification</h2>
          <p className="text-xs text-muted-foreground">
            Enter the 6-digit code from your authenticator app to finish signing in.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Preparing challenge…
        </div>
      ) : (
        <>
          {factors.length > 1 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Factor</p>
              <select
                className="w-full text-sm bg-card border border-border rounded-md px-2 py-1.5"
                value={factorId || ''}
                onChange={async (e) => {
                  const newId = e.target.value;
                  setFactorId(newId);
                  setCode('');
                  setError(null);
                  try {
                    const ch = await challengeMfa(newId);
                    setChallengeId(ch.id);
                  } catch (err) {
                    setError(err?.message || 'Could not switch factor');
                  }
                }}
              >
                {factors.map(f => (
                  <option key={f.id} value={f.id}>{f.friendly_name || 'Authenticator'}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <InputOTP
              maxLength={6}
              value={code}
              onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={verify}
              disabled={code.length !== 6 || verifying || !challengeId}
              className="flex-1"
            >
              {verifying ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Verifying…</> : 'Verify'}
            </Button>
            <Button variant="outline" onClick={cancel} disabled={verifying}>
              <LogOut className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
