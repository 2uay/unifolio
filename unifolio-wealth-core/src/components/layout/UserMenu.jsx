import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { Settings, LogOut, User, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Avatar from '@/components/shared/Avatar';

export default function UserMenu({ collapsed }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const displayName = user.full_name || user.email || 'User';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-secondary transition-colors text-left',
          collapsed && 'justify-center px-1'
        )}
      >
        <Avatar user={user} size="xs" showRing={false} />
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
              <p className="text-[9px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <ChevronDown className={cn('w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform', open && 'rotate-180')} />
          </>
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute bottom-full mb-1 z-50 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[180px]',
          collapsed ? 'left-0' : 'left-0 right-0'
        )}>
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
          <Link
            to="/profile"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            My Profile
          </Link>
          <Link
            to="/settings"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
