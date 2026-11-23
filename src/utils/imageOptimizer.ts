/**
 * Advanced Client-Side Image Optimization Utility for MB Personaliza
 * 
 * Features:
 * - Dynamic CDN / URL parameter optimization (WebP format, quality, dimensions)
 * - Canvas-based client-side compression with WebP & PNG alpha channel support
 * - Responsive srcset generation for modern devices (Retina / High-DPI)
 * - Lightweight inline SVG placeholders for instant fallback without broken icons
 * - Prevents layout shifts and minimizes payload size for PostgreSQL persistence
 */

export interface OptimizedImageResult {
  dataUrl: string;
  sizeStr: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
}

export interface ImageOptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'auto' | 'jpg' | 'png';
  fit?: 'crop' | 'clip' | 'scale' | 'max';
}

/**
 * Checks if the current browser environment supports Canvas WebP export
 */
let webpSupportedCached: boolean | null = null;
export const isWebpSupported = (): boolean => {
  if (webpSupportedCached !== null) return webpSupportedCached;
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupportedCached = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    webpSupportedCached = false;
  }
  return webpSupportedCached;
};

/**
 * Optimizes an image URL by applying dynamic CDN transformation parameters.
 * Supports Unsplash and generic image URLs with smart dimension & format negotiation.
 */
export const optimizeImageUrl = (
  url?: string | null,
  options: ImageOptimizeOptions = {}
): string => {
  if (!url || typeof url !== 'string') {
    return getFallbackPlaceholder();
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return getFallbackPlaceholder();
  }

  // If already a Data URL or SVG, return directly
  if (trimmed.startsWith('data:image/') || trimmed.endsWith('.svg') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Handle Unsplash Images: apply modern format, optimal compression, and requested dimensions
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const parsedUrl = new URL(trimmed);
      const width = options.width || 800;
      const quality = options.quality || 80;
      const fit = options.fit || 'crop';

      parsedUrl.searchParams.set('auto', 'format');
      parsedUrl.searchParams.set('fit', fit);
      parsedUrl.searchParams.set('w', width.toString());
      parsedUrl.searchParams.set('q', quality.toString());

      if (options.height) {
        parsedUrl.searchParams.set('h', options.height.toString());
      }

      // Use WebP format parameter
      if (options.format === 'webp' || (options.format !== 'png' && options.format !== 'jpg')) {
        parsedUrl.searchParams.set('fm', 'webp');
      }

      return parsedUrl.toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

/**
 * Generates an srcset string for responsive image loading
 */
export const generateSrcSet = (
  url: string,
  widths: number[] = [320, 640, 960, 1200]
): string => {
  if (!url || !url.includes('images.unsplash.com')) {
    return '';
  }

  return widths
    .map((w) => `${optimizeImageUrl(url, { width: w, quality: 78 })} ${w}w`)
    .join(', ');
};

/**
 * Generates a clean branded SVG Data-URI placeholder
 * Used when an image is loading, missing, or fails network fetch.
 */
export const getFallbackPlaceholder = (
  title = 'Produto MB Personaliza',
  category = 'Brinde Corporativo'
): string => {
  const safeTitle = title.replace(/[<>&"]/g, '');
  const safeCategory = category.replace(/[<>&"]/g, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" fill="#0B0F17">
    <defs>
      <linearGradient id="mb-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0F172A"/>
        <stop offset="50%" stop-color="#1E293B"/>
        <stop offset="100%" stop-color="#0F172A"/>
      </linearGradient>
      <linearGradient id="mb-accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#E6007E"/>
        <stop offset="50%" stop-color="#00AEEF"/>
        <stop offset="100%" stop-color="#FFDD00"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#mb-bg)"/>
    <circle cx="300" cy="260" r="110" fill="#1E293B" stroke="#334155" stroke-width="2"/>
    <path d="M260 260h80M300 220v80" stroke="url(#mb-accent)" stroke-width="8" stroke-linecap="round"/>
    <rect x="235" y="325" width="130" height="6" rx="3" fill="#334155"/>
    <text x="300" y="420" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="20" font-weight="700" text-anchor="middle">${safeTitle}</text>
    <text x="300" y="450" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="14" font-weight="500" text-anchor="middle">${safeCategory}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Compress an uploaded user image file on the client side
 * - Automatically detects WebP capability
 * - Preserves transparency for PNGs
 * - Caps maximum width & height to protect storage quotas
 * - Returns clean Base64 dataUrl with compression statistics
 */
export const compressImageFile = (
  file: File,
  maxWidth = 1000,
  maxHeight = 600,
  quality = 0.82
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
          originalSizeBytes: file.size,
          compressedSizeBytes: file.size,
          compressionRatio: 1,
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
            originalSizeBytes: file.size,
            compressedSizeBytes: file.size,
            compressionRatio: 1,
          });
          return;
        }

        // Enable high-quality smoothing algorithm
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw image resized
        ctx.drawImage(img, 0, 0, width, height);

        const supportsWebp = isWebpSupported();
        const isTransparent =
          file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';

        let outputType = 'image/jpeg';
        if (supportsWebp) {
          outputType = 'image/webp';
        } else if (isTransparent) {
          outputType = 'image/png';
        }

        const dataUrl = canvas.toDataURL(outputType, quality);

        // Calculate approx size in bytes of base64 data
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
        const sizeStr =
          approxBytes > 1024 * 1024
            ? `${(approxBytes / (1024 * 1024)).toFixed(2)} MB`
            : `${Math.round(approxBytes / 1024)} KB`;

        const ratio = file.size > 0 ? Number((file.size / approxBytes).toFixed(1)) : 1;

        resolve({
          dataUrl,
          sizeStr,
          width,
          height,
          originalSizeBytes: file.size,
          compressedSizeBytes: approxBytes,
          compressionRatio: ratio,
        });
      };

      img.onerror = () => reject(new Error('Formato de imagem inválido ou corrompido.'));
      img.src = (event.target?.result as string) || '';
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo do dispositivo.'));
    reader.readAsDataURL(file);
  });
};
