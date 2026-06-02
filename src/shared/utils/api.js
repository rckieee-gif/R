export function resolveApiBase(env = import.meta.env) {
  if (env.PROD) return '';

  const configuredApiBase = env.VITE_API_BASE?.trim();
  return configuredApiBase ? configuredApiBase.replace(/\/+$/, '') : '';
}

export const API_BASE = resolveApiBase();
