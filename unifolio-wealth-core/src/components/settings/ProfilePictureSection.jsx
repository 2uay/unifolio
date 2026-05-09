import React, { useState } from 'react';
import { Upload, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useProfilePicture } from '@/lib/ProfilePictureContext';
import Avatar from '@/components/shared/Avatar';
import ProfilePictureModal from './ProfilePictureModal';
import { toast } from 'sonner';

export default function ProfilePictureSection() {
  const { user, isDemoMode } = useAuth();
  const { profilePicture, updateProfilePicture, removeProfilePicture } = useProfilePicture();
  const [modalOpen, setModalOpen] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);

  const handleSave = async (base64Image, fileName, isAnimated) => {
    if (isDemoMode && !user) {
      setShowDemoPrompt(true);
      throw new Error('Sign in to save your profile picture');
    }

    try {
      await updateProfilePicture(base64Image, fileName, isAnimated);
      toast.success(`${isAnimated ? 'Animated ' : ''}profile picture updated successfully`);
    } catch (err) {
      toast.error(err.message || 'Failed to save profile picture');
      throw err;
    }
  };

  const handleRemove = async () => {
    if (isDemoMode && !user) {
      setShowDemoPrompt(true);
      return;
    }

    setRemoveLoading(true);
    try {
      await removeProfilePicture();
      toast.success('Profile picture removed');
    } catch (err) {
      toast.error(err.message || 'Failed to remove profile picture');
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <>
      <div className="bg-card rounded-xl border border-border p-3 sm:p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
          <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
          Profile Picture
        </div>

        <div className="space-y-4">
          {/* Current Avatar Preview */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
            <Avatar user={user} size="lg" showRing={true} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {profilePicture ? 'Current Profile Picture' : 'No Picture Set'}
              </p>
              <p className="text-xs text-muted-foreground">
                {profilePicture
                  ? 'Your profile picture appears across the app'
                  : 'Add a picture to personalize your profile'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => setModalOpen(true)}
              className="gap-2 flex-1 sm:flex-none"
            >
              <Upload className="w-4 h-4" />
              {profilePicture ? 'Change Picture' : 'Upload Picture'}
            </Button>

            {profilePicture && (
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={removeLoading}
                className="gap-2 flex-1 sm:flex-none border-destructive/30 text-destructive/80 hover:bg-destructive/5"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </Button>
            )}
          </div>

          {/* Demo Mode Notice */}
          {showDemoPrompt && (
            <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-3 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-400/80">Create an account to save your profile picture.</p>
                  <p className="text-xs text-amber-400/60 mt-1">
                    Your profile picture will be saved to your account and appear across the app.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                >
                  Sign In / Create Account
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDemoPrompt(false)}
                  className="flex-1 text-xs"
                >
                  Continue in Demo Mode
                </Button>
              </div>
            </div>
          )}

          {/* Info Text */}
          <p className="text-xs text-muted-foreground/60">
            Supported formats: JPG, PNG, WebP (max 5MB) or GIF (max 10MB, animated). Your profile picture will update instantly across the app.
          </p>
        </div>
      </div>

      {/* Profile Picture Modal */}
      <ProfilePictureModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setShowDemoPrompt(false);
        }}
        onSave={handleSave}
      />
    </>
  );
}