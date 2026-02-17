/**
 * Vitest Setup File
 *
 * Sets up test environment with mocks for browser APIs
 */

import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
    get length() {
      return Object.keys(store).length;
    },
    _getStore: () => store // Helper for testing
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock
});

// Mock IndexedDB with minimal implementation
const indexedDBMock = {
  open: vi.fn(() => {
    const request: Record<string, unknown> = {
      onerror: null as ((ev: unknown) => void) | null,
      onsuccess: null as ((ev: unknown) => void) | null,
      onupgradeneeded: null as ((ev: unknown) => void) | null,
      result: {
        objectStoreNames: { contains: () => false },
        createObjectStore: vi.fn(),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            put: vi.fn(() => ({ onsuccess: null, onerror: null })),
            get: vi.fn(() => ({ onsuccess: null, onerror: null, result: null })),
            delete: vi.fn()
          }))
        }))
      }
    };
    setTimeout(() => {
      if (typeof request.onupgradeneeded === 'function') {
        request.onupgradeneeded({ target: { result: request.result } });
      }
      if (typeof request.onsuccess === 'function') {
        request.onsuccess({ target: request });
      }
    }, 0);
    return request;
  })
};

Object.defineProperty(globalThis, 'indexedDB', {
  value: indexedDBMock
});

// Mock window.location
const locationMock = {
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  host: 'localhost:3000',
  hostname: 'localhost',
  pathname: '/',
  search: '',
  protocol: 'http:'
};

Object.defineProperty(globalThis, 'location', {
  value: locationMock,
  writable: true
});

// Mock window.history
const historyMock = {
  pushState: vi.fn(),
  replaceState: vi.fn()
};

Object.defineProperty(globalThis, 'history', {
  value: historyMock
});

// Mock navigator.clipboard
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve(''))
  },
  writable: true
});

// Mock visualViewport for mobile testing
Object.defineProperty(globalThis, 'visualViewport', {
  value: {
    width: 1024,
    height: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  },
  writable: true
});

// Mock RTCPeerConnection for WebRTC tests
(globalThis as Record<string, unknown>).RTCPeerConnection = vi.fn().mockImplementation(() => ({
  createDataChannel: vi.fn(() => ({
    label: 'test',
    readyState: 'connecting',
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn()
  })),
  createOffer: vi.fn(() => Promise.resolve({ type: 'offer', sdp: 'v=0\r\n...' })),
  createAnswer: vi.fn(() => Promise.resolve({ type: 'answer', sdp: 'v=0\r\n...' })),
  setLocalDescription: vi.fn(() => Promise.resolve()),
  setRemoteDescription: vi.fn(() => Promise.resolve()),
  addIceCandidate: vi.fn(() => Promise.resolve()),
  close: vi.fn(),
  connectionState: 'new',
  iceConnectionState: 'new',
  iceGatheringState: 'new',
  localDescription: null,
  remoteDescription: null,
  onicecandidate: null,
  ondatachannel: null,
  onconnectionstatechange: null,
  oniceconnectionstatechange: null,
  onicegatheringstatechange: null,
  getStats: vi.fn(() => Promise.resolve(new Map()))
}));

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof globalThis.ResizeObserver;

// Mock RTCSessionDescription and RTCIceCandidate
(globalThis as Record<string, unknown>).RTCSessionDescription = class RTCSessionDescription {
  constructor(desc: Record<string, unknown>) { Object.assign(this, desc); }
};
(globalThis as Record<string, unknown>).RTCIceCandidate = class RTCIceCandidate {
  constructor(candidate: Record<string, unknown>) { Object.assign(this, candidate); }
};

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  locationMock.search = '';
  locationMock.href = 'http://localhost:3000';
});
