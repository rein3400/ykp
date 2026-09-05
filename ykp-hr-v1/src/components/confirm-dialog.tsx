'use client';

import * as React from 'react';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  function close(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!state) return;
      if (e.key === 'Escape') close(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          role='dialog'
          aria-modal='true'
          aria-labelledby='confirm-title'
          className='fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm'
          onClick={() => close(false)}
        >
          <div
            className='w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl'
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id='confirm-title' className='text-base font-semibold text-slate-900'>
              {state.title}
            </h2>
            {state.description && <p className='mt-1 text-sm text-slate-600'>{state.description}</p>}
            <div className='mt-4 flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => close(false)}
                className='rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
              >
                {state.cancelLabel ?? 'Batal'}
              </button>
              <button
                type='button'
                autoFocus
                onClick={() => close(true)}
                className={
                  state.tone === 'danger'
                    ? 'rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700'
                    : 'rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800'
                }
              >
                {state.confirmLabel ?? 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx.confirm;
}
