export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

/** JSON call to the Dozari server; throws `ApiError` for non-2xx. `token` adds the guest session header. */
export async function callJson(path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown, token?: string): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof json === 'object' && json !== null && 'error' in json ? String((json as { error: unknown }).error) : 'error';
    throw new ApiError(res.status, code);
  }
  return json;
}
