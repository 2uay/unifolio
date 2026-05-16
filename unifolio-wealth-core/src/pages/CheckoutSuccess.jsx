// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import LoginBackgroundWheel from '@/components/shared/LoginBackgroundWheel';
import SpinningLogo from '@/components/shared/SpinningLogo';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';

// /checkout/success — landing page after Stripe Checkout or Coinbase Commerce
// redirect. The webhook does the actual entitlement update; this page just
// polls user_profiles a few times until the plan changes, then shows a
// success state. If polling exhausts we still show success but tell the
// user it may take a minute (Stripe webhooks usually arrive within seconds,
// but Coinbase confirmations are blockchain-bound).
export default function CheckoutSuccess() {
  const { user, plan } = useAuth();
  const [pollAttempts, setPollAttempts] = useState(0);
  const [livePlan, setLivePlan] = useState(plan);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 8; i++) {
        if (cancelled) return;
        const { data } = await supabase
          .from('user_profiles')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const p = data?.plan;
        if (p && p !== 'free') {
          setLivePlan(p);
          setDone(true);
          return;
        }
        setPollAttempts(i + 1);
        await new Promise(r => setTimeout(r, 1500));
      }
      setDone(true); // exhausted; show "still processing" message
    };
    poll();
    return () => { cancelled = true; };
  }, [user?.id]);

  const planActivated = livePlan && livePlan !== 'free';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <LoginBackgroundWheel />
      <ThemedWaveBackground variant="ribbon" className="z-0" />
      <div className="relative z-10 px-4 pt-24 pb-16 max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <SpinningLogo size={64} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-4">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-emerald-400">Payment received</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">Thanks for upgrading.</h1>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md p-6 sm:p-8 space-y-5">
          {!done ? (
            <div className="flex items-center gap-3 text-sm text-foreground/85">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Activating your plan… (attempt {pollAttempts} of 8)</span>
            </div>
          ) : planActivated ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Plan active</p>
                  <p className="text-base font-bold text-foreground capitalize">{livePlan.replace('_', ' ')}</p>
                </div>
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed">
                You're all set. Your new entitlements apply immediately — head to your dashboard to explore the unlocked features.
              </p>
              <Link
                to="/holdings"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-[0_0_24px_hsl(var(--primary)/0.35)]"
              >
                Open dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground/85 leading-relaxed">
                Payment received — your plan should activate within a minute or two. (Crypto payments can take longer for blockchain confirmation.) Refresh the page or check your <Link to="/profile" className="text-primary hover:underline">profile</Link> to see the change.
              </p>
              <Link
                to="/holdings"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Open dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
