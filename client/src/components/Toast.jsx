import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import clsx from 'clsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const value = useMemo(
    () => ({
      success: (msg) => push('success', msg),
      error: (msg) => push('error', msg),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              'pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg',
              t.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const noop = { success: () => {}, error: () => {} };

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext) ?? noop;
}
