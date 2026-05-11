import React from 'react';
import { ChevronRight } from 'lucide-react';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import LoginBackgroundWheel from '@/components/shared/LoginBackgroundWheel';
import SpinningLogo from '@/components/shared/SpinningLogo';
import Plans from '@/pages/Plans';

export default function ProLanding({ onSkipToLogin }) {
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <ThemedWaveBackground variant="ribbon" className="z-0" />
      <LoginBackgroundWheel />

      <div className="fixed top-4 right-4 z-30">
        <button
          onClick={onSkipToLogin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                     text-muted-foreground hover:text-foreground
                     border border-border/40 hover:border-border
                     bg-background/60 backdrop-blur-sm
                     transition-all active:scale-95"
        >
          Skip to Login
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative z-10">
        <Plans logoSlot={<SpinningLogo size={80} />} />
      </div>
    </div>
  );
}
