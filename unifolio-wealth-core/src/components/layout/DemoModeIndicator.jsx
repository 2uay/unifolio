import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function DemoModeIndicator({ collapsed }) {
  const { isAuthenticated, isDemoMode } = useAuth();

  if (isAuthenticated || !isDemoMode) {
    return null;
  }

  return (
    <div className={cn(
      'flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5 rounded',
      collapsed && 'justify-center px-1'
    )}>
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 flex-shrink-0" />
      {!collapsed && <span className="text-amber-600">Demo Mode</span>}
    </div>
  );
}