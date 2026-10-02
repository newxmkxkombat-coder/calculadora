import React, { useEffect } from 'react';
import { CheckCircleIcon } from '../icons';

interface ToastProps {
  message: string;
  show: boolean;
  onClose: () => void;
}

/** Aviso breve que aparece sobre la barra de acciones y se cierra solo a los 5 segundos. */
export const Toast: React.FC<ToastProps> = ({ message, show, onClose }) => {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed inset-x-4 bottom-24 z-50 flex justify-center pointer-events-none animate-slide-up"
    >
      <div
        role="alert"
        className="pointer-events-auto flex items-center gap-3 px-4 py-3 max-w-sm bg-card border border-good/40 text-main rounded-2xl shadow-xl shadow-black/20"
      >
        <CheckCircleIcon />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
};
