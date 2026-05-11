import React from 'react';
import { useProfilePicture } from '@/lib/ProfilePictureContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

const GOLD = ['#FFD700','#FFBE0B','#FFD43B','#FFC200','#FFEC6E','#FF9900','#FFF0A0','#E5AC00','#FFD700','#FFBE0B','#FFD43B','#FFC200'];

function MiniGoldWheelBadge({ size = 14 }) {
  const N = 12, cx = 7, cy = 7, R = 5;
  return (
    <svg viewBox="0 0 14 14" width={size} height={size} style={{ display: 'block', filter: 'drop-shadow(0 0 2px rgba(255,200,0,0.8))' }}>
      {Array.from({ length: N }, (_, i) => {
        const angle = (i / N) * Math.PI * 2;
        return <circle key={i} cx={cx + R * Math.cos(angle)} cy={cy + R * Math.sin(angle)} r={1.3} fill={GOLD[i]} />;
      })}
    </svg>
  );
}

export default function Avatar({ user, size = 'md', className, showRing = true, ringColor = 'primary' }) {
  const { profilePicture } = useProfilePicture();
  const { isPro } = useAuth();

  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const badgeSizeMap = { xs: 10, sm: 12, md: 14, lg: 16, xl: 20 };

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  const ringClass = showRing ? `ring-2 ring-offset-1 ${ringColor === 'accent' ? 'ring-accent/40' : 'ring-primary/30'}` : '';

  const inner = profilePicture ? (
    <img
      src={profilePicture}
      alt="Profile"
      className={cn('rounded-full object-cover flex-shrink-0', sizeMap[size] || sizeMap.md, ringClass, className)}
    />
  ) : (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0 bg-primary/20 text-primary select-none',
        sizeMap[size] || sizeMap.md,
        ringClass,
        className
      )}
    >
      {initials}
    </div>
  );

  if (!isPro) return inner;

  return (
    <div className="relative inline-flex flex-shrink-0">
      {inner}
      <div
        className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card flex items-center justify-center"
        style={{ padding: 1, border: '1px solid rgba(234,179,8,0.5)' }}
      >
        <MiniGoldWheelBadge size={badgeSizeMap[size] || 14} />
      </div>
    </div>
  );
}
