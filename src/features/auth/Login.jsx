import { useState, useRef, useEffect } from 'react';
import { apiClient } from '../../shared/utils/apiClient';
import { useNotification } from '../../shared/hooks/useNotification';

export default function Login({ onLogin, onBack }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const { error: toastError } = useNotification();

  const cardRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (error) {
      let resetTimer;
      const shakeTimer = setTimeout(() => {
        setShake(true);
        resetTimer = setTimeout(() => setShake(false), 400);
      }, 0);
      return () => {
        clearTimeout(shakeTimer);
        clearTimeout(resetTimer);
      };
    }
  }, [error]);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;

    let clientX, clientY;
    if (e.type === 'touchmove' || e.type === 'touchstart') {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        return;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = card.getBoundingClientRect();
    
    // Calculate position relative to card center (-1 to 1) and clamp it
    const rawX = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const rawY = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
    const x = Math.max(-1, Math.min(1, rawX));
    const y = Math.max(-1, Math.min(1, rawY));

    // Limit the rotation angle to a very subtle tilt
    const maxRotate = 3;
    const rotateX = -y * maxRotate;
    const rotateY = x * maxRotate;

    // Dynamic shadow based on tilt
    const shadowX = -x * 8;
    const shadowY = -y * 8;
    const shadowBlur = 35 + Math.abs(x) * 5;

    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    card.style.boxShadow = `
      ${shadowX}px ${shadowY + 20}px ${shadowBlur}px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.2),
      inset 0 -1px 0 rgba(0,0,0,0.2)
    `;
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;

    card.style.transform = 'rotateX(0deg) rotateY(0deg)';
    card.style.boxShadow = `
      0px 20px 40px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.2),
      inset 0 -1px 0 rgba(0,0,0,0.2)
    `;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await apiClient.post('/api/auth/login', { login, email: login, password });
      const session = await apiClient.get('/api/auth/me', {
        retries: 0,
        suppressAuthFailure: true,
      });

      if (!session?.user) {
        throw new Error('Login succeeded, but the browser could not confirm the session cookie. Please refresh and try again.');
      }

      onLogin(session.user);
    } catch (err) {
      console.error('Login connection error:', err);
      const errMsg = err.message || 'Cannot connect to the server. Is it running?';
      setError(errMsg);
      toastError(errMsg);
    }
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseLeave}
      className="login-app-bg text-app-text font-sans min-h-screen flex flex-col items-center justify-center p-4 antialiased selection:bg-app-accent selection:text-app-on-accent"
    >
      <main className="w-full max-w-[400px] flex flex-col relative overflow-hidden perspective-container py-8">
        
        {/* Header / Back Button */}
        {onBack && (
          <header className="mb-6 flex justify-start z-30">
            <button 
              type="button"
              onClick={onBack}
              aria-label="Go back" 
              className="flex items-center btn-login-3d back-btn-3d py-2 rounded-full justify-center transition-all duration-150 active:scale-95 text-app-on-accent font-bold px-4 text-sm"
            >
              <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Back</span>
            </button>
          </header>
        )}

        {/* Login Content Area */}
        <section className="flex-grow flex items-center justify-center z-10 w-full relative">
          
          {/* Glassmorphism Login Card */}
          <div 
            ref={cardRef}
            className={`glass-card w-full rounded-[32px] p-8 flex flex-col items-center justify-center transition-all duration-100 animate-login-card ${shake ? 'animate-login-shake' : ''}`}
            style={{
              transform: 'rotateX(0deg) rotateY(0deg)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)'
            }}
          >
            <div className="card-content-3d w-full flex flex-col items-center">
              
              {/* Logo Section */}
              <div 
                className="flex flex-col items-center mb-8 text-center w-full blend-logo animate-login-item"
                style={{ transform: 'translateZ(40px)', animationDelay: '100ms' }}
              >
                <div className="w-24 h-24 mb-4 relative flex items-center justify-center rounded-full overflow-hidden bg-transparent">
                  <img 
                    alt="Octavio Poultry Logo" 
                    className="w-full h-full object-cover" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuABNsQ960Pmrnk68ERL8H1V7nTNgR3VcAhTQXfjz54-FzDhXtDujsFIH0JzNSozB1jq8KcKbnBMU0gkAWJTk9GX9myEeB1tWAyvtANgNNFQ66WQ31VJbRwGVC8BY0mhR-bRO0HPeLoB8xtdcQ1nOIzlL20AQ01eQQe5-PICHUimZgBgPMPZESXFLDMNCpO0Bv7p9mVW78U-HcnNZyRrppjA3inwLIZGJI2_o6DNMav2H25TGm0xApDdSwy_jmRqO97c9Q8yvn7ketUJ"
                  />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight leading-none mb-1 text-app-text font-hanken">
                  Octavio Poultry
                </h1>
                <h2 className="text-[10px] font-bold tracking-widest text-app-text-secondary uppercase mt-1 font-jetbrains">
                  Farm Management
                </h2>
              </div>

              {/* Error Alert — always rendered so the live region exists in the DOM for screen readers */}
              <div
                id="login-error"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className={error ? 'w-full bg-app-danger-bg border border-app-danger/40 text-app-danger px-4 py-3 rounded-full text-xs font-semibold text-center mb-5 backdrop-blur-md' : ''}
              >
                {error || ''}
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4 z-20 relative">
                
                {/* Username Input */}
                <div className="relative animate-login-item" style={{ animationDelay: '200ms' }}>
                  <label htmlFor="username" className="sr-only">Username or Email</label>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-secondary">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                  <input 
                    type="text"
                    id="username"
                    name="username"
                    required
                    autoComplete="username"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="input-glass block w-full pl-12 pr-4 py-3 rounded-full text-app-text text-sm"
                    placeholder="Username or Email"
                    aria-invalid={!!error}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                </div>

                {/* Password Input */}
                <div className="relative animate-login-item" style={{ animationDelay: '300ms' }}>
                  <label htmlFor="password" className="sr-only">Password</label>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-app-text-secondary">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path>
                    </svg>
                  </div>
                  <input 
                    type="password"
                    id="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-glass block w-full pl-12 pr-4 py-3 rounded-full text-app-text text-sm"
                    placeholder="Password"
                    aria-invalid={!!error}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                </div>

                {/* Submit Button */}
                <button 
                  type="submit"
                  className="mt-2 w-full text-app-on-accent font-extrabold py-3.5 px-4 rounded-full text-base tracking-wide btn-login-3d cursor-pointer hover:scale-[1.01] active:scale-[0.98] transition-all animate-login-item"
                  style={{ animationDelay: '400ms' }}
                >
                  Sign In
                </button>

              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
