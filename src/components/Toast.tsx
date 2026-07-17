import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertTriangle, X, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />,
  error: <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />,
  info: <Info className="h-4 w-4 text-blue-400 shrink-0" />,
};

const BG_COLORS: Record<ToastType, string> = {
  success: "border-emerald-500/20 bg-emerald-500/10",
  error: "border-rose-500/20 bg-rose-500/10",
  info: "border-blue-500/20 bg-blue-500/10",
};

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-12 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={`pointer-events-auto flex items-center gap-2.5 px-3 py-2.5 rounded-xl border backdrop-blur-xl shadow-2xl max-w-xs ${BG_COLORS[toast.type]}`}
    >
      {ICONS[toast.type]}
      <span className="text-[11px] text-slate-200 font-medium leading-tight flex-1">
        {toast.message}
      </span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 text-slate-500 hover:text-slate-300 cursor-pointer shrink-0"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
};
