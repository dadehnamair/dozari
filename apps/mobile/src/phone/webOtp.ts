/**
 * WebOTP (PWA, Chrome on Android): asks the browser for the SMS code and hands it back, so the field fills itself.
 * The SMS must end with `@<site domain> #<code>`. Returns a cancel fn; a no-op everywhere WebOTP does not exist (native, iOS Safari).
 */
export function listenForSmsCode(onCode: (code: string) => void): () => void {
  const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & { credentials?: { get?: (o: object) => Promise<{ code?: string } | null> } });
  if (!nav?.credentials?.get || typeof AbortController === 'undefined' || !('OTPCredential' in globalThis)) return () => {};
  const ctl = new AbortController();
  nav.credentials
    .get({ otp: { transport: ['sms'] }, signal: ctl.signal })
    .then((cred) => {
      if (cred?.code) onCode(cred.code);
    })
    .catch(() => {});
  return () => ctl.abort();
}
