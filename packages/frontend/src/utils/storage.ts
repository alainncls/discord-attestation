const storageCache = new Map<string, string | null>();

export const STORAGE_KEYS = {
  DISCORD_ACCESS_TOKEN: 'discord-attestation:discord-access-token:v1',
  DISCORD_OAUTH_STARTED: 'discord-attestation:oauth-started:v1',
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const getLocalStorageValue = (key: StorageKey) => {
  if (!storageCache.has(key)) {
    storageCache.set(key, readLocalStorageValue(key));
  }

  return storageCache.get(key) ?? null;
};

export const setLocalStorageValue = (key: StorageKey, value: string) => {
  storageCache.set(key, value);

  try {
    if (canUseStorage()) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    storageCache.delete(key);
  }
};

export const removeLocalStorageValue = (key: StorageKey) => {
  storageCache.set(key, null);

  try {
    if (canUseStorage()) {
      window.localStorage.removeItem(key);
    }
  } catch {
    storageCache.delete(key);
  }
};

export const migrateLocalStorageValue = (legacyKey: string, key: StorageKey) => {
  const currentValue = getLocalStorageValue(key);
  if (currentValue !== null) {
    removeLegacyLocalStorageValue(legacyKey);
    return currentValue;
  }

  const legacyValue = readLocalStorageValue(legacyKey);
  if (legacyValue === null) {
    return null;
  }

  setLocalStorageValue(key, legacyValue);
  removeLegacyLocalStorageValue(legacyKey);
  return legacyValue;
};

const readLocalStorageValue = (key: string) => {
  try {
    return canUseStorage() ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const removeLegacyLocalStorageValue = (key: string) => {
  try {
    if (canUseStorage()) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore unavailable storage.
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key) {
      storageCache.delete(event.key);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      storageCache.clear();
    }
  });
}
