import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { usePrivacy } from '@/lib/PrivacyContext.jsx';
import { cn } from '@/lib/utils';

export default function PrivacyToggle({ collapsed = false }) {
  const { privacyMode, togglePrivacy } = usePrivacy();

  return (
    <button
      onClick={togglePrivacy}
      title={privacyMode ? 'Privacy on — click to reveal' : 'Hide sensitive values'}
      className={cn(
        'flex items-center justify-center rounded-lg border transition-all duration-150',
        privacyMode
          ? 'border-primary/60 bg-primary/15 text-primary hover:bg-primary/25'
          : 'border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-secondary/80',
        collapsed ? 'p-2 w-full' : 'p-1.5'
      )}
    >
      {privacyMode
        ? <EyeOff className="w-3.5 h-3.5" />
        : <Eye className="w-3.5 h-3.5" />
      }
    </button>
  );
}