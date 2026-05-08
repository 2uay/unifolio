import React, { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_GIF_FILE_SIZE = 10 * 1024 * 1024; // 10MB for GIFs

export default function ProfilePictureModal({ open, onClose, onSave }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isAnimated, setIsAnimated] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    setError(null);

    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      return;
    }

    // Validate file type
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Please choose JPG, PNG, WebP, or GIF.');
      return;
    }

    // Determine if GIF and set appropriate size limit
    const isGif = file.type === 'image/gif';
    const maxSize = isGif ? MAX_GIF_FILE_SIZE : MAX_FILE_SIZE;
    const maxSizeLabel = isGif ? '10MB' : '5MB';

    // Validate file size
    if (file.size > maxSize) {
      setError(`Please choose a smaller ${isGif ? 'GIF' : 'image'} (max ${maxSizeLabel}).`);
      return;
    }

    setSelectedFile(file);
    setIsAnimated(file.type === 'image/gif');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.onerror = () => {
      setError('Failed to load image.');
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSave = async () => {
    if (!preview || !selectedFile) return;

    setLoading(true);
    try {
      // Pass both base64 preview and original file name
      await onSave(preview, selectedFile.name, isAnimated);
      setSelectedFile(null);
      setPreview(null);
      setCropPosition({ x: 0, y: 0 });
      setIsAnimated(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save profile picture.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md [&>button]:hidden">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Change Profile Picture</DialogTitle>
          <button
            onClick={onClose}
            className="opacity-70 hover:opacity-100 transition-opacity rounded-sm p-1 hover:bg-accent"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Preview */}
          {preview ? (
           <div className="space-y-3">
             <div className="flex justify-center">
               <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-primary ring-2 ring-primary/20 flex-shrink-0">
                 <img
                   src={preview}
                   alt="Preview"
                   className="w-full h-full object-cover"
                   style={{
                     transform: `translate(${cropPosition.x}px, ${cropPosition.y}px)`,
                   }}
                 />
               </div>
             </div>

             <p className="text-xs text-muted-foreground text-center">
               {isAnimated ? 'Animated GIF preview' : 'This is how your avatar will appear'}
             </p>

             {isAnimated && (
               <p className="text-xs text-primary/70 text-center">
                 ✓ Animated profile picture
               </p>
             )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  Choose Another
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Picture'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Choose Profile Picture</p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP, or GIF (max 10MB)
                </p>
              </div>

              {/* Drag and drop note */}
              <p className="text-xs text-muted-foreground/60 text-center">
                Click to browse or drag and drop
              </p>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
              <X className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Hidden file input */}
           <input
             ref={fileInputRef}
             type="file"
             accept="image/jpeg,image/png,image/webp,image/gif"
             onChange={handleInputChange}
             className="hidden"
           />

          {/* Cancel Button */}
          {!preview && (
            <Button variant="outline" size="sm" onClick={onClose} className="w-full">
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
