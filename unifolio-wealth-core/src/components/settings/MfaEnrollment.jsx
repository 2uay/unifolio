// TOTP MFA enrollment + management widget for the Settings page.
//
// Three states it can render:
//   1. Loading the user's existing factor list.
//   2. No verified factor yet → show enroll flow (QR + secret + 6-digit code prompt).
//   3. At least one verified factor → show "MFA enabled" + per-factor remove button.
//
// All TOTP crypto is handled by Supabase Auth. We only render the QR /
// secret it returns and forward the user-typed code to verify.

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldOff, Smartphone, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function MfaEnrollment() {
  const {
    listMfaFactors, enrollMfa, verifyMfaEnrollment, unenrollMfa,
  } = useAuth();

  const [factors, setFactors] = useState([]); // verified TOTP factors
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Enrollment-in-progress state
  const [enrolling, setEnrolling] = useState(false);
  const [enrollment, setEnrollment] = useState(null); // { id, totp: { qr_code, secret, uri } }
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Removal state
  const [removingId, setRemovingId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMfaFactors();
      // Supabase returns { all, totp } — totp is the verified TOTP factors.
      setFactors(Array.isArray(data?.totp) ? data.totp : []);
    } catch (err) {
      setError(err?.message || 'Failed to load MFA factors');
    } finally {
      setLoading(false);
    }
  }, [listMfaFactors]);

  useEffect(() => { refresh(); }, [refresh]);

  const startEnrollment = async () => {
    setError(null);
    setEnrolling(true);
    try {
      const data = await enrollMfa('Unifolio TOTP');
      setEnrollment(data);
    } catch (err) {
      setError(err?.message || 'Could not start enrollment');
    } finally {
      setEnrolling(false);
    }
  };

  const cancelEnrollment = async () => {
    if (enrollment?.id) {
      // Best-effort: clean up the unverified factor so it doesn't linger.
      try { await unenrollMfa(enrollment.id); } catch { /* ignore */ }
    }
    setEnrollment(null);
    setCode('');
    setError(null);
  };

  const verify = async () => {
    if (!enrollment?.id || code.length !== 6) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyMfaEnrollment(enrollment.id, code);
      setEnrollment(null);
      setCode('');
      await refresh();
    } catch (err) {
      setError(err?.message || 'Invalid code. Try again.');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const removeFactor = async (factorId) => {
    if (!window.confirm('Remove two-factor authentication? You will be able to sign in with just your password until you re-enable it.')) return;
    setRemovingId(factorId);
    setError(null);
    try {
      await unenrollMfa(factorId);
      await refresh();
    } catch (err) {
      setError(err?.message || 'Failed to remove factor');
    } finally {
      setRemovingId(null);
    }
  };

  const hasVerifiedFactor = factors.some(f => f.status === 'verified');

  if (loading) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/40">
        <div className="flex items-center gap-3">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Two-Factor Authentication</p>
            <p className="text-xs text-muted-foreground">Loading…</p>
          </div>
        </div>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Mid-enrollment: show QR + code prompt.
  if (enrollment) {
    return (
      <div className="py-3 border-b border-border/40 space-y-4">
        <div className="flex items-start gap-3">
          <Smartphone className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Set up two-factor authentication</p>
            <p className="text-xs text-muted-foreground">
              Scan the QR code with an authenticator app (1Password, Authy, Google Authenticator, etc.), then enter the 6-digit code below.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {enrollment.totp?.qr_code && (
            <div className="bg-white rounded-lg p-2 shrink-0">
              {/* Supabase returns the QR code as an SVG data URI string. */}
              <img src={enrollment.totp.qr_code} alt="MFA QR code" width="160" height="160" />
            </div>
          )}
          <div className="space-y-3 flex-1">
            {enrollment.totp?.secret && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Or enter this secret manually</p>
                <code className="text-xs font-mono break-all bg-secondary/40 rounded px-2 py-1 inline-block mt-1">
                  {enrollment.totp.secret}
                </code>
              </div>
            )}
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">6-digit code</p>
              <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}>
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
              <Button size="sm" onClick={verify} disabled={code.length !== 6 || verifying}>
                {verifying ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Verifying…</> : 'Confirm & enable'}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEnrollment} disabled={verifying}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Already enrolled.
  if (hasVerifiedFactor) {
    return (
      <div className="py-2 border-b border-border/40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-emerald-300/80">Enabled — sign-in requires a code from your authenticator app.</p>
            </div>
          </div>
        </div>
        <ul className="pl-7 space-y-1.5">
          {factors.filter(f => f.status === 'verified').map(f => (
            <li key={f.id} className="flex items-center justify-between text-xs">
              <div>
                <span className="font-medium">{f.friendly_name || 'Authenticator'}</span>
                <span className="text-muted-foreground ml-2">
                  added {f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeFactor(f.id)}
                disabled={removingId === f.id}
                className="h-6 px-2 text-destructive hover:bg-destructive/10"
              >
                {removingId === f.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <><Trash2 className="w-3 h-3 mr-1" /> Remove</>}
              </Button>
            </li>
          ))}
        </ul>
        {error && <p className="text-xs text-destructive pl-7">{error}</p>}
      </div>
    );
  }

  // Not enrolled.
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40">
      <div className="flex items-center gap-3">
        <ShieldOff className="w-4 h-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Two-Factor Authentication</p>
          <p className="text-xs text-muted-foreground">
            Add a second sign-in step using an authenticator app. Recommended before connecting your bank.
          </p>
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
      </div>
      <Button size="sm" onClick={startEnrollment} disabled={enrolling}>
        {enrolling ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Starting…</> : 'Enable'}
      </Button>
    </div>
  );
}
