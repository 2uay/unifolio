import React from 'react';
import { Outlet } from 'react-router-dom';
import { useSidebar } from '@/lib/SidebarContext';
import Sidebar from './Sidebar';
import FloatingWindowManager from '@/components/research/FloatingWindowManager';
import ThemedWaveBackground from '@/components/shared/ThemedWaveBackground';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const { desktopOpen } = useSidebar();

  return (
    <>
      <Sidebar />
      <main className={cn(
        'relative min-h-screen bg-background overflow-x-hidden transition-all duration-300',
        desktopOpen ? 'lg:ml-56' : 'lg:ml-0'
      )}>
        <ThemedWaveBackground className="z-0" />
        {/* Desktop: top spacing for fixed header (h-14) */}
        {/* Mobile/Tablet: top spacing for fixed header (h-14) */}
        <div className="relative z-10 pt-14 lg:pt-14 w-full">
          <div className="sm:p-4 md:p-6 w-full bg-transparent pt-4 pr-3 pl-3 pb-3">
            <div className="w-full">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
      <FloatingWindowManager />
    </>);

}
