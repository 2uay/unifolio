import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ResearchWindowContext = createContext(null);

const STAGGER = 30;
const MOBILE_BREAKPOINT = 768;

function getSmartDimensions(viewportWidth, viewportHeight) {
  // Calculate smart window dimensions based on viewport
  const isMobile = viewportWidth < MOBILE_BREAKPOINT;
  
  if (isMobile) {
    return {
      width: Math.min(viewportWidth - 40, 360),
      height: Math.min(viewportHeight - 100, 500),
    };
  }
  
  // Desktop: 35-45% of viewport width
  const width = Math.max(360, Math.min(720, viewportWidth * 0.4));
  const height = Math.max(360, Math.min(720, viewportHeight * 0.65));
  
  return { width, height };
}

function getInitialPosition(count, viewportWidth, viewportHeight) {
  // Center-right positioning
  const dims = getSmartDimensions(viewportWidth, viewportHeight);
  const x = Math.max(80, viewportWidth - dims.width - 100 + (count % 3) * STAGGER);
  const y = Math.max(80, 100 + (count % 3) * STAGGER);
  return { x, y };
}

function isMobileView() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function ResearchWindowProvider({ children }) {
  const [windows, setWindows] = useState([]);
  const [zCounter, setZCounter] = useState(100);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const openCountRef = useRef(0);
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  // Track viewport resize
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      
      // Adjust windows to fit new viewport
      setWindows(prev => prev.map(w => {
        const dims = getSmartDimensions(window.innerWidth, window.innerHeight);
        return {
          ...w,
          width: Math.min(w.width, dims.width),
          height: Math.min(w.height, dims.height),
          x: Math.max(0, Math.min(w.x, window.innerWidth - Math.min(w.width, dims.width) - 20)),
          y: Math.max(0, Math.min(w.y, window.innerHeight - Math.min(w.height, dims.height) - 20)),
        };
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track route changes to auto-close mobile popups
  useEffect(() => {
    const handlePopState = () => {
      const newPath = window.location.pathname;
      if (newPath !== currentPath) {
        setCurrentPath(newPath);
        if (isMobileView()) {
          setWindows([]);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentPath]);

  const openWindow = useCallback((item) => {
    const isMobile = isMobileView();
    
    setWindows(prev => {
      const existing = prev.find(w => w.ticker === item.ticker);
      if (existing) {
        // Bring to front and flash
        const newZ = zCounter + 1;
        setZCounter(newZ);
        return prev.map(w =>
          w.ticker === item.ticker
            ? { ...w, zIndex: newZ, minimized: false, flash: true }
            : w
        );
      }
      
      const vw = typeof window !== 'undefined' ? window.innerWidth : viewportSize.width;
      const vh = typeof window !== 'undefined' ? window.innerHeight : viewportSize.height;
      const pos = getInitialPosition(openCountRef.current, vw, vh);
      const dims = getSmartDimensions(vw, vh);
      openCountRef.current += 1;
      const newZ = zCounter + 1;
      setZCounter(newZ);
      
      // On mobile, replace all windows with new one (single popup at a time)
      const newWindow = {
        id: `rw-${item.ticker}-${Date.now()}`,
        ticker: item.ticker,
        name: item.name,
        item,
        x: pos.x,
        y: pos.y,
        width: dims.width,
        height: dims.height,
        minimized: false,
        viewMode: 'full',
        zIndex: newZ,
        flash: false,
      };
      
      return isMobile ? [newWindow] : [...prev, newWindow];
    });
  }, [zCounter]);

  const closeWindow = useCallback((ticker) => {
    setWindows(prev => prev.filter(w => w.ticker !== ticker));
  }, []);

  const focusWindow = useCallback((ticker) => {
    if (isMobileView()) return; // No focus management on mobile
    setZCounter(prev => {
      const newZ = prev + 1;
      setWindows(ws =>
        ws.map(w => w.ticker === ticker ? { ...w, zIndex: newZ } : w)
      );
      return newZ;
    });
  }, []);

  const updateWindow = useCallback((ticker, patch) => {
    setWindows(prev => prev.map(w => w.ticker === ticker ? { ...w, ...patch } : w));
  }, []);

  const clearFlash = useCallback((ticker) => {
    setWindows(prev => prev.map(w => w.ticker === ticker ? { ...w, flash: false } : w));
  }, []);

  const closeAllWindows = useCallback(() => {
    setWindows([]);
  }, []);

  return (
    <ResearchWindowContext.Provider value={{ 
      windows, 
      openWindow, 
      closeWindow, 
      focusWindow, 
      updateWindow, 
      clearFlash,
      closeAllWindows,
      isMobileView: isMobileView(),
    }}>
      {children}
    </ResearchWindowContext.Provider>
  );
}

export function useResearchWindows() {
  const ctx = useContext(ResearchWindowContext);
  if (!ctx) throw new Error('useResearchWindows must be used inside ResearchWindowProvider');
  return ctx;
}