import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, FileCheck, X, Image as ImageIcon, Sparkles } from 'lucide-react';

interface ArtworkUploadProps {
  onArtworkUploaded?: (fileInfo: { name: string; url: string; size: string }) => void;
  label?: string;
  helperText?: string;
  compact?: boolean;
}

export const ArtworkUpload: React.FC<ArtworkUploadProps> = ({
  onArtworkUploaded,
  label = 'Envie sua Logo ou Arte Vetorial',
  helperText = 'Formatos aceitos: PDF, AI, CDR, PNG (fundo transparente) ou JPG em alta resolução (até 50MB)',
  compact = false,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<{ name: string; url: string; size: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    setUploading(true);
    // Simulate upload preview
    setTimeout(() => {
      const isImg = selectedFile.type.startsWith('image/');
      const fakeUrl = isImg
        ? URL.createObjectURL(selectedFile)
        : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';

      const fileData = {
        name: selectedFile.name,
        url: fakeUrl,
        size: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
      };

      setFile(fileData);
      setUploading(false);
      if (onArtworkUploaded) onArtworkUploaded(fileData);
    }, 600);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onArtworkUploaded) onArtworkUploaded({ name: '', url: '', size: '' });
  };

  return (
    <div className="w-full space-y-1.5" id="artwork-uploader">
      {label && <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">{label}</label>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.ai,.cdr,.eps,.png,.jpg,.jpeg,.svg"
        onChange={handleFileChange}
        className="hidden"
      />

      {file ? (
        <div className="flex items-center justify-between p-3 bg-emerald-50/80 border border-emerald-300 rounded-xl transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-950 truncate flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                {file.name}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {file.size} • Arte recebida com sucesso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 text-emerald-700 hover:text-rose-600 rounded-lg hover:bg-emerald-100/50 transition-colors"
            title="Remover arquivo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center ${
            compact ? 'p-4' : 'p-6'
          } ${
            dragOver
              ? 'border-[#00AEEF] bg-sky-50/70'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-100/60'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center py-2 text-slate-600">
              <div className="w-6 h-6 border-2 border-[#00AEEF] border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs font-semibold">Processando arquivo...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-600 mb-2">
                <UploadCloud className="w-5 h-5 text-[#00AEEF]" />
              </div>
              <p className="text-xs font-bold text-slate-800">
                Arraste sua arte aqui ou <span className="text-[#00AEEF] underline">clique para selecionar</span>
              </p>
              {helperText && (
                <p className="text-[11px] text-slate-500 max-w-sm mt-1 leading-snug">
                  {helperText}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-50 text-[#E6007E]">
                  Aprovação virtual antes da produção
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
