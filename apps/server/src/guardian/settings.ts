import { eq, guardianSettings } from '@dozari/db';
import type { Db } from '@dozari/db';
import { DEFAULT_GUARDIAN_SETTINGS } from '@dozari/shared';
import type { ChildLimits, GuardianSettings } from '@dozari/shared';

/** I/O boundary of what a guardian chose for a child (docs/logic/age-tracks.md §Guardian panel). No row = the open defaults. */
export interface GuardianSettingsStore {
  get(childId: string): Promise<GuardianSettings | null>;
  put(childId: string, settings: GuardianSettings, now: number): Promise<void>;
}

const CACHE_MS = 5_000;

/** Reads are on the hot path (every chat send, friend action and table open of a child), so they are cached for a few seconds and dropped on save. */
export class GuardianSettingsService {
  private readonly cache = new Map<string, { at: number; value: GuardianSettings }>();

  constructor(
    private readonly store: GuardianSettingsStore,
    private readonly now: () => number = Date.now,
  ) {}

  async get(childId: string): Promise<GuardianSettings> {
    const hit = this.cache.get(childId);
    if (hit && this.now() - hit.at < CACHE_MS) return hit.value;
    const value = (await this.store.get(childId)) ?? DEFAULT_GUARDIAN_SETTINGS;
    this.cache.set(childId, { at: this.now(), value });
    return value;
  }

  async put(childId: string, settings: GuardianSettings): Promise<GuardianSettings> {
    await this.store.put(childId, settings, this.now());
    this.cache.delete(childId);
    return settings;
  }

  /** What the child's own app may learn. */
  async limits(childId: string): Promise<ChildLimits> {
    const s = await this.get(childId);
    return { chatMode: s.chatMode, friendApproval: s.friendApproval, duelsEnabled: s.duelsEnabled, quietFrom: s.quietFrom, quietTo: s.quietTo, reminderMinutes: s.reminderMinutes };
  }
}

export function createDbGuardianSettingsStore(db: Db): GuardianSettingsStore {
  return {
    async get(childId) {
      const [r] = await db.select().from(guardianSettings).where(eq(guardianSettings.childId, childId));
      return r ? { chatMode: r.chatMode, friendApproval: r.friendApproval, duelsEnabled: r.duelsEnabled, quietFrom: r.quietFrom, quietTo: r.quietTo, reminderMinutes: r.reminderMinutes } : null;
    },
    async put(childId, s, now) {
      const values = { chatMode: s.chatMode, friendApproval: s.friendApproval, duelsEnabled: s.duelsEnabled, quietFrom: s.quietFrom, quietTo: s.quietTo, reminderMinutes: s.reminderMinutes, updatedAt: new Date(now) };
      await db.insert(guardianSettings).values({ childId, ...values }).onDuplicateKeyUpdate({ set: values });
    },
  };
}

export function createMemoryGuardianSettingsStore(): GuardianSettingsStore & { rows: Map<string, GuardianSettings> } {
  const rows = new Map<string, GuardianSettings>();
  return {
    rows,
    get: async (id) => rows.get(id) ?? null,
    put: async (id, s) => void rows.set(id, { ...s }),
  };
}
