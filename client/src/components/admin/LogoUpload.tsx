import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../../firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Trash2, Image as ImageIcon, CheckCircle, AlertCircle } from "lucide-react";

interface LogoUploadProps {
  currentLogoUrl?: string;
  onLogoChange: (logoUrl: string | null) => void;
  disabled?: boolean;
}

export default function LogoUpload({ currentLogoUrl, onLogoChange, disabled }: LogoUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'Seleziona un file immagine valido (JPG, PNG, GIF, WEBP)';
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return 'Il file è troppo grande. Dimensione massima: 5MB';
    }

    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      toast({
        title: "Errore",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const filename = `logos/logo_${timestamp}.${extension}`;
      
      // Create storage reference
      const logoRef = ref(storage, filename);
      
      // Upload file
      await uploadBytes(logoRef, file);
      
      // Get download URL
      const downloadURL = await getDownloadURL(logoRef);
      
      // Update preview and notify parent
      setPreview(downloadURL);
      onLogoChange(filename); // Store the path, not the full URL
      
      toast({
        title: "Successo",
        description: "Logo caricato con successo",
      });

    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento del logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!currentLogoUrl) return;

    setDeleting(true);

    try {
      // Delete from storage
      const logoRef = ref(storage, currentLogoUrl);
      await deleteObject(logoRef);
      
      // Update state
      setPreview(null);
      onLogoChange(null);
      
      toast({
        title: "Successo",
        description: "Logo eliminato con successo",
      });

    } catch (error) {
      console.error("Error deleting logo:", error);
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione del logo",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ImageIcon className="w-5 h-5" />
          <span>Logo Studio</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Logo Display */}
        {preview && (
          <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <img
                src={preview}
                alt="Logo Studio"
                className="max-h-32 max-w-full object-contain mx-auto mb-3"
              />
              <div className="flex items-center justify-center text-green-600 text-sm">
                <CheckCircle className="w-4 h-4 mr-1" />
                Logo attuale
              </div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        {!preview && (
          <div className="flex items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <div className="text-gray-600 mb-2">Nessun logo caricato</div>
              <div className="text-sm text-gray-500">
                Carica un'immagine per il logo del tuo studio
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Caricando..." : preview ? "Cambia Logo" : "Carica Logo"}
          </Button>

          {preview && (
            <Button
              onClick={handleDelete}
              disabled={disabled || deleting}
              variant="destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? "Eliminando..." : "Elimina"}
            </Button>
          )}
        </div>

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Guidelines */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            Formati supportati: JPG, PNG, GIF, WEBP
          </div>
          <div>• Dimensione massima: 5MB</div>
          <div>• Risoluzione consigliata: 400x200px</div>
          <div>• Sfondo trasparente consigliato per PNG</div>
        </div>
      </CardContent>
    </Card>
  );
}