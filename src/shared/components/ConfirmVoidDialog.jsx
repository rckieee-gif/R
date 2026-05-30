import { useState } from 'react';

export default function ConfirmVoidDialog({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Void Record',
  message = 'Reason for voiding this record?',
  placeholder = 'e.g. error in entry, double entry',
  className = ''
}) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason('');
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] ${className}`}>
      <div className="bg-app-card border border-app-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-app-danger">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">warning</span>
          <h3 className="text-base font-black font-hanken tracking-tight text-app-text">{title}</h3>
        </div>
        <p className="text-xs font-semibold text-app-text-secondary">{message}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold placeholder-app-text-secondary/40 outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-inter"
          />

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                onCancel();
                setReason('');
              }}
              className="flex-1 bg-app-bg text-app-text border border-app-border px-3 h-11 md:h-10 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer font-hanken"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-app-danger text-white px-3 h-11 md:h-10 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer font-hanken"
            >
              Void
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
