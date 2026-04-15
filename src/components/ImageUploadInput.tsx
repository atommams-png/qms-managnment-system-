import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { fileToBase64 } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageUploadInputProps {
  value?: string;
  onChange: (dataUrl: string) => void;
  label: string;
  required?: boolean;
}

export function ImageUploadInput({ value, onChange, label, required }: ImageUploadInputProps) {
  const [error, setError] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      toast.error('Invalid file type. Please select an image.');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      onChange(base64);
      toast.success('Image uploaded');
    } catch (err) {
      setError('Failed to upload image');
      toast.error('Failed to upload image');
    }
  };

  const handleClear = () => {
    onChange('');
    setError('');
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`image-upload-${label}`}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex gap-2">
        <input
          id={`image-upload-${label}`}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {value && (
        <div className="mt-2 rounded border border-border p-2">
          <img src={value} alt="Preview" className="h-20 w-auto rounded object-cover" />
        </div>
      )}
    </div>
  );
}
