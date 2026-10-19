import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastInput {
  title?: string;
  message: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastContextValue {
  showToast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  function showToast(input: ToastInput): void {
    const id = createToastId();
    const nextToast: ToastItem = {
      id,
      title: input.title ?? resolveDefaultTitle(input.tone),
      message: input.message,
      tone: input.tone ?? 'info',
    };

    setToasts((currentToasts) => [...currentToasts, nextToast]);

    const timeoutId = window.setTimeout(() => {
      dismissToast(id);
      timeoutIdsRef.current = timeoutIdsRef.current.filter(
        (currentTimeoutId) => currentTimeoutId !== timeoutId,
      );
    }, 4000);

    timeoutIdsRef.current.push(timeoutId);
  }

  function dismissToast(toastId: string): void {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-live="polite" className="toast-stack" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            className={`toast toast--${toast.tone ?? 'info'}`}
            key={toast.id}
            role="status"
          >
            <div className="toast__header">
              <span className="toast__title">{toast.title}</span>
              <button
                aria-label="Close notification"
                className="toast__dismiss"
                onClick={() => dismissToast(toast.id)}
                type="button"
              >
                Kapat
              </button>
            </div>
            <div className="toast__message">{toast.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }

  return context;
}

function createToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveDefaultTitle(tone: ToastTone | undefined): string {
  switch (tone) {
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
    default:
      return 'Info';
  }
}
