import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import UnifolioWheelLogo from '@/components/shared/UnifolioWheelLogo';

// 'verifying' → waiting for PASSWORD_RECOVERY event
// 'ready'     → form shown
// 'expired'   → no recovery event within timeout
// 'success'   → password updated, countdown running
const VERIFY_TIMEOUT = 6000; // ms before showing "link expired"
const REDIRECT_AFTER = 5;    // seconds countdown

export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_AFTER);
  const readyRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        readyRef.current = true;
        setStatus('ready');
      }
    });

    const timeout = setTimeout(() => {
      if (!readyRef.current) setStatus('expired');
    }, VERIFY_TIMEOUT);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (status !== 'success') return;
    if (countdown <= 0) { navigate('/'); return; }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [status, countdown, navigate]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus('success');
      setCountdown(REDIRECT_AFTER);
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <ThemedWaveBackground variant="ribbon" className="z-0" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <UnifolioWheelLogo size={80} />
        </div>

        <div className="bg-card/72 backdrop-blur-xl border border-border/70 rounded-2xl p-6 shadow-2xl shadow-primary/10">
          {status === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            </div>
          )}

          {status === 'expired' && (
            <div className="text-center space-y-3">
              <p className="text-foreground font-semibold">Link expired</p>
              <p className="text-muted-foreground text-sm">
                This password reset link has expired or is invalid. Request a new one from the login page.
              </p>
              <button
                onClick={() => navigate('/')}
                className="text-primary text-sm hover:underline"
              >
                Back to sign in
              </button>
            </div>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-foreground font-semibold text-lg">Set new password</h2>
                <p className="text-muted-foreground text-xs mt-0.5">Choose a strong password for your account.</p>
              </div>
              <Input
                type="password"
                placeholder="New password (min 6 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                className="bg-background/55 border-border/70 text-foreground placeholder:text-muted-foreground focus:border-primary/50"
              />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="bg-background/55 border-border/70 text-foreground placeholder:text-muted-foreground focus:border-primary/50"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}

          {status === 'success' && (
            <div className="text-center space-y-3 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-foreground font-semibold text-lg">Password updated!</p>
              <p className="text-muted-foreground text-sm">
                Redirecting to sign in in{' '}
                <span className="text-foreground font-medium tabular-nums">{countdown}</span>…
              </p>
              <button
                onClick={() => navigate('/')}
                className="text-primary text-sm hover:underline"
              >
                Go now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
