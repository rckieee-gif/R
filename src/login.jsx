import { useState } from 'react';
import { API_BASE } from './api';

export default function Login({ onLogin, onBack }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, email: login, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Success! Pass the user data and token up to App.jsx
        onLogin(data.user, data.token);
      } else {
        setError(data.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login connection error:', err);
      setError('Cannot connect to the server. Is it running?');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-light dark:bg-gray-900 flex items-center justify-center p-4 font-sans transition-colors duration-300">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg border border-neutral-border dark:border-gray-700 w-full max-w-sm">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-5 text-xs font-black uppercase tracking-wider text-gray-400 transition hover:text-primary"
          >
            Back
          </button>
        )}
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-md">
            🐔
          </div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Octavio Poultry</h1>
          <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">Farm Management</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 text-center border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 pl-1">Username or Email</label>
            <input 
              type="text" 
              required 
              value={login} 
              onChange={(e) => setLogin(e.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
              placeholder="admin.roland"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1 pl-1">Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-neutral-border dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-secondary text-white p-4 rounded-xl font-bold text-lg hover:bg-opacity-90 transition-all active:scale-95 shadow-md mt-2"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">  </p>
          <p className="text-[10px] text-gray-500 mt-1">  </p>
          <p className="text-[10px] text-gray-500">  </p>
          <p className="text-[10px] text-gray-500">  </p>
          <p className="text-[10px] text-gray-500">  </p>
        </div>

      </div>
    </div>
  );
}
