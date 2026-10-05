import { OFFLINE_PACK_SIZE, soloOfflinePackSchema, soloOfflinePuzzleSchema } from '@dozari/shared';
import type { SoloOfflinePuzzle } from '@dozari/shared';
import { z } from 'zod';
import { session } from '../auth';
import { bigStore, cacheOwner } from '../net/cache';
import { callJson } from '../net/http';

/**
 * Solo puzzles kept on the phone for playing without internet (docs/logic/offline-solo.md). A puzzle is used once: playing it takes it
 * out of the pack, and the pack tops itself up from the server whenever the app is online. Per account, never throws.
 */
const KEY = 'dozari.offline.pack';
const stored = z.object({ owner: z.string(), puzzles: z.array(soloOfflinePuzzleSchema) });

async function load(): Promise<SoloOfflinePuzzle[]> {
  try {
    const raw = await bigStore.get(KEY);
    if (!raw) return [];
    const parsed = stored.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.owner === (await cacheOwner()) ? parsed.data.puzzles : [];
  } catch {
    return [];
  }
}

async function save(puzzles: SoloOfflinePuzzle[]): Promise<void> {
  try {
    await bigStore.set(KEY, JSON.stringify({ owner: await cacheOwner(), puzzles }));
  } catch {
    /* an offline pack is a nicety */
  }
}

/** How many saved puzzles there are. */
export const packSize = async (): Promise<number> => (await load()).length;

/** Takes the next saved puzzle out of the pack (null when there is none). */
export async function takeOfflinePuzzle(): Promise<SoloOfflinePuzzle | null> {
  const all = await load();
  const next = all[0];
  if (!next) return null;
  await save(all.slice(1));
  return next;
}

let filling: Promise<void> | null = null;

/** Tops the pack up to `OFFLINE_PACK_SIZE` from the server; quietly does nothing without internet or a sign-in. One run at a time. */
export function refillPack(): Promise<void> {
  filling ??= (async () => {
    try {
      const have = await load();
      const need = OFFLINE_PACK_SIZE - have.length;
      if (need <= 0) return;
      const got = soloOfflinePackSchema.parse(await session.authed((token) => callJson(`/solo/offline-pack?n=${need}`, 'GET', undefined, token)));
      const ids = new Set(have.map((p) => p.id));
      const merged = [...have, ...got.puzzles.filter((p) => !ids.has(p.id))].slice(0, OFFLINE_PACK_SIZE);
      await save(merged);
    } catch {
      /* offline or signed out: try again next time */
    }
  })().finally(() => {
    filling = null;
  });
  return filling;
}
