import '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { server } from './test/mswServer';

// Mock window.scrollTo since jsdom doesn't implement it
window.scrollTo = vi.fn();

// Mock ResizeObserver for test environment
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Robust memory-backed Storage mock to avoid jsdom localStorage issues
class MemoryStorage {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  get length() {
    return Object.keys(this.store).length;
  }
}

const mockLocalStorage = new MemoryStorage();
const mockSessionStorage = new MemoryStorage();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
