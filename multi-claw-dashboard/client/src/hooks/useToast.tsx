import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { onApiError } from "../api/client";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "warning";
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  // Wire up global API error listener
  useEffect(() => {
    onApiError((message) => addToast(message, "error"));
    return () => { onApiError(null); };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;

  const colorMap = {
    success: "bg-green-900/90 text-green-300 border-green-800",
    error: "bg-red-900/90 text-red-300 border-red-800",
    warning: "bg-amber-900/90 text-amber-300 border-amber-800",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-4 rounded-lg text-sm border shadow-lg flex items-start gap-3 animate-fade-in ${colorMap[toast.type]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="opacity-60 hover:opacity-100 transition text-lg leading-none"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
