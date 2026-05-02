import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadStorage = async () => {
  vi.resetModules();
  return await import('./storage');
};

describe('storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores, reads, and removes namespaced values', async () => {
    const { getLocalStorageValue, removeLocalStorageValue, setLocalStorageValue, STORAGE_KEYS } =
      await loadStorage();

    setLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN, 'token-1');

    expect(window.localStorage.getItem(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBe('token-1');
    expect(getLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBe('token-1');

    removeLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN);

    expect(window.localStorage.getItem(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBeNull();
    expect(getLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBeNull();
  });

  it('migrates legacy values and deletes the legacy key', async () => {
    const { getLocalStorageValue, migrateLocalStorageValue, STORAGE_KEYS } = await loadStorage();
    window.localStorage.setItem('discord_access_token', 'legacy-token');

    const migratedValue = migrateLocalStorageValue(
      'discord_access_token',
      STORAGE_KEYS.DISCORD_ACCESS_TOKEN,
    );

    expect(migratedValue).toBe('legacy-token');
    expect(getLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBe('legacy-token');
    expect(window.localStorage.getItem('discord_access_token')).toBeNull();
  });

  it('keeps the current namespaced value when a legacy value is also present', async () => {
    const { getLocalStorageValue, migrateLocalStorageValue, setLocalStorageValue, STORAGE_KEYS } =
      await loadStorage();
    setLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN, 'current-token');
    window.localStorage.setItem('discord_access_token', 'legacy-token');

    const migratedValue = migrateLocalStorageValue(
      'discord_access_token',
      STORAGE_KEYS.DISCORD_ACCESS_TOKEN,
    );

    expect(migratedValue).toBe('current-token');
    expect(getLocalStorageValue(STORAGE_KEYS.DISCORD_ACCESS_TOKEN)).toBe('current-token');
    expect(window.localStorage.getItem('discord_access_token')).toBeNull();
  });
});
