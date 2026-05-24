export default function ChangePassword({
  handlePasswordSubmit,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  passwordMessage,
  passwordError,
  isPasswordSaving
}) {
  return (
    <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6 font-hanken">
      <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-4">Change Password</h3>

      {passwordError && (
        <div className="bg-app-danger-bg text-app-danger p-3 rounded-xl text-sm font-bold mb-4 border border-app-danger">
          {passwordError}
        </div>
      )}
      {passwordMessage && (
        <div className="bg-app-success-bg text-app-success p-3 rounded-xl text-sm font-bold mb-4 border border-app-success">
          {passwordMessage}
        </div>
      )}

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Current Password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">New Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
          />
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Confirm New Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
          />
        </div>

        <button
          type="submit"
          disabled={isPasswordSaving}
          className="w-full bg-app-accent text-app-on-accent p-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-102 active:scale-98 transition-all disabled:opacity-60 cursor-pointer"
        >
          {isPasswordSaving ? 'Saving...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
