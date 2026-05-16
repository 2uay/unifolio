// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, Users, ArrowRight } from 'lucide-react';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import LoginBackgroundWheel from '@/components/shared/LoginBackgroundWheel';
import SpinningLogo from '@/components/shared/SpinningLogo';
import { useAuth } from '@/lib/AuthContext';
import { acceptHouseholdInvite } from '@/lib/householdClient';

// /household/accept?token=... — the page an invitee lands on. Three states:
//   1. Not signed in → prompt to sign in with the invited email
//   2. Signed in, accepting → spinner, posts to api/household/accept
//   3. Done → success or error display
export default function HouseholdAccept() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [state, setState] = useState('idle'); // 'idle' | 'accepting' | 'done' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!isAuthenticated) return;
    if (!token || state !== 'idle') return;
    setState('accepting');
    acceptHouseholdInvite(token)
      .then(() => setState('done'))
      .catch((err) => {
        setErrorMessage(err?.message || 'Could not accept invite');
        setState('error');
      });
  }, [isAuthenticated, isLoadingAuth, token, state]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginBackgroundWheel />
      <ThemedWaveBackground variant="ribbon" className="z-0" />
      <div className="relative z-10 px-4 pt-24 pb-16 max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <SpinningLogo size={64} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-4">
            <Users className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-primary">Household invite</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            {state === 'done' ? 'You\'re in.' : 'Accept household invite'}
          </h1>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md p-6 sm:p-8 space-y-5">
          {!token && (
            <p className="text-sm text-foreground/85">
              This link is missing its invite token. Ask whoever sent it to share the full URL.
            </p>
          )}

          {token && isLoadingAuth && (
            <div className="flex items-center gap-3 text-sm text-foreground/85">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Checking your session…</span>
            </div>
          )}

          {token && !isLoadingAuth && !isAuthenticated && (
            <div className="space-y-3">
              <p className="text-sm text-foreground/85 leading-relaxed">
                You need to be signed in to accept this invite. Make sure to sign in
                with <strong>the same email address</strong> the invite was sent to.
              </p>
              <Link
                to="/"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Sign in <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {state === 'accepting' && (
            <div className="flex items-center gap-3 text-sm text-foreground/85">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Joining the household…</span>
            </div>
          )}

          {state === 'done' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/5 px-3 py-2 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/85">
                  Your accounts are now linked. The Harvest Center will flag
                  cross-spousal superficial losses for both of you before you trade.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Open profile <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-rose-400/40 bg-rose-400/5 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/85">{errorMessage}</p>
              </div>
              <Link
                to="/"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-border text-foreground hover:bg-secondary/80"
              >
                Back to Unifolio
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
