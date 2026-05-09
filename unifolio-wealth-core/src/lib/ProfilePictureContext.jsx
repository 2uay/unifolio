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

// Resize non-GIF images to max 200×200 JPEG ~85% quality (~30–50 KB)
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

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = (header.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export function ProfilePictureProvider({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [profilePicture, setProfilePicture] = useState(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [isLoadingAuth, isAuthenticated, user?.id]);

  const updateProfilePicture = async (base64DataUrl, fileName = '', animated = false) => {
    if (!isAuthenticated || !user) throw new Error('Must be signed in to save profile picture');
    if (!base64DataUrl) throw new Error('Image data is required');

    // Compress static images; keep GIFs as-is (animation requires original data)
    const dataUrl = animated ? base64DataUrl : await compressImageDataUrl(base64DataUrl);

    // Upload binary to Supabase Storage
    const blob = dataUrlToBlob(dataUrl);
    const ext = animated ? 'gif' : 'jpg';
    const storagePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await withTimeout(
      supabase.storage.from('avatars').upload(storagePath, blob, {
        upsert: true,
        contentType: blob.type,
      }),
      20000,
      'Profile picture upload'
    );
    if (uploadError) throw new Error(uploadError.message || 'Upload failed');

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(storagePath);
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: dbError } = await withTimeout(
      supabase.from('user_profiles').upsert({
        user_id: user.id,
        profile_picture_url: versionedUrl,
        profile_picture_type: animated ? 'animated_gif' : 'static',
        profile_picture_file_name: storagePath,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),
      15000,
      'Profile picture sync'
    );
    if (dbError) throw new Error(dbError.message || 'Database sync failed');

    setProfilePicture(versionedUrl);
    setIsAnimated(animated);
  };

  const removeProfilePicture = async () => {
    if (!isAuthenticated || !user) throw new Error('Must be signed in to remove profile picture');

    // Best-effort removal from storage — ignore errors (file may not exist)
    await supabase.storage.from('avatars').remove([
      `${user.id}/avatar.jpg`,
      `${user.id}/avatar.gif`,
    ]);

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
    if (dbError) throw new Error(dbError.message || 'Database sync failed');

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
