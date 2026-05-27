const configuredApiBase = import.meta.env.VITE_API_BASE;

if (!configuredApiBase && import.meta.env.PROD) {
  throw new Error('VITE_API_BASE is required for production builds.');
}

export const API_BASE = configuredApiBase || 'http://localhost:5000';
