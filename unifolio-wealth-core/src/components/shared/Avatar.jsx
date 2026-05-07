import React from 'react';
import { useProfilePicture } from '@/lib/ProfilePictureContext';
import { cn } from '@/lib/utils';

export default function Avatar({ user, size = 'md', className, showRing = true, ringColor = 'primary' }) {
  const { profilePicture, isAnimated } = useProfilePicture();

  const sizeMap = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  const ringClass = showRing ? `ring-2 ring-offset-1 ${ringColor === 'accent' ? 'ring-accent/40' : 'ring-primary/30'}` : '';

  if (profilePicture) {
    return (
      <img
        src={profilePicture}
        alt="Profile"
        className={cn('rounded-full object-cover flex-shrink-0', sizeMap[size] || sizeMap.md, ringClass, className)}
      />
    );
  }

  return (
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
}
