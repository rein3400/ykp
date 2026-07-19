'use client';

import * as React from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (kind: ToastKind, title: string, description?: string, duration?: number) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (kind: ToastKind, title: string, description?: string, duration = 4000) => {
      const id = nextId++;
      setToasts((ts) => [...ts, { id, kind, title, description, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      dismiss,
      success: (t, d) => push('success', t, d),
      error: (t, d) => push('error', t, d, 6000),
      info: (t, d) => push('info', t, d),
      warning: (t, d) => push('warning', t, d, 5000)
    }),
    [toasts, push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

const KIND_STYLES: Record<ToastKind, { ring: string; icon: string; label: string }> = {
  success: {
    ring: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    icon: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z',
    label: 'Sukses'
  },
  error: {
    ring: 'border-rose-300 bg-rose-50 text-rose-900',
    icon: 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z',
    label: 'Error'
  },
  info: {
    ring: 'border-sky-300 bg-sky-50 text-sky-900',
    icon: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z',
    label: 'Info'
  },
  warning: {
    ring: 'border-amber-300 bg-amber-50 text-amber-900',
    icon: 'M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z',
    label: 'Perhatian'
  }
};

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live='polite'
      aria-atomic='false'
      className='pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2'
    >
      {toasts.map((t) => {
        const s = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            role='status'
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm transition-all ${s.ring}`}
          >
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='mt-0.5 h-5 w-5 flex-shrink-0' aria-hidden='true'>
              <path fillRule='evenodd' d={s.icon} clipRule='evenodd' />
            </svg>
            <div className='flex-1 min-w-0'>
              <div className='text-sm font-semibold'>{t.title}</div>
              {t.description && <div className='mt-0.5 text-xs opacity-90 break-words'>{t.description}</div>}
            </div>
            <button
              type='button'
              onClick={() => onDismiss(t.id)}
              aria-label='Tutup notifikasi'
              className='rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-1'
            >
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' className='h-4 w-4'>
                <path d='M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z' />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
