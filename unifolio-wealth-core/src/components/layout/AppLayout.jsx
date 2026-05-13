import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSidebar } from '@/lib/SidebarContext';
import Sidebar from './Sidebar';
import FloatingWindowManager from '@/components/research/FloatingWindowManager';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import { cn } from '@/lib/utils';
import { useFloatingHoldings } from '@/lib/FloatingHoldingsContext';
import Holdings from '@/pages/Holdings';

export default function AppLayout() {
  const { desktopOpen } = useSidebar();
  const { isOpen: floatingHoldingsOpen } = useFloatingHoldings();
  const location = useLocation();
  const isHoldingsRoute = location.pathname === '/holdings';
  const isPlansRoute = location.pathname === '/plans';

  return (
    <>
      <Sidebar />
      <main className={cn(
        'relative min-h-screen bg-background overflow-x-hidden transition-all duration-300',
        desktopOpen ? 'lg:ml-56' : 'lg:ml-0'
      )}>
        <ThemedWaveBackground className="z-0" density={isPlansRoute ? 'snowglobe' : 'app'} />
        {/* Plans page is full-bleed (renders its own lush background) so it
            skips the standard header padding + page padding chrome. Other
            pages get the normal h-14 header spacing + content padding. */}
        {isPlansRoute ? (
          <div className="relative z-10 w-full">
            <Outlet />
          </div>
        ) : (
          <div className="relative z-10 pt-14 lg:pt-14 w-full">
            <div className="sm:p-4 md:p-6 w-full bg-transparent pt-4 pr-3 pl-3 pb-3">
              <div className="w-full">
                <Outlet />
              </div>
            </div>
          </div>
        )}
      </main>
      <FloatingWindowManager />
      {floatingHoldingsOpen && !isHoldingsRoute && (
        <div aria-hidden="true" style={{ position: 'fixed', left: -9999, top: 0, width: 1, height: 1, overflow: 'hidden', pointerEvents: 'none' }}>
          <Holdings />
        </div>
      )}
    </>
  );
}
