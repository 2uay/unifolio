import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, TrendingUp, BarChart3, PieChart, Zap, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AccentBars from '@/components/shared/AccentBars';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function Welcome() {
  const navigate = useNavigate();
  const { signIn, signUp, enterDemoMode } = useAuth();

  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleEnterDemo = () => {
    enterDemoMode();
    navigate('/');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
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
      className="min-h-screen bg-black flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6 pt-8 sm:pt-6 relative overflow-x-hidden overflow-y-auto"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <AccentBars />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <circle cx="15%" cy="20%" r="320" fill="none" stroke="white" strokeWidth="1.5" opacity="0.08" />
        <circle cx="18%" cy="18%" r="250" fill="none" stroke="white" strokeWidth="1" opacity="0.06" />
        <circle cx="85%" cy="70%" r="400" fill="none" stroke="white" strokeWidth="1.5" opacity="0.07" />
        <circle cx="88%" cy="75%" r="300" fill="none" stroke="white" strokeWidth="1" opacity="0.05" />
        <circle cx="92%" cy="15%" r="150" fill="none" stroke="white" strokeWidth="1" opacity="0.04" />
        <circle cx="8%" cy="85%" r="180" fill="none" stroke="white" strokeWidth="1" opacity="0.04" />
        <line x1="0%" y1="30%" x2="100%" y2="50%" stroke="white" strokeWidth="0.8" opacity="0.03" />
        <line x1="0%" y1="60%" x2="100%" y2="40%" stroke="white" strokeWidth="0.8" opacity="0.03" />
        <defs>
          <pattern id="welcomeGrid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" strokeWidth="0.3" opacity="0.015" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#welcomeGrid)" />
      </svg>

      <div className="relative w-full max-w-md z-10">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 mb-4">
            <TrendingUp className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-1.5 text-white">
            <span className="text-amber-500">Uni</span>folio
          </h1>
          <p className="text-gray-400 text-sm">All your investments, one command center.</p>
        </div>

        {/* Main card */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-7 shadow-2xl space-y-5">
          {/* Tabs */}
          <div className="flex rounded-lg bg-white/5 p-0.5 gap-0.5">
            <button
              onClick={() => { setTab('signin'); setError(''); setSignupSuccess(false); }}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200',
                tab === 'signin' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => { setTab('signup'); setError(''); setSignupSuccess(false); }}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200',
                tab === 'signup' ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
              )}
            >
              Create Account
            </button>
          </div>

          {/* Sign in form */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-amber-500/50"
              />
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-amber-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
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
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-amber-500/50"
              />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-amber-500/50"
              />
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-amber-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
            </form>
          )}

          {/* Sign up success */}
          {tab === 'signup' && signupSuccess && (
            <div className="text-center py-4 space-y-2">
              <div className="text-2xl">📬</div>
              <p className="text-white font-medium">Check your email</p>
              <p className="text-gray-400 text-sm">We sent a confirmation link to <span className="text-white">{email}</span>. Click it to activate your account, then sign in.</p>
              <button onClick={() => { setTab('signin'); setSignupSuccess(false); }} className="text-amber-500 text-sm hover:underline mt-2">
                Back to sign in
              </button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-black/60 px-3 text-gray-500">or</span>
            </div>
          </div>

          <Button
            onClick={handleEnterDemo}
            variant="outline"
            className="w-full h-11 border-white/15 text-gray-300 hover:bg-white/10 hover:text-white gap-2"
          >
            <Zap className="w-4 h-4" />
            Continue without logging in
          </Button>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/5 border border-white/10">
            <Shield className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">
              Your portfolio data is <strong className="text-white">private and tied to your account</strong>. Explore freely with demo data, sign in to save your portfolio.
            </p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: BarChart3, label: 'Multi-account tracking' },
            { icon: Shield, label: 'Bank-level security' },
            { icon: PieChart, label: 'Portfolio breakdown' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-center">
              <Icon className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] text-gray-400 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
