import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

let idCounter = 0;

const styles = {
  success: { icon: CheckCircle2, ring: 'border-green-200', text: 'text-green-600', title: 'text-green-800' },
  error: { icon: XCircle, ring: 'border-red-200', text: 'text-red-600', title: 'text-red-800' },
  warning: { icon: AlertTriangle, ring: 'border-amber-200', text: 'text-amber-600', title: 'text-amber-800' },
  info: { icon: Info, ring: 'border-brand-200', text: 'text-brand-600', title: 'text-brand-800' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = ++idCounter;
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove]
  );

  const toast = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    warning: (m) => push('warning', m),
    info: (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[90vw]">
        {toasts.map((t) => {
          const s = styles[t.type];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              className={`bg-white border ${s.ring} shadow-pop rounded-lg p-3 flex items-start gap-3 animate-[slideIn_.2s_ease-out]`}
            >
              <Icon size={20} className={`${s.text} mt-0.5 shrink-0`} />
              <span className={`text-sm font-medium ${s.title} leading-snug flex-1`}>{t.message}</span>
              <button onClick={() => remove(t.id)} className="text-ink-400 hover:text-ink-600 shrink-0">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
