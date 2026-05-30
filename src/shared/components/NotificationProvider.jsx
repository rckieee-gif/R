import { useState, useCallback, useEffect } from 'react';
import { NotificationContext } from '../context/NotificationContext';

export default function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [modalConfig, setModalConfig] = useState(null);

  // Toast Functionality
  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const success = useCallback((message, duration) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message, duration) => showToast(message, 'error', duration), [showToast]);
  const warn = useCallback((message, duration) => showToast(message, 'warning', duration), [showToast]);
  const info = useCallback((message, duration) => showToast(message, 'info', duration), [showToast]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const [promptValue, setPromptValue] = useState('');

  // Confirmation Modal Functionality
  const confirm = useCallback(({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
    return new Promise((resolve) => {
      setModalConfig({
        title,
        message,
        confirmText,
        cancelText,
        danger,
        isPrompt: false,
        resolve: (value) => {
          setModalConfig(null);
          resolve(value);
        }
      });
    });
  }, []);

  const prompt = useCallback(({ title, message, placeholder = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) => {
    return new Promise((resolve) => {
      setPromptValue('');
      setModalConfig({
        title,
        message,
        placeholder,
        confirmText,
        cancelText,
        danger,
        isPrompt: true,
        resolve: (value) => {
          setModalConfig(null);
          resolve(value);
        }
      });
    });
  }, []);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!modalConfig) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        modalConfig.resolve(modalConfig.isPrompt ? null : false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalConfig]);

  // Color mapping helpers
  const getToastStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          icon: 'check_circle',
          iconClass: 'text-app-success',
          borderClass: 'border-l-4 border-l-app-success'
        };
      case 'error':
        return {
          icon: 'error',
          iconClass: 'text-app-danger',
          borderClass: 'border-l-4 border-l-app-danger'
        };
      case 'warning':
        return {
          icon: 'warning',
          iconClass: 'text-app-warning',
          borderClass: 'border-l-4 border-l-app-warning'
        };
      case 'info':
      default:
        return {
          icon: 'info',
          iconClass: 'text-app-accent',
          borderClass: 'border-l-4 border-l-app-accent'
        };
    }
  };

  return (
    <NotificationContext.Provider value={{ showToast, success, error, warn, info, confirm, prompt }}>
      {children}

      {/* Toasts Container */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.type);
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 bg-app-card border border-app-border ${styles.borderClass} rounded-xl p-3.5 shadow-lg animate-toast-in backdrop-blur-md bg-opacity-95 dark:bg-opacity-95`}
            >
              <span className={`material-symbols-outlined shrink-0 text-lg ${styles.iconClass}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {styles.icon}
              </span>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-semibold text-app-text leading-snug break-words">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-0.5 rounded-full hover:bg-app-bg text-app-text-secondary hover:text-app-text transition cursor-pointer"
                aria-label="Close notification"
              >
                <span className="material-symbols-outlined text-sm leading-none block">
                  close
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {modalConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] flex items-center justify-center p-4 animate-backdrop-in">
          <div 
            className="bg-app-card border border-app-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full shrink-0 ${modalConfig.danger ? 'bg-app-danger-bg' : 'bg-app-accent/15'}`}>
                  <span 
                    className={`material-symbols-outlined text-2xl block ${modalConfig.danger ? 'text-app-danger' : 'text-app-accent'}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {modalConfig.danger ? 'warning' : 'help_outline'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-app-text leading-6 font-hanken">
                    {modalConfig.title}
                  </h3>
                  <p className="text-sm text-app-text-secondary mt-2.5 font-inter leading-relaxed whitespace-pre-line">
                    {modalConfig.message}
                  </p>

                  {modalConfig.isPrompt && (
                    <div className="mt-4">
                      <input
                        type="text"
                        value={promptValue}
                        onChange={(e) => setPromptValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            modalConfig.resolve(promptValue);
                          }
                        }}
                        placeholder={modalConfig.placeholder}
                        className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-bg text-sm font-semibold text-app-text outline-none focus:ring-2 focus:ring-app-accent/20"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => modalConfig.resolve(modalConfig.isPrompt ? null : false)}
                  className="px-4.5 py-2.5 text-xs font-black uppercase tracking-wider text-app-text-secondary bg-app-bg hover:bg-app-border border border-app-border rounded-xl cursor-pointer transition-all duration-150 active:scale-95 font-jetbrains"
                >
                  {modalConfig.cancelText}
                </button>
                <button
                  onClick={() => modalConfig.resolve(modalConfig.isPrompt ? promptValue : true)}
                  className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all duration-150 active:scale-95 font-jetbrains shadow-sm ${
                    modalConfig.danger
                      ? 'bg-app-danger text-app-on-accent hover:opacity-90'
                      : 'bg-app-accent text-app-on-accent hover:opacity-90'
                  }`}
                >
                  {modalConfig.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
