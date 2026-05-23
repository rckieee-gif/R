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
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Change Password</h3>

      {passwordError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
          {passwordError}
        </div>
      )}
      {passwordMessage && (
        <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm font-bold mb-4 border border-green-200">
          {passwordMessage}
        </div>
      )}

      <form onSubmit={handlePasswordSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Current Password</label>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">New Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Confirm New Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isPasswordSaving}
          className="w-full bg-primary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all disabled:opacity-60"
        >
          {isPasswordSaving ? 'Saving...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
