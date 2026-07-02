
export default function AppShell({ sidebar, mobileNav, children, isDarkMode }) {
  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-app-bg text-app-text min-h-screen flex min-w-0 flex-col md:flex-row transition-colors duration-300 font-sans">
        {sidebar}
        <div className="flex-1 min-w-0 min-h-screen flex flex-col overflow-x-hidden md:pl-[250px]">
          {mobileNav}
          <main className="flex-1 min-w-0 bg-app-bg">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
