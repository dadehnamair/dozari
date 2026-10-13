/** VAPID public key (URL-safe base64) to the bytes `pushManager.subscribe` wants. */
export function keyBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = (globalThis as unknown as { atob: (s: string) => string }).atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
