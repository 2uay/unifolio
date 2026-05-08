import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function DemoModeButton({ collapsed }) {
  const navigate = useNavigate();
  const { isAuthenticated, isDemoMode, exitDemoMode } = useAuth();

  if (isAuthenticated || !isDemoMode) {
    return null;
  }

  const handleSignIn = () => {
    exitDemoMode();
    navigate('/');
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
