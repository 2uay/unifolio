import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const ProfilePictureContext = createContext();

export function ProfilePictureProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [profilePicture, setProfilePicture] = useState(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setProfilePicture(null);
      setIsAnimated(false);
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('profile_picture_url, profile_picture_type')
          .eq('user_id', user.id)
          .single();

        if (data?.profile_picture_url) {
          setProfilePicture(data.profile_picture_url);
          setIsAnimated(data.profile_picture_type === 'animated_gif');
        }
      } catch (err) {
        // no profile yet — that's fine
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [isAuthenticated, user]);

  const updateProfilePicture = async (base64DataUrl, fileName = '', animated = false) => {
    if (!isAuthenticated || !user) throw new Error('Must be signed in to save profile picture');
    if (!base64DataUrl) throw new Error('Image data is required');

    const resp = await fetch(base64DataUrl);
    const blob = await resp.blob();
    const ext = animated ? 'gif' : 'png';
    const path = `${user.id}/avatar.${ext}`;
    const file = new File([blob], fileName || `avatar.${ext}`, { type: blob.type });

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

    const { error: dbError } = await supabase.from('user_profiles').upsert({
      user_id: user.id,
      profile_picture_url: publicUrl,
      profile_picture_type: animated ? 'animated_gif' : 'static',
      profile_picture_file_name: fileName,
      updated_at: new Date().toISOString(),
    });

    if (dbError) throw dbError;

    setProfilePicture(publicUrl);
    setIsAnimated(animated);
  };

  const removeProfilePicture = async () => {
    if (!isAuthenticated || !user) throw new Error('Must be signed in to remove profile picture');

    // Try to remove both possible extensions
    await supabase.storage.from('avatars').remove([`${user.id}/avatar.png`, `${user.id}/avatar.gif`]);

    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      profile_picture_url: null,
      profile_picture_type: 'static',
      profile_picture_file_name: null,
      updated_at: new Date().toISOString(),
    });

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
