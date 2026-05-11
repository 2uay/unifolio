import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, BarChart3, PieChart, Zap } from 'lucide-react';
import UnifolioWheelLogo from '@/components/shared/UnifolioWheelLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import LoginBackgroundWheel from '@/components/shared/LoginBackgroundWheel';
import LoginIridescentBackground from '@/components/shared/LoginIridescentBackground';
import LoginBrandReveal from '@/components/shared/LoginBrandReveal';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { cn } from '@/lib/utils';

const REMEMBERED_EMAIL_KEY = 'unifolio_remembered_email';

export default function Welcome() {
  const navigate = useNavigate();
  const { signIn, signUp, enterDemoMode, authNotice, clearAuthNotice, sendPasswordReset } = useAuth();
  const { resetToDefaultTheme, chartColors } = useTheme();

  const [tab, setTab] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [forgotSent, setForgotSent] = useState(false);
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''; } catch { return ''; }
  });
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try { return Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY)); } catch { return false; }
  });
  const [logoHovered, setLogoHovered] = useState(false);
  const [logoFlung, setLogoFlung] = useState(false);

  useEffect(() => {
    if (!authNotice) return;
    setTab('signin');
    setSignupSuccess(false);
    setError('');
  }, [authNotice]);

  const handleEnterDemo = () => {
    resetToDefaultTheme();
    clearAuthNotice?.();
    enterDemoMode();
    navigate('/holdings');
  };

  const handleSignIn = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    setError('');
    clearAuthNotice?.();
    setLoading(true);
    try {
      await signIn(email, password);
      try {
        if (rememberMe) localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      } catch {
        // Remember-me is a local convenience only.
      }
      navigate('/holdings');
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  function maskEmail(addr) {
    if (!addr?.includes('@')) return addr || '';
    const [local, domain] = addr.split('@');
    if (local.length <= 3) return `${'*'.repeat(local.length)}@${domain}`;
    const tail = local.slice(-3);
    return `${'*'.repeat(Math.min(local.length - 3, 12))}${tail}@${domain}`;
  }

  const handleForgot = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setForgotSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset email. Check your address and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    setError('');
    clearAuthNotice?.();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, fullName);
      setSignupSuccess(true);
    } catch (err) {
      setError(err.message || 'Sign up failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 pt-8 sm:pt-6 relative overflow-x-hidden overflow-y-auto"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <LoginIridescentBackground lineColors={chartColors} />
      <div className="absolute inset-0 z-0" style={{ opacity: 0.3, pointerEvents: 'none' }}>
        <ThemedWaveBackground variant="ribbon" />
      </div>
      <div className="hidden md:block"><LoginBackgroundWheel hovered={logoHovered} /></div>
      <LoginBrandReveal hovered={logoHovered} flung={logoFlung} />

      <div className="relative w-full max-w-md z-10">
        <div className="flex justify-center mb-6">
          <div className="relative inline-block rounded-full p-4">
            <UnifolioWheelLogo size={120} onHoverChange={setLogoHovered} onFlingChange={setLogoFlung} />
            <span className="absolute bottom-0 right-0 text-[9px] font-semibold text-primary/80 leading-none select-none">
              α<sub style={{ fontSize: '0.72em' }}>1.1</sub>
            </span>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-card/72 backdrop-blur-xl border border-border/70 rounded-2xl p-5 sm:p-7 shadow-2xl shadow-primary/10 space-y-5">
          {/* Tabs */}
          {tab !== 'forgot' && (
            <div className="flex rounded-lg bg-muted/40 p-0.5 gap-0.5">
              <button
                onClick={() => { setTab('signin'); setError(''); setSignupSuccess(false); clearAuthNotice?.(); }}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  tab === 'signin' ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab('signup'); setError(''); setSignupSuccess(false); clearAuthNotice?.(); }}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200',
                  tab === 'signup' ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Create Account
              </button>
            </div>
          )}

          {authNotice && (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-xs leading-relaxed',
                authNotice.type === 'error'
                  ? 'border-red-400/30 bg-red-500/10 text-red-300'
                  : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
              )}
            >
              {authNotice.message}
            </div>
          )}

          {/* Sign in form */}
          {tab === 'signin' && (
            <form
              onSubmit={handleSignIn}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !loading) {
                  event.preventDefault();
                  event.currentTarget.requestSubmit();
                }
              }}
              className="space-y-3"
            >
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/55 border-border/70 text-foreground placeholder:text-muted-foreground focus:border-primary/50"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/55 border-border/70 text-foreground placeholder:text-muted-foreground focus:border-primary/50"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  Remember me next time
                </label>
                <button
                  type="button"
                  onClick={() => { setTab('forgot'); setError(''); setForgotSent(false); clearAuthNotice?.(); }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          )}

          {/* Sign up form */}
          {tab === 'signup' && !signupSuccess && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <Input
                type="text"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-background/55 border-border/70 text-foreground placeholder:text-muted-foreground focus:border-primary/50"
              />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/55 border-border/70 text-foreground placeholder:text-muted-foreground focus:border-primary/50"
              />
              <Input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/55 border-border/70 text-foreground placeholder:text-muted-foreground focus:border-primary/50"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
            </form>
          )}

          {/* Sign up success */}
          {tab === 'signup' && signupSuccess && (
            <div className="text-center py-4 space-y-2">
              <div className="text-2xl">📬</div>
              <p className="text-foreground font-medium">Check your email</p>
              <p className="text-muted-foreground text-sm">We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it to activate your account, then sign in.</p>
              <button onClick={() => { setTab('signin'); setSignupSuccess(false); clearAuthNotice?.(); }} className="text-primary text-sm hover:underline mt-2">
                Back to sign in
              </button>
            </div>
          )}

          {/* Forgot password form */}
          {tab === 'forgot' && !forgotSent && (
            <form onSubmit={handleForgot} className="space-y-3">
              <div>
                <p className="text-foreground font-medium text-sm mb-1">Reset your password</p>
                <p className="text-muted-foreground text-xs">Enter your email and we'll send you a reset link.</p>
              </div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/55 border-border/70 text-foreground placeholder:text-muted-foreground focus:border-primary/50"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
              <button
                type="button"
                onClick={() => { setTab('signin'); setError(''); clearAuthNotice?.(); }}
                className="text-xs text-muted-foreground hover:text-foreground w-full text-center transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          )}

          {/* Forgot password sent confirmation */}
          {tab === 'forgot' && forgotSent && (
            <div className="text-center py-2 space-y-2">
              <div className="text-2xl">📬</div>
              <p className="text-foreground font-medium">Check your inbox</p>
              <p className="text-muted-foreground text-sm">
                We sent a password reset link to{' '}
                <span className="text-foreground font-mono">{maskEmail(email)}</span>.
                Click the link in the email to set a new password.
              </p>
              <button
                onClick={() => { setTab('signin'); setForgotSent(false); setError(''); clearAuthNotice?.(); }}
                className="text-primary text-sm hover:underline mt-2"
              >
                Back to sign in
              </button>
            </div>
          )}

          {tab !== 'forgot' && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/70" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card/80 px-3 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                onClick={handleEnterDemo}
                variant="outline"
                className="w-full h-11 border-border/80 text-foreground/85 hover:bg-primary/10 hover:text-foreground gap-2"
              >
                <Zap className="w-4 h-4" />
                Continue without logging in
              </Button>

              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/35 border border-border/70">
                <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your portfolio data is <strong className="text-foreground">private and tied to your account</strong>. Explore freely with demo data, sign in to save your portfolio.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: BarChart3, label: 'Multi-account tracking' },
            { icon: Shield, label: 'Bank-level security' },
            { icon: PieChart, label: 'Portfolio breakdown' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card/55 border border-border/60 text-center backdrop-blur-md">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
