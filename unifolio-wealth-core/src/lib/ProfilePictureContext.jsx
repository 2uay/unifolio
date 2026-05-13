import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const ProfilePictureContext = createContext();

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

// localStorage cache key — persists per-user picture URL so the avatar shows
// instantly on next sign-in / page reload without waiting for the Supabase
// fetch. Survives re-renders / re-mounts within a session too. Cleared only
// on explicit sign-out or removeProfilePicture.
const PIC_CACHE_KEY = 'unifolio_profile_picture_cache_v1';

function readPictureCache() {
  try { return JSON.parse(localStorage.getItem(PIC_CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function writePictureCache(userId, url, animated) {
  if (!userId) return;
  try {
    const cache = readPictureCache();
    if (url) cache[userId] = { url, animated, ts: Date.now() };
    else delete cache[userId];
    localStorage.setItem(PIC_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore quota errors */ }
}

export function ProfilePictureProvider({ children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  // Seed initial state from localStorage so the avatar shows immediately on
  // mount instead of flashing initials → picture → initials → picture as
  // auth settles and the network fetch completes.
  const initialFromCache = (() => {
    if (!user?.id) return { url: null, animated: false };
    const cache = readPictureCache();
    const entry = cache[user.id];
    return entry ? { url: entry.url, animated: !!entry.animated } : { url: null, animated: false };
  })();
  const [profilePicture, setProfilePicture] = useState(initialFromCache.url);
  const [isAnimated, setIsAnimated] = useState(initialFromCache.animated);
  const [loading, setLoading] = useState(true);
  // Track which user's picture we've actually loaded so transient
  // re-renders (e.g. portfolio data settling, USER_UPDATED events) don't
  // wipe the picture between fetches. Only clear on a confirmed sign-out.
  const loadedForUserRef = useRef(initialFromCache.url ? user?.id : null);

  useEffect(() => {
    if (isLoadingAuth) return;

    if (!isAuthenticated || !user?.id) {
      // Only clear if we previously had a user — protects against transient
      // unauthenticated states during session refresh.
      if (loadedForUserRef.current) {
        writePictureCache(loadedForUserRef.current, null);
        setProfilePicture(null);
        setIsAnimated(false);
        loadedForUserRef.current = null;
      }
      setLoading(false);
      return;
    }

    // Same user as before — no need to refetch and risk clobbering with stale null
    if (loadedForUserRef.current === user.id) {
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
          writePictureCache(user.id, data.profile_picture_url, data.profile_picture_type === 'animated_gif');
        }
        // Mark as loaded for this user even if no picture — prevents
        // re-fetch loops on every effect rerun with the same user.
        loadedForUserRef.current = user.id;
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

    const { error: uploadError } = await supabase.storage.from('avatars').upload(storagePath, blob, {
      upsert: true,
      contentType: blob.type,
    });
    if (uploadError) throw new Error(uploadError.message || 'Upload failed');

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(storagePath);
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: dbError } = await supabase.from('user_profiles').upsert({
      user_id: user.id,
      profile_picture_url: versionedUrl,
      profile_picture_type: animated ? 'animated_gif' : 'static',
      profile_picture_file_name: storagePath,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (dbError) throw new Error(dbError.message || 'Database sync failed');

    setProfilePicture(versionedUrl);
    setIsAnimated(animated);
    writePictureCache(user.id, versionedUrl, animated);
    loadedForUserRef.current = user.id;
  };

  const removeProfilePicture = async () => {
    if (!isAuthenticated || !user) throw new Error('Must be signed in to remove profile picture');

    // Best-effort removal from storage — ignore errors (file may not exist)
    await supabase.storage.from('avatars').remove([
      `${user.id}/avatar.jpg`,
      `${user.id}/avatar.gif`,
    ]);

    const { error: dbError } = await supabase.from('user_profiles').upsert({
      user_id: user.id,
      profile_picture_url: null,
      profile_picture_type: 'static',
      profile_picture_file_name: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (dbError) throw new Error(dbError.message || 'Database sync failed');

    setProfilePicture(null);
    setIsAnimated(false);
    writePictureCache(user.id, null);
    loadedForUserRef.current = user.id;
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
