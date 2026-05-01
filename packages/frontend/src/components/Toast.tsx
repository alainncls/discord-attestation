import { memo, useCallback, useEffect, useRef, useState } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onRemove: (id: string) => void;
}

const Toast = memo(function Toast({ id, message, type, duration = 5000, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const closeTimerRef = useRef<number | undefined>(undefined);

  const closeToast = useCallback(() => {
    setIsVisible(false);
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => onRemove(id), 300);
  }, [id, onRemove]);

  useEffect(() => {
    const timer = window.setTimeout(closeToast, duration);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(closeTimerRef.current);
    };
  }, [duration, closeToast]);

  return (
    <div
      className={`toast toast-${type} ${isVisible ? 'toast-visible' : 'toast-hidden'}`}
      role="alert"
    >
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={closeToast}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
});

// Toast container for multiple toasts
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
