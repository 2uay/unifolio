import React from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Shield, TrendingUp, BarChart3, Lock, PieChart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AccentBars from '@/components/shared/AccentBars';

export default function Welcome() {
  const navigate = useNavigate();

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleEnterDemo = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <AccentBars />
      {/* Premium black asymmetric background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        {/* Large asymmetric circles - upper left and lower right */}
        <circle cx="15%" cy="20%" r="320" fill="none" stroke="white" strokeWidth="1.5" opacity="0.08" />
        <circle cx="18%" cy="18%" r="250" fill="none" stroke="white" strokeWidth="1" opacity="0.06" />
        
        <circle cx="85%" cy="70%" r="400" fill="none" stroke="white" strokeWidth="1.5" opacity="0.07" />
        <circle cx="88%" cy="75%" r="300" fill="none" stroke="white" strokeWidth="1" opacity="0.05" />
        
        {/* Accent circles asymmetric */}
        <circle cx="92%" cy="15%" r="150" fill="none" stroke="white" strokeWidth="1" opacity="0.04" />
        <circle cx="8%" cy="85%" r="180" fill="none" stroke="white" strokeWidth="1" opacity="0.04" />
        
        {/* Diagonal flowing lines */}
        <line x1="0%" y1="30%" x2="100%" y2="50%" stroke="white" strokeWidth="0.8" opacity="0.03" />
        <line x1="0%" y1="60%" x2="100%" y2="40%" stroke="white" strokeWidth="0.8" opacity="0.03" />
        
        {/* Vertical accent lines */}
        <line x1="20%" y1="0%" x2="20%" y2="100%" stroke="white" strokeWidth="0.6" opacity="0.02" />
        <line x1="75%" y1="0%" x2="75%" y2="100%" stroke="white" strokeWidth="0.6" opacity="0.02" />
        
        {/* Subtle grid in background */}
        <defs>
          <pattern id="welcomeGrid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="white" strokeWidth="0.3" opacity="0.015" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#welcomeGrid)" />
      </svg>

      <div className="relative w-full max-w-md z-10">
        {/* Logo & Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 mb-5">
            <TrendingUp className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">
            <span className="text-amber-500">Uni</span>folio
          </h1>
          <p className="text-gray-400 text-base">
            All your investments, one command center.
          </p>
        </div>

        {/* Main Card - Glass style */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-white">Explore Unifolio</h2>
            <p className="text-sm text-gray-400">Start with sample data or connect your portfolio</p>
          </div>

          {/* Primary: Continue Without Login */}
          <Button
            onClick={handleEnterDemo}
            className="w-full h-11 text-base font-semibold gap-2 bg-amber-500 hover:bg-amber-600 text-black"
          >
            <Zap className="w-4 h-4" />
            Continue without logging in
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-black/60 px-3 text-gray-400">or</span>
            </div>
          </div>

          {/* Secondary: Sign In */}
          <Button
            onClick={handleLogin}
            variant="outline"
            className="w-full h-11 text-base font-medium border-white/20 text-white hover:bg-white/10"
          >
            <Lock className="w-4 h-4" />
            Sign In / Create Account
          </Button>

          {/* Security Note */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
            <Shield className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">
              Your portfolio data is <strong className="text-white">private and tied to your account</strong>. Explore freely with demo data, sign in to save your portfolio.
            </p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mt-6">
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