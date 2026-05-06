import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const ProfilePictureContext = createContext();

export function ProfilePictureProvider({ children }) {
  const [profilePicture, setProfilePicture] = useState(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load profile picture from user profile on mount
  useEffect(() => {
    const loadProfilePicture = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          setLoading(false);
          return;
        }

        const response = await base44.functions.invoke('getUserProfile', {});
        const profile = response.data.profile;
        
        if (profile && profile.profile_picture_url) {
          setProfilePicture(profile.profile_picture_url);
          setIsAnimated(profile.profile_picture_type === 'animated_gif');
        }
      } catch (err) {
        console.error('Failed to load profile picture:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfilePicture();
  }, []);

  const updateProfilePicture = async (base64DataUrl, fileName = '', animated = false) => {
    try {
      if (!base64DataUrl) {
        throw new Error('Image data is required');
      }

      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        throw new Error('Must be signed in to save profile picture');
      }

      // Convert base64 to blob and file
      const response = await fetch(base64DataUrl);
      const blob = await response.blob();
      const file = new File([blob], fileName || `avatar.${animated ? 'gif' : 'png'}`, { type: blob.type });

      // Upload file via UploadFile integration
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      const imageUrl = uploadResponse.file_url;

      // Save to UserProfile
      const saveResponse = await base44.functions.invoke('saveUserProfile', {
        profile_picture_url: imageUrl,
        profile_picture_type: animated ? 'animated_gif' : 'static',
        profile_picture_file_name: fileName,
        profile_picture_updated_at: new Date().toISOString()
      });

      if (saveResponse.data.success) {
        setProfilePicture(imageUrl);
        setIsAnimated(animated);
      } else {
        throw new Error('Failed to save profile picture');
      }
    } catch (err) {
      console.error('Failed to save profile picture:', err);
      throw err;
    }
  };

  const removeProfilePicture = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        throw new Error('Must be signed in to remove profile picture');
      }

      const response = await base44.functions.invoke('deleteUserProfilePicture', {});

      if (response.data.success) {
        setProfilePicture(null);
        setIsAnimated(false);
      } else {
        throw new Error('Failed to remove profile picture');
      }
    } catch (err) {
      console.error('Failed to remove profile picture:', err);
      throw err;
    }
  };

  return (
    <ProfilePictureContext.Provider
      value={{
        profilePicture,
        isAnimated,
        updateProfilePicture,
        removeProfilePicture,
        loading,
      }}
    >
      {children}
    </ProfilePictureContext.Provider>
  );
}

export function useProfilePicture() {
  const context = useContext(ProfilePictureContext);
  if (!context) {
    throw new Error('useProfilePicture must be used within ProfilePictureProvider');
  }
  return context;
}