import { describe, expect, it, vi } from 'vitest';
import { createOAuthStateStore, pruneExpiredRecords } from '../oauth-state';
import type { OAuthStateRecord } from '../oauth-state';

const record: OAuthStateRecord = {
  version: 1,
  flow: 'discord',
  browserBindingHash: 'binding-hash',
  subject: '0x0000000000000000000000000000000000000001',
  chainId: 59144,
  redirectUri: 'https://app.example.com',
  origin: 'https://app.example.com',
  environment: 'production',
  issuedAt: 1_800_000_000_000,
  expiresAt: 1_800_000_300_000,
  status: 'pending',
};

describe('Netlify Blobs OAuth state adapter', () => {
  it('creates state with onlyIfNew and returns the actual write result', async () => {
    const setJSON = vi.fn().mockResolvedValue({ modified: true });
    const store = createOAuthStateStore({
      setJSON,
      getWithMetadata: vi.fn(),
    } as never);

    await expect(store.create('hash', record)).resolves.toBe(true);
    expect(setJSON).toHaveBeenCalledWith('hash', record, { onlyIfNew: true });
  });

  it('reads with strong consistency and requires the current ETag', async () => {
    const getWithMetadata = vi.fn().mockResolvedValue({ data: record, etag: 'etag-1' });
    const store = createOAuthStateStore({
      getWithMetadata,
      setJSON: vi.fn(),
    } as never);

    await expect(store.read('hash')).resolves.toEqual({ record, etag: 'etag-1' });
    expect(getWithMetadata).toHaveBeenCalledWith('hash', {
      type: 'json',
      consistency: 'strong',
    });
  });

  it('consumes state only with ETag compare-and-set and honors modified=false', async () => {
    const setJSON = vi.fn().mockResolvedValue({ modified: false });
    const store = createOAuthStateStore({
      setJSON,
      getWithMetadata: vi.fn(),
    } as never);

    await expect(
      store.compareAndSet('hash', 'etag-1', { ...record, status: 'consumed' }),
    ).resolves.toBe(false);
    expect(setJSON).toHaveBeenCalledWith(
      'hash',
      { ...record, status: 'consumed' },
      {
        onlyIfMatch: 'etag-1',
      },
    );
  });

  it('prunes records only after their expiry plus the retention margin', async () => {
    const now = 1_800_000_000_000;
    const list = vi.fn(async function* () {
      yield { blobs: [{ key: 'expired' }, { key: 'recent' }] };
    });
    const getWithMetadata = vi
      .fn()
      .mockResolvedValueOnce({ data: { expiresAt: now - 1_001 }, etag: '1' })
      .mockResolvedValueOnce({ data: { expiresAt: now - 999 }, etag: '2' });
    const remove = vi.fn().mockResolvedValue(undefined);

    await expect(
      pruneExpiredRecords({ list, getWithMetadata, delete: remove } as never, now, 1_000),
    ).resolves.toBe(1);
    expect(remove).toHaveBeenCalledExactlyOnceWith('expired');
    expect(getWithMetadata).toHaveBeenCalledTimes(2);
  });
});
