/**
 * Utility for client-side image compression and resizing
 * Converts large user images/photos (1-10MB) into optimized, lightweight Base64 Data URLs (15-60KB)
 * that fit perfectly within localStorage quotas without losing visual sharpness.
 */

export interface OptimizedImageResult {
  dataUrl: string;
  sizeStr: string;
  width: number;
  height: number;
}

export const compressImageFile = (
  file: File,
  maxWidth = 700,
  maxHeight = 350,
  quality = 0.88
): Promise<OptimizedImageResult> => {
  return new Promise((resolve, reject) => {
    // If it's an SVG, read directly as vector data
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = (e.target?.result as string) || '';
        const sizeStr = `${Math.round(file.size / 1024)} KB`;
        resolve({
          dataUrl,
          sizeStr,
          width: maxWidth,
          height: maxHeight,
        });
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo SVG.'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect ratio constraint
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const fallbackUrl = (event.target?.result as string) || '';
          resolve({
            dataUrl: fallbackUrl,
            sizeStr: `${Math.round(file.size / 1024)} KB`,
            width,
            height,
          });
          return;
        }

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw image resized
        ctx.drawImage(img, 0, 0, width, height);

        // Keep transparent background for PNG/WebP, or JPEG for photos
        const isTransparentFormat = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
        const outputType = isTransparentFormat ? 'image/png' : 'image/jpeg';

        const dataUrl = canvas.toDataURL(outputType, quality);

        // Calculate approx size in KB of base64
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
        const sizeStr = approxBytes > 1024 * 1024
          ? `${(approxBytes / (1024 * 1024)).toFixed(2)} MB`
          : `${Math.round(approxBytes / 1024)} KB`;

        resolve({
          dataUrl,
          sizeStr,
          width,
          height,
        });
      };

      img.onerror = () => reject(new Error('Formato de imagem inválido ou corrompido.'));
      img.src = (event.target?.result as string) || '';
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo do dispositivo.'));
    reader.readAsDataURL(file);
  });
};
