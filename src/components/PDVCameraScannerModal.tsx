import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../types';
import {
  findProductByScanCode,
  playScannerSuccessBeep,
  playScannerErrorBeep,
  getProductBarcode,
  getProductQrCodePayload,
} from '../utils/barcodeService';
import {
  X,
  Camera,
  QrCode,
  Barcode,
  Flashlight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
} from 'lucide-react';

interface PDVCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductScanned: (product: Product, code: string) => void;
}

export const PDVCameraScannerModal: React.FC<PDVCameraScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductScanned,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [continuousScan, setContinuousScan] = useState<boolean>(true);
  const [lastScannedResult, setLastScannedResult] = useState<{
    product: Product;
    code: string;
    timestamp: number;
  } | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const isScanningRef = useRef<boolean>(false);
  const lastCodeScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Initialize and stop camera stream
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCameraPermission(false);
        setCameraError('Câmera não suportada neste navegador ou ambiente.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setHasCameraPermission(true);
      isScanningRef.current = true;
      requestAnimationFrame(scanFrame);
    } catch (err: any) {
      console.warn('Erro ao acessar câmera:', err);
      setHasCameraPermission(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Permissão de acesso à câmera negada. Você pode usar a entrada manual ou os atalhos de teste abaixo.'
          : 'Não foi possível inicializar a câmera de vídeo.'
      );
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Toggle Torch/Flashlight if supported by camera track
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && (track.getCapabilities as any)?.()?.torch) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch {
        // Torch constraint failed
      }
    }
  };

  // Barcode / QR-Code detection loop using native BarcodeDetector API if available
  const scanFrame = async () => {
    if (!isScanningRef.current || !videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // Check if native BarcodeDetector is available in window
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
          });
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            handleDetectedCode(rawValue);
          }
        } catch {
          // Fallback
        }
      }
    }

    if (isScanningRef.current) {
      setTimeout(() => {
        requestAnimationFrame(scanFrame);
      }, 150);
    }
  };

  const handleDetectedCode = (code: string) => {
    if (!code || !code.trim()) return;
    const trimmed = code.trim();
    const now = Date.now();

    // Debounce duplicate scans of the exact same code within 1.5 seconds
    if (
      lastCodeScannedTimeRef.current.code === trimmed &&
      now - lastCodeScannedTimeRef.current.time < 1500
    ) {
      return;
    }

    lastCodeScannedTimeRef.current = { code: trimmed, time: now };

    const match = findProductByScanCode(trimmed, products);
    if (match) {
      playScannerSuccessBeep();
      setLastScannedResult({
        product: match.product,
        code: trimmed,
        timestamp: now,
      });
      setManualError(null);
      onProductScanned(match.product, trimmed);

      if (!continuousScan) {
        onClose();
      }
    } else {
      playScannerErrorBeep();
      setManualError(`Código "${trimmed}" não encontrado no catálogo.`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleDetectedCode(manualCodeInput.trim());
    setManualCodeInput('');
  };

  if (!isOpen) return null;

  // Sample quick test products
  const quickTestProducts = products.slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-white animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E6007E] flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold uppercase font-heading text-white">
                Scanner Barcode & QR Code
              </h3>
              <p className="text-[10px] text-slate-400">
                Aponte para o código de barras ou QR Code do produto
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport / Viewfinder */}
        <div className="relative aspect-4/3 w-full bg-black overflow-hidden flex items-center justify-center">
          {hasCameraPermission === false || cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-200">Aviso da Câmera</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {cameraError || 'Câmera indisponível no dispositivo atual.'}
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Target Framing Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-44 rounded-2xl border-2 border-[#00AEEF]/80 shadow-[0_0_30px_rgba(0,174,239,0.3)]">
                  {/* Corner accents */}
                  <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-[#E6007E] rounded-tl" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-[#E6007E] rounded-tr" />
                  <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-[#E6007E] rounded-bl" />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-[#E6007E] rounded-br" />

                  {/* Animated laser line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#FFDD00] to-transparent shadow-[0_0_8px_#FFDD00] animate-bounce" />
                </div>
              </div>

              {/* Camera control buttons */}
              <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3 z-10 pointer-events-auto">
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                  }
                  className="p-2 rounded-full bg-slate-900/80 backdrop-blur-xs text-slate-200 hover:text-white border border-slate-700 cursor-pointer"
                  title="Inverter Câmera (Frontal / Traseira)"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-full border cursor-pointer ${
                    isTorchOn
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900/80 backdrop-blur-xs text-slate-200 border-slate-700 hover:text-white'
                  }`}
                  title="Ligar Lanterna / Flash"
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Toast Overlay when product detected */}
          {lastScannedResult && Date.now() - lastScannedResult.timestamp < 2500 && (
            <div className="absolute top-3 inset-x-4 bg-emerald-500 text-slate-950 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 z-20 animate-in fade-in slide-in-from-top-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 font-black text-slate-950" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black uppercase leading-tight truncate">
                  +1 {lastScannedResult.product.name}
                </div>
                <div className="text-[9px] font-mono text-emerald-950">
                  R$ {(lastScannedResult.product.promo_price || lastScannedResult.product.base_price).toFixed(2)} • Código: {lastScannedResult.code}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Options & Manual Input Bar */}
        <div className="p-4 space-y-3 bg-slate-900/95 border-t border-slate-800">
          {manualError && (
            <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{manualError}</span>
            </div>
          )}

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                placeholder="Digitar código de barras ou SKU..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 outline-none focus:border-[#00AEEF]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#E6007E] hover:bg-[#c9006e] text-white text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              Bipar
            </button>
          </form>

          {/* Quick Simulation / Test buttons */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Bip Rápido para Demonstração / Teste:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={continuousScan}
                  onChange={(e) => setContinuousScan(e.target.checked)}
                  className="rounded text-[#E6007E]"
                />
                <span>Modo Contínuo</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {quickTestProducts.map((p) => {
                const barcode = getProductBarcode(p);
                return (
                  <button
                    key={`test-${p.id}`}
                    type="button"
                    onClick={() => handleDetectedCode(barcode)}
                    className="p-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-700 overflow-hidden shrink-0">
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-[#00AEEF]">
                        {p.name}
                      </div>
                      <div className="text-[9px] font-mono text-slate-400">
                        EAN: {barcode}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
