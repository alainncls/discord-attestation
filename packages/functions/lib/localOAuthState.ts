import type { OAuthStateRecord, OAuthStateStore } from '../oauth-state';

/** Loopback development only. Production continues to use Netlify Blobs. */
export function createLocalOAuthStateStore(): OAuthStateStore {
  const entries = new Map<string, { record: OAuthStateRecord; version: number }>();
  return {
    async create(key, record) {
      for (const [oldKey, entry] of entries) {
        if (entry.record.expiresAt <= Date.now()) entries.delete(oldKey);
      }
      if (entries.has(key) || entries.size >= 4096) return false;
      entries.set(key, { record: structuredClone(record), version: 1 });
      return true;
    },
    async read(key) {
      const entry = entries.get(key);
      return entry ? { record: structuredClone(entry.record), etag: String(entry.version) } : null;
    },
    async compareAndSet(key, etag, record) {
      const entry = entries.get(key);
      if (!entry || String(entry.version) !== etag) return false;
      entries.set(key, { record: structuredClone(record), version: entry.version + 1 });
      return true;
    },
  };
}
