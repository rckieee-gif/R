import { describe, expect, it } from 'vitest';
import { resolveApiBase } from '../shared/utils/api';

describe('API base resolution', () => {
  it('forces same-origin API calls in production builds', () => {
    expect(resolveApiBase({
      PROD: true,
      VITE_API_BASE: 'https://octavio-poultry-farms.onrender.com',
    })).toBe('');
  });

  it('keeps explicit API bases available outside production builds', () => {
    expect(resolveApiBase({
      PROD: false,
      VITE_API_BASE: 'https://octavio-poultry-farms.onrender.com/',
    })).toBe('https://octavio-poultry-farms.onrender.com');
  });
});
