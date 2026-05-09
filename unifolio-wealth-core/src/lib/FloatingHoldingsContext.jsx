import { createContext, useContext, useState } from 'react';

const FloatingHoldingsContext = createContext(null);

export function FloatingHoldingsProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ x: 60, y: 60 });
  const [size, setSize] = useState({ w: 920, h: 580 });
  return (
    <FloatingHoldingsContext.Provider value={{ isOpen, setIsOpen, pos, setPos, size, setSize }}>
      {children}
    </FloatingHoldingsContext.Provider>
  );
}

export function useFloatingHoldings() {
  const ctx = useContext(FloatingHoldingsContext);
  if (!ctx) throw new Error('useFloatingHoldings must be used within FloatingHoldingsProvider');
  return ctx;
}
