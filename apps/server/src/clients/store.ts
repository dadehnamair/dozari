import { userClients } from '@dozari/db';
import type { Db } from '@dozari/db';
import type { ClientInfo, ClientInfoStore } from './info.js';

export function createDbClientInfoStore(db: Db): ClientInfoStore {
  return {
    async record(userId, info: ClientInfo) {
      const now = new Date();
      // firstStore / firstBuild / firstSeenAt are only set by the insert, never by the update: they are the install source.
      await db
        .insert(userClients)
        .values({ userId, platform: info.platform, osVersion: info.osVersion, appBuild: info.appBuild, store: info.store, firstStore: info.store, firstBuild: info.appBuild, firstSeenAt: now, updatedAt: now })
        .onDuplicateKeyUpdate({ set: { platform: info.platform, osVersion: info.osVersion, appBuild: info.appBuild, store: info.store, updatedAt: now } });
    },
  };
}
