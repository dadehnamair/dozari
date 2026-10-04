import { appSettings, eq } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { SettingsStore } from './service.js';

export function createDbSettingsStore(db: Db): SettingsStore {
  return {
    async all() {
      const rows = await db.select().from(appSettings);
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
    async set(key, value) {
      await db.insert(appSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
    },
    async remove(key) {
      await db.delete(appSettings).where(eq(appSettings.key, key));
    },
  };
}

export function createMemorySettingsStore(initial: Record<string, string> = {}): SettingsStore {
  const data = { ...initial };
  return {
    async all() {
      return { ...data };
    },
    async set(key, value) {
      data[key] = value;
    },
    async remove(key) {
      delete data[key];
    },
  };
}
