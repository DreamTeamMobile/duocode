import { create } from 'zustand';
import type { ToastType } from '../services/error-feedback';

export interface ToastAction {
  label: string;
  callback: () => void;
}

export interface ToastOptions {
  duration?: number;
  dismissible?: boolean;
  action?: ToastAction | null;
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  dismissible: boolean;
  action: ToastAction | null;
}

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => number;
  removeToast: (id: number) => void;
  clearAll: () => void;
  showSuccess: (message: string, options?: ToastOptions) => number;
  showError: (message: string, options?: ToastOptions) => number;
  showWarning: (message: string, options?: ToastOptions) => number;
  showInfo: (message: string, options?: ToastOptions) => number;
  reset: () => void;
}

export type ToastStore = ToastState & ToastActions;

let nextId = 1;

function createToast(message: string, type: ToastType, options: ToastOptions): Toast {
  return {
    id: nextId++,
    message,
    type,
    duration: options.duration ?? 5000,
    dismissible: options.dismissible ?? true,
    action: options.action || null,
  };
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (message, type = 'info', options = {}) => {
    const toast = createToast(message, type, options);

    set((state) => ({
      toasts: [...state.toasts].slice(-(4)).concat(toast),
    }));

    return toast.id;
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),

  showSuccess: (message, options = {}) => {
    const toast = createToast(message, 'success', options);
    set((state) => ({
      toasts: [...state.toasts].slice(-(4)).concat(toast),
    }));
    return toast.id;
  },

  showError: (message, options = {}) => {
    const toast = createToast(message, 'error', { duration: 8000, ...options });
    set((state) => ({
      toasts: [...state.toasts].slice(-(4)).concat(toast),
    }));
    return toast.id;
  },

  showWarning: (message, options = {}) => {
    const toast = createToast(message, 'warning', options);
    set((state) => ({
      toasts: [...state.toasts].slice(-(4)).concat(toast),
    }));
    return toast.id;
  },

  showInfo: (message, options = {}) => {
    const toast = createToast(message, 'info', options);
    set((state) => ({
      toasts: [...state.toasts].slice(-(4)).concat(toast),
    }));
    return toast.id;
  },

  reset: () => {
    nextId = 1;
    set({ toasts: [] });
  },
}));
