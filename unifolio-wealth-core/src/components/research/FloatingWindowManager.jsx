import React, { useEffect, useState } from 'react';
import { useResearchWindows } from '@/lib/ResearchWindowContext';
import FloatingResearchWindow from './FloatingResearchWindow';
import MobileResearchPopup from './MobileResearchPopup';

const MOBILE_BREAKPOINT = 768;

export default function FloatingWindowManager() {
  const { windows } = useResearchWindows();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (windows.length === 0) return null;

  // Mobile: show only first window as popup
  if (isMobile) {
    return windows[0] ? <MobileResearchPopup win={windows[0]} /> : null;
  }

  // Desktop: show all windows as floating panels
  return (
    <>
      {windows.map(win => (
        <FloatingResearchWindow key={win.id} win={win} />
      ))}
    </>
  );
}