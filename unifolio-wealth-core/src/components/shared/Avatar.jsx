import React from 'react';
import { useProfilePicture } from '@/lib/ProfilePictureContext';
import { cn } from '@/lib/utils';

export default function Avatar({
  user,
  size = 'md',
  className,
  showRing = true,
  ringColor = 'primary'
}) {
  const { profilePicture, isAnimated } = useProfilePicture();

  const sizeMap = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 sm:w-12 sm:h-12 text-sm',
    lg: 'w-12 h-12 sm:w-16 sm:h-16 text-base',
    xl: 'w-16 h-16 sm:w-20 sm:h-20 text-lg'
  };

  const initials = user?.full_name ?
  user.full_name.
  split(' ').
  map((n) => n[0]).
  join('').
  slice(0, 2).
  toUpperCase() :
  user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  const ringColorClass = {
    primary: 'border-primary ring-primary/20',
    accent: 'border-accent ring-accent/20'
  }[ringColor] || 'border-primary ring-primary/20';

  return null;

























}