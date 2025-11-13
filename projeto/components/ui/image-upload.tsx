"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, UploadCloud, XCircle } from "lucide-react";
import Image from "next/image";

interface ImageUploadProps {
  bucketName?: string; // Nome do bucket no Supabase Storage (padrão: 'images')
  initialImageUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  onUploadError?: (error: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  bucketName = "images",
  initialImageUrl,
  onUploadSuccess,
  onUploadError,
  onRemove,
  disabled,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🧩 Função de upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!event.target.files || event.target.files.length === 0) {
      setError("Por favor, selecione um arquivo para upload.");
      return;
    }

    const file = event.target.files[0];
    const filePath = `fotos/${Date.now()}-${file.name}`;

    setIsUploading(true);

    try {
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) throw new Error("Não foi possível obter a URL pública da imagem.");

      setImageUrl(publicUrl);
      onUploadSuccess(publicUrl);
    } catch (err: any) {
      console.error("Erro no upload da imagem:", err);
      const errorMessage = err.message || "Erro desconhecido ao fazer upload.";
      setError(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // 🧩 Função de remoção
  const handleRemoveImage = () => {
    setImageUrl(null);
    onRemove?.();
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      {imageUrl && (
        <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-gray-700 shadow-md">
          <Image
            src={imageUrl}
            alt="Uploaded Image"
            fill
            className="object-cover rounded-lg"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-red-600 rounded-full p-1 text-white hover:bg-red-700 transition-colors z-10"
              disabled={isUploading}
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      <label
        htmlFor="image-upload-input"
        className={`flex items-center justify-center w-full max-w-xs px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${
            isUploading || disabled
              ? "bg-gray-700 border-gray-600 text-gray-400 cursor-not-allowed"
              : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-[#D6C6AA]"
          }`}
      >
        {isUploading ? (
          <div className="flex items-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Carregando...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <UploadCloud className="w-5 h-5" />
            <span>{imageUrl ? "Mudar Imagem" : "Selecionar Imagem"}</span>
          </div>
        )}
        <input
          id="image-upload-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading || disabled}
        />
      </label>

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};
