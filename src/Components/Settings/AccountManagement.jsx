const roleOptions = ['AdminOwner', 'OperationManager', 'DataEntry', 'Viewer'];
const stakeholderTypeOptions = ['Owner', 'Employee', 'Supplier', 'Buyer', 'Dressing Plant', 'Other'];

export default function AccountManagement({
  accountForm,
  updateAccountForm,
  handleAccountCreate,
  accounts,
  isLoadingAccounts,
  updateAccount,
  disableAccount,
  accountError,
  accountMessage
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-neutral-border dark:border-gray-700 mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">User Accounts</h3>

      {accountError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-200">
          {accountError}
        </div>
      )}
      {accountMessage && (
        <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm font-bold mb-4 border border-green-200">
          {accountMessage}
        </div>
      )}

      <form onSubmit={handleAccountCreate} className="space-y-3 mb-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              value={accountForm.email}
              onChange={(event) => updateAccountForm('email', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              placeholder="name@octavio.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={accountForm.username}
              onChange={(event) => updateAccountForm('username', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              placeholder="optional"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Temp Password</label>
            <input
              type="text"
              required
              value={accountForm.password}
              onChange={(event) => updateAccountForm('password', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              placeholder="temporary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Role</label>
            <select
              value={accountForm.role}
              onChange={(event) => updateAccountForm('role', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Person/Entity</label>
            <input
              type="text"
              value={accountForm.stakeholderName}
              onChange={(event) => updateAccountForm('stakeholderName', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none"
              placeholder="optional"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Type</label>
            <select
              value={accountForm.stakeholderType}
              onChange={(event) => updateAccountForm('stakeholderType', event.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-neutral-light dark:bg-gray-700 text-gray-800 dark:text-white outline-none font-bold"
            >
              {stakeholderTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="w-full bg-secondary text-white p-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all">
          Create Account
        </button>
      </form>

      {isLoadingAccounts && (
        <p className="text-xs text-gray-500 mb-3 font-semibold">Loading accounts...</p>
      )}

      <div className="space-y-3">
        {accounts.map((account) => (
          <div key={account.id} className={`rounded-xl border p-3 ${account.isActive ? 'border-neutral-border dark:border-gray-700 bg-neutral-light dark:bg-gray-900' : 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10'}`}>
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-gray-900 dark:text-white truncate">{account.username || account.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{account.email}</p>
                {account.isPrimaryOwner && (
                  <p className="text-[10px] text-primary font-black mt-1">Primary Owner</p>
                )}
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full h-fit ${account.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {account.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <select
                value={account.role}
                onChange={(event) => updateAccount(account.id, { role: event.target.value })}
                disabled={account.isPrimaryOwner}
                className="w-full p-2 border border-neutral-border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white disabled:opacity-60 font-bold"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => updateAccount(account.id, { password: '123' })}
                className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-neutral-border dark:border-gray-600 text-xs font-black text-gray-600 dark:text-gray-200 hover:bg-gray-50 transition-colors"
              >
                Reset 123
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => updateAccount(account.id, { isActive: true })}
                disabled={account.isActive}
                className="p-2 rounded-lg bg-green-100 text-green-700 text-xs font-black disabled:opacity-50"
              >
                Reactivate
              </button>
              <button
                type="button"
                onClick={() => disableAccount(account.id)}
                disabled={account.isPrimaryOwner || !account.isActive}
                className="p-2 rounded-lg bg-red-100 text-red-700 text-xs font-black disabled:opacity-50"
              >
                Disable
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
