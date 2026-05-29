const roleOptions = ['AdminOwner', 'OperationManager', 'DataEntry', 'Viewer'];
const stakeholderTypeOptions = ['Owner', 'Employee', 'Supplier', 'Buyer', 'Dressing Plant', 'Other'];

export default function AccountManagement({
  accountForm,
  updateAccountForm,
  handleAccountCreate,
  accounts,
  isLoadingAccounts,
  updateAccount,
  disableAccount
}) {
  return (
    <div className="bg-app-card p-5 rounded-2xl shadow-sm border border-app-border mb-6 font-hanken">
      <h3 className="text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-4">User Accounts</h3>

      <form onSubmit={handleAccountCreate} className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Email</label>
            <input
              type="email"
              required
              value={accountForm.email}
              onChange={(event) => updateAccountForm('email', event.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
              placeholder="name@octavio.com"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Username</label>
            <input
              type="text"
              value={accountForm.username}
              onChange={(event) => updateAccountForm('username', event.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
              placeholder="optional"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Temp Password</label>
            <input
              type="text"
              required
              value={accountForm.password}
              onChange={(event) => updateAccountForm('password', event.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all font-jetbrains"
              placeholder="temporary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Role</label>
            <select
              value={accountForm.role}
              onChange={(event) => updateAccountForm('role', event.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Person/Entity</label>
            <input
              type="text"
              value={accountForm.stakeholderName}
              onChange={(event) => updateAccountForm('stakeholderName', event.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
              placeholder="optional name"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-app-text-secondary mb-1.5">Type</label>
            <select
              value={accountForm.stakeholderType}
              onChange={(event) => updateAccountForm('stakeholderType', event.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-xl bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 transition-all"
            >
              {stakeholderTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="w-full bg-app-accent text-app-on-accent p-3 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-102 active:scale-98 transition-all cursor-pointer">
          Create Account
        </button>
      </form>

      {isLoadingAccounts && (
        <p className="text-xs text-app-text-secondary mb-3 font-black">Loading accounts...</p>
      )}

      <div className="space-y-3">
        {accounts.map((account) => (
          <div key={account.id} className={`rounded-xl border p-4 ${account.isActive ? 'border-app-border bg-app-bg/50' : 'border-app-danger/30 bg-app-danger-bg'}`}>
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-app-text truncate">{account.username || account.email}</p>
                <p className="text-xs text-app-text-secondary truncate font-jetbrains">{account.email}</p>
                {account.isPrimaryOwner && (
                  <p className="text-[10px] text-app-accent font-black mt-1.5 uppercase tracking-wider font-jetbrains">Primary Owner</p>
                )}
              </div>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border h-fit font-jetbrains ${account.isActive ? 'bg-app-success-bg text-app-success border-app-success/20' : 'bg-app-danger-bg text-app-danger border-app-danger/20'}`}>
                {account.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <select
                value={account.role}
                onChange={(event) => updateAccount(account.id, { role: event.target.value })}
                disabled={account.isPrimaryOwner}
                className="w-full px-3 py-1.5 border border-app-border rounded-lg bg-app-bg text-app-text text-sm font-bold outline-none focus:ring-2 focus:ring-app-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => updateAccount(account.id, { password: '123' })}
                className="px-3 py-1.5 rounded-lg bg-app-bg border border-app-border text-xs font-black text-app-text hover:border-app-accent hover:text-app-accent transition-all cursor-pointer"
              >
                Reset 123
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => updateAccount(account.id, { isActive: true })}
                disabled={account.isActive}
                className="p-2 rounded-lg bg-app-success-bg text-app-success border border-app-success/20 text-xs font-black hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reactivate
              </button>
              <button
                type="button"
                onClick={() => disableAccount(account.id)}
                disabled={account.isPrimaryOwner || !account.isActive}
                className="p-2 rounded-lg bg-app-danger-bg text-app-danger border border-app-danger/20 text-xs font-black hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
