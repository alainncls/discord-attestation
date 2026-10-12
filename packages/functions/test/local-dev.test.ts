import { afterEach, describe, expect, it } from 'vitest';
import axios from 'axios';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApiHandler } from '../api';
import { createLocalFunctionServer } from '../lib/localDevServer';
import { createLocalOAuthStateStore } from '../lib/localOAuthState';

let server: Server | undefined;
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  }
});

describe('loopback development uses the production handler', () => {
  it('preserves routes, CORS, cookies, no-store and one-use state without Netlify CLI', async () => {
    const store = createLocalOAuthStateStore();
    server = createLocalFunctionServer({
      api: createApiHandler({
        http: axios,
        config: () => ({
          VITE_DISCORD_CLIENT_ID: 'test-client',
          VITE_REDIRECT_URL: 'http://localhost:5173',
          NODE_ENV: 'development',
          CONTEXT: 'dev',
        }),
        oauthStateStore: () => store,
      }),
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const origin = 'http://localhost:5173';
    const preflight = await fetch(base + '/api', {
      method: 'OPTIONS',
      headers: { Origin: origin },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
    const start = await fetch(base + '/.netlify/functions/api', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        subject: '0x2222222222222222222222222222222222222222',
        chainId: 59141,
      }),
    });
    expect(start.status).toBe(200);
    expect(start.headers.get('cache-control')).toContain('no-store');
    expect(start.headers.get('set-cookie')).toContain('HttpOnly');
    expect((await start.json()).authorizeUrl).toContain('discord.com');
    expect((await fetch(base + '/missing')).status).toBe(404);
    const invalid = await fetch(base + '/api', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(invalid.status).toBe(400);
  });

  it('keeps local state CAS atomic across concurrent consumers', async () => {
    const store = createLocalOAuthStateStore();
    const record = {
      version: 1 as const,
      flow: 'discord' as const,
      browserBindingHash: 'x',
      subject: 'x',
      chainId: 59141,
      redirectUri: 'http://localhost',
      origin: 'http://localhost',
      environment: 'dev',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      status: 'pending' as const,
    };
    expect(await store.create('key', record)).toBe(true);
    const entry = (await store.read('key'))!;
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        store.compareAndSet('key', entry.etag, { ...record, status: 'consumed' }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
