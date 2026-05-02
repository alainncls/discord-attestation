/// <reference types="@testing-library/jest-dom" />

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.stubEnv('VITE_DISCORD_CLIENT_ID', 'discord-client-id');
vi.stubEnv('VITE_REDIRECT_URL', 'https://discord.alainnicolas.fr/');
vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', 'walletconnect-project-id');
vi.stubEnv('VITE_INFURA_API_KEY', 'infura-api-key');
vi.stubEnv('VITE_MODE', 'production');

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!customElements.get('appkit-button')) {
  customElements.define(
    'appkit-button',
    class AppKitButtonElement extends HTMLElement {
      connectedCallback() {
        if (!this.textContent) {
          this.textContent = 'Connect Wallet';
        }
      }
    },
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.clearAllMocks();
});
