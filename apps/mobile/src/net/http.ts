/** `EXPO_PUBLIC_API_URL` wins; otherwise a dev bundle talks to the local server and a release build to production. */
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (DEV ? 'http://localhost:3000' : 'https://api.mrbots.ir');

import { reportServer } from './health';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

/** JSON call to the Dozari server; throws `ApiError` for non-2xx. `token` adds the guest session header. */
export async function callJson(path: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT', body?: unknown, token?: string): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    reportServer(false);
    throw err;
  }
  // A proxy answering 502/503/504 means the server behind it is not there; anything else means it answered.
  reportServer(![502, 503, 504].includes(res.status));
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof json === 'object' && json !== null && 'error' in json ? String((json as { error: unknown }).error) : 'error';
    throw new ApiError(res.status, code);
  }
  return json;
}
