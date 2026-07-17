import React, { useRef, useState } from "react";
import { UploadCloud, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface DropzoneProps {
  onFileAccepted: (file: File) => void;
  isProcessing: boolean;
  errorMsg: string | null;
  successMsg: string | null;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileAccepted,
  isProcessing,
  errorMsg,
  successMsg,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
        onFileAccepted(file);
      } else {
        alert("Please drop a valid .zip archive containing MP3 or WAV vocal tracks.");
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onFileAccepted(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      className={`relative rounded-3xl border-2 border-dashed p-8 text-center cursor-pointer select-none transition-all duration-200 flex flex-col items-center justify-center min-h-[160px] ${
        isDragActive
          ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        onChange={handleFileInput}
        className="hidden"
      />

      {isProcessing ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-200">
              Processing Choir Bundle...
            </span>
            <span className="text-xs text-slate-500 max-w-[280px]">
              Extracting ZIP archives and decoding high-fidelity vocal tracks in background.
            </span>
          </div>
        </div>
      ) : successMsg ? (
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl animate-bounce">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-emerald-400">
              Import Successful!
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {successMsg}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
            <UploadCloud className="h-8 w-8" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-200">
              Drag & Drop Choir ZIP here
            </span>
            <span className="text-xs text-slate-400">
              Or <span className="text-blue-400 font-semibold underline">browse files</span> from your device
            </span>
            <span className="text-[10px] font-mono text-slate-500 max-w-[340px] mt-2 block leading-relaxed">
              Zipped bundles should contain individual MP3 files representing vocal parts (e.g. Soprano.mp3, Alto.mp3, Tenor.mp3, Bass.mp3).
            </span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2 justify-center text-rose-400 text-xs bg-rose-500/5 border border-rose-500/10 rounded-xl py-2 px-3 animate-pulse">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
