import { sessionSchema } from '@dozari/shared';
import { callJson } from '../net/http';
import { createSessionManager } from './session';
import type { SessionManager } from './session';
import { deviceStore } from './storage';

/** The app-wide guest session (`POST /auth/guest`, token kept on the device). */
export const session: SessionManager = createSessionManager({
  store: deviceStore,
  login: async (deviceId) => sessionSchema.parse(await callJson('/auth/guest', 'POST', { deviceId })),
});
