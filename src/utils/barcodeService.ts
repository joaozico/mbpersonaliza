/**
 * Barcode & QR Code Service for PDV (Ponto de Venda)
 * Supports EAN-13, Code-128, QR Code resolution, sound feedback, and label generation.
 */

import { Product, ProductVariant } from '../types';

export interface ScanMatchResult {
  product: Product;
  variant?: ProductVariant;
  matchedBy: 'barcode' | 'qrCode' | 'code' | 'sku' | 'slug' | 'id';
  scannedCode: string;
}

/**
 * Deterministic EAN-13 generator based on numeric string or product code
 */
export function generateEAN13(seed: string): string {
  // Brazilian country code prefix: 789
  const prefix = '789';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000000000;
  }
  const body = String(hash).padStart(9, '0');
  const base12 = prefix + body;

  // Calculate EAN-13 checksum digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return base12 + checkDigit.toString();
}

/**
 * Returns an existing or synthesized barcode for a product
 */
export function getProductBarcode(product: Product): string {
  if (product.barcode && product.barcode.trim()) {
    return product.barcode.trim();
  }
  return generateEAN13(product.id || product.code);
}

/**
 * Returns an existing or synthesized QR code payload for a product
 */
export function getProductQrCodePayload(product: Product): string {
  if (product.qrCode && product.qrCode.trim()) {
    return product.qrCode.trim();
  }
  return `MB:${product.id}:${product.slug || product.code}`;
}

/**
 * Generates an SVG Data-URI QR code visual representation
 */
export function generateQrCodeSvg(text: string, size = 180): string {
  // Encode content and use clean reliable dynamic SVG QR preview
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encoded}`;
}

/**
 * Searches for a product matching a scanned string from barcode laser gun, camera, or search input
 */
export function findProductByScanCode(
  rawInput: string,
  products: Product[]
): ScanMatchResult | null {
  if (!rawInput || !rawInput.trim()) return null;

  const code = rawInput.trim();
  const lowerCode = code.toLowerCase();

  // 1. Direct match on barcode (EAN-13, Code-128, etc.)
  for (const product of products) {
    const productBarcode = getProductBarcode(product);
    if (product.barcode && product.barcode.trim().toLowerCase() === lowerCode) {
      return { product, matchedBy: 'barcode', scannedCode: code };
    }
    if (productBarcode.toLowerCase() === lowerCode) {
      return { product, matchedBy: 'barcode', scannedCode: code };
    }

    // Check variants barcode
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.barcode && variant.barcode.trim().toLowerCase() === lowerCode) {
          return { product, variant, matchedBy: 'barcode', scannedCode: code };
        }
      }
    }
  }

  // 2. Direct match on product code (SKU)
  for (const product of products) {
    if (product.code && product.code.toLowerCase() === lowerCode) {
      return { product, matchedBy: 'code', scannedCode: code };
    }
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.sku && variant.sku.toLowerCase() === lowerCode) {
          return { product, variant, matchedBy: 'sku', scannedCode: code };
        }
      }
    }
  }

  // 3. QR-Code matching
  // Cases:
  // a) "MB:prod-id:slug"
  // b) URL like "https://.../produtos/slug" or "/produtos/slug"
  // c) JSON like {"id": "..."}
  // d) Exact product.id
  if (lowerCode.startsWith('mb:')) {
    const parts = code.split(':');
    const targetId = parts[1];
    const targetSlug = parts[2];
    const found = products.find(
      (p) => p.id === targetId || (targetSlug && p.slug === targetSlug)
    );
    if (found) return { product: found, matchedBy: 'qrCode', scannedCode: code };
  }

  if (lowerCode.includes('/produtos/')) {
    const slugPart = code.split('/produtos/')[1]?.split('?')[0]?.split('#')[0]?.trim();
    if (slugPart) {
      const found = products.find(
        (p) => p.slug.toLowerCase() === slugPart.toLowerCase() || p.id === slugPart
      );
      if (found) return { product: found, matchedBy: 'slug', scannedCode: code };
    }
  }

  try {
    if (code.startsWith('{') && code.endsWith('}')) {
      const parsed = JSON.parse(code);
      if (parsed.id || parsed.code || parsed.barcode) {
        const found = products.find(
          (p) =>
            p.id === parsed.id ||
            p.code === parsed.code ||
            (parsed.barcode && p.barcode === parsed.barcode)
        );
        if (found) return { product: found, matchedBy: 'qrCode', scannedCode: code };
      }
    }
  } catch {
    // Not valid JSON, ignore
  }

  // 4. Exact Match on Product ID
  for (const product of products) {
    if (product.id.toLowerCase() === lowerCode) {
      return { product, matchedBy: 'id', scannedCode: code };
    }
  }

  return null;
}

/**
 * Real-time audio feedback for retail scanner beep (like a real supermarket/store POS)
 */
export function playScannerSuccessBeep(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // High clear A6 beep
    osc.frequency.exponentialRampToValueAtTime(1920, ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);

    // Haptic vibration if supported (useful on phones/tablets with camera scanner)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(60);
    }
  } catch {
    // Web Audio blocked or not supported, ignore silently
  }
}

/**
 * Error / Warning audio feedback (item not found or out of stock)
 */
export function playScannerErrorBeep(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Double low tone beep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(330, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.1);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(260, now + 0.12);
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.24);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 50, 80]);
    }
  } catch {
    // Ignore
  }
}
