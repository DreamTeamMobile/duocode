import { useEffect, useRef, useCallback } from 'react';
import { useToastStore, type Toast as ToastType } from '../../stores/toastStore';

const ICONS: Record<string, string> = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
};

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: number) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast.duration > 0) {
      timerRef.current = setTimeout(() => onDismiss(toast.id), toast.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const handleAction = () => {
    if (toast.action?.callback) {
      toast.action.callback();
    }
    onDismiss(toast.id);
  };

  return (
    <div className={`toast toast-${toast.type} toast-visible`} data-testid="toast">
      <span className="toast-icon">{ICONS[toast.type] || ICONS.info}</span>
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button className="toast-action" onClick={handleAction}>
          {toast.action.label}
        </button>
      )}
      {toast.dismissible && (
        <button
          className="toast-close"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss"
        >
          &times;
        </button>
      )}
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  const handleDismiss = useCallback(
    (id: number) => removeToast(id),
    [removeToast]
  );

  return (
    <div className="toast-container" data-testid="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
