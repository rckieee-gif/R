import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Captured by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center p-6 font-inter selection:bg-app-accent/25">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          
          <div className="w-full max-w-2xl bg-app-card border border-app-border rounded-2xl p-8 shadow-2xl relative overflow-hidden transition-all duration-300">
            {/* Header / Accent Bar */}
            <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-app-danger via-app-warning to-app-accent" />
            
            <div className="flex flex-col items-center text-center mt-4">
              <div className="p-3 bg-app-danger-bg text-app-danger rounded-full mb-6">
                <span className="material-symbols-outlined text-4xl block" style={{ fontVariationSettings: "'FILL' 1" }}>
                  running_with_errors
                </span>
              </div>
              
              <h2 className="text-2xl font-extrabold tracking-tight text-app-text font-hanken">
                Application crashed gracefully
              </h2>
              <p className="text-sm text-app-text-secondary mt-3 max-w-md leading-relaxed">
                An unexpected Javascript error occurred. You can reload the page to continue or reset your session if the crash persists.
              </p>
            </div>

            {/* Error Message Details */}
            {this.state.error && (
              <div className="mt-8 rounded-xl border border-app-border bg-app-bg/50 p-4 font-jetbrains text-xs">
                <p className="font-bold text-app-danger flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {this.state.error.toString()}
                </p>
                
                {this.state.errorInfo && (
                  <details className="mt-3 group">
                    <summary className="text-[11px] font-black uppercase tracking-wider text-app-text-secondary cursor-pointer hover:text-app-text transition-colors select-none">
                      Show technical stack trace
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-app-border bg-app-card p-3 text-[10px] text-app-text-secondary leading-normal whitespace-pre-wrap select-text">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Recovery Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-8 pt-6 border-t border-app-border/40">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto px-4.5 py-2.5 text-xs font-black uppercase tracking-wider text-app-danger hover:bg-app-danger-bg rounded-xl border border-app-danger/20 transition-all active:scale-95 cursor-pointer font-jetbrains"
              >
                Clear Data & Reset
              </button>
              
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-black uppercase tracking-wider bg-app-accent text-app-on-accent hover:opacity-90 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer font-jetbrains"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
