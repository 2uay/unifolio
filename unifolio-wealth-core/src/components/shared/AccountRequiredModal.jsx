import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { Lock } from 'lucide-react';

export default function AccountRequiredModal({ open, onOpenChange, title, description }) {
  const { navigateToLogin } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            {title || 'Create an Account'}
          </DialogTitle>
          <DialogDescription>
            {description || 'Create a free account to save your data and preferences.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            onClick={navigateToLogin}
            className="w-full"
            size="lg"
          >
            Sign In / Create Account
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Continue in Demo Mode
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Demo mode lets you explore freely. Sign in to save your portfolio and data.
        </p>
      </DialogContent>
    </Dialog>
  );
}