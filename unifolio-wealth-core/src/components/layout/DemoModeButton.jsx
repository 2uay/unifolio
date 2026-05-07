import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function DemoModeButton({ collapsed }) {
  const { isAuthenticated, isDemoMode, logout } = useAuth();

  if (isAuthenticated || !isDemoMode) {
    return null;
  }

  const handleSignIn = () => {
    // Exit demo mode by logging out (which clears isDemoMode) and reloading → Welcome page shows
    logout().then(() => window.location.reload());
  };

  return (
    <Button
      onClick={handleSignIn}
      size="sm"
      className={cn(
        'text-xs font-medium gap-1.5 h-8',
        collapsed && 'px-2 w-full justify-center'
      )}
      title="Sign in or create an account to save your data"
    >
      {!collapsed ? 'Sign In / Create' : 'Sign In'}
    </Button>
  );
}