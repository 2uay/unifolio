import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const ProfilePictureContext = createContext();

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// Resize non-GIF images to max 200×200 JPEG ~85% quality (~30–50 KB) for DB storage
function compressImageDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 200;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function ProfilePictureProvider({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [profilePicture, setProfilePicture] = useState(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait until auth has fully resolved — avoids false-negative clears
    // while Supabase is still reading the session from localStorage.
    if (isLoadingAuth) return;

    if (!isAuthenticated || !user?.id) {
      setProfilePicture(null);
      setIsAnimated(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('profile_picture_url, profile_picture_type')
          .eq('user_id', user.id)
          .single();

        if (cancelled) return;
        if (data?.profile_picture_url) {
          setProfilePicture(data.profile_picture_url);
          setIsAnimated(data.profile_picture_type === 'animated_gif');
        }
      } catch {
        // no profile row yet — fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadProfile();
    return () => { cancelled = true; };
  // user?.id (stable string) instead of user (object ref) prevents re-firing
  // on every TOKEN_REFRESHED / USER_UPDATED auth event.
  }, [isLoadingAuth, isAuthenticated, user?.id]);

  const updateProfilePicture = async (base64DataUrl, fileName = '', animated = false) => {
    if (!isAuthenticated || !user) throw new Error('Must be signed in to save profile picture');
    if (!base64DataUrl) throw new Error('Image data is required');

    // Compress static images to ≤200×200 JPEG; keep GIFs as-is (animation requires original data)
    const dataUrl = animated ? base64DataUrl : await compressImageDataUrl(base64DataUrl);

    const { error: dbError } = await withTimeout(
      supabase.from('user_profiles').upsert({
        user_id: user.id,
        profile_picture_url: dataUrl,
        profile_picture_type: animated ? 'animated_gif' : 'static',
        profile_picture_file_name: fileName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),
      15000,
      'Profile picture sync'
    );

    if (dbError) throw dbError;

    setProfilePicture(dataUrl);
    setIsAnimated(animated);
  };

  const removeProfilePicture = async () => {
    if (!isAuthenticated || !user) throw new Error('Must be signed in to remove profile picture');

    const { error: dbError } = await withTimeout(
      supabase.from('user_profiles').upsert({
        user_id: user.id,
        profile_picture_url: null,
        profile_picture_type: 'static',
        profile_picture_file_name: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),
      15000,
      'Profile picture sync'
    );

    if (dbError) throw dbError;

    setProfilePicture(null);
    setIsAnimated(false);
  };

  return (
    <ProfilePictureContext.Provider value={{ profilePicture, isAnimated, loading, updateProfilePicture, removeProfilePicture }}>
      {children}
    </ProfilePictureContext.Provider>
  );
}

export function useProfilePicture() {
  const context = useContext(ProfilePictureContext);
  if (!context) throw new Error('useProfilePicture must be used within ProfilePictureProvider');
  return context;
}
