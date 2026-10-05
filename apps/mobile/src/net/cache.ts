import { session } from '../auth';
import { deviceStore } from '../auth/storage';
import { createBigStore } from './bigStore';
import { createSwr } from './swr';

export const bigStore = createBigStore(deviceStore);

/** The account behind the cache: the tail of the session token is enough to tell two accounts apart without keeping the token itself. */
const owner = async (): Promise<string> => (await session.token()).slice(-16);

/** `swr(key, fetcher, onData, onError)`: cached copy first, live copy after; see `createSwr`. */
export const swr = createSwr({ store: bigStore, owner });

/** Same owner tag the cache uses, for other per-account data kept on the device (the offline puzzle pack). */
export const cacheOwner = owner;
