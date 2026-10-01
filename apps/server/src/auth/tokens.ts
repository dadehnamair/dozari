import { SignJWT, jwtVerify } from 'jose';

/** Guest sessions are HS256 JWTs carrying only the user id (`sub`); everything else is looked up server-side. */
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface TokenSigner {
  sign(userId: string): Promise<string>;
  /** The user id and issue time (epoch seconds) inside a valid, unexpired token, else null. */
  verify(token: string): Promise<{ userId: string; issuedAt: number } | null>;
}

export function createTokenSigner(secret: string, now: () => number = Date.now): TokenSigner {
  if (secret.length < 16) throw new Error('JWT_SECRET must be at least 16 characters');
  const key = new TextEncoder().encode(secret);
  return {
    async sign(userId) {
      const iat = Math.floor(now() / 1000);
      return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt(iat).setExpirationTime(iat + TOKEN_TTL_SECONDS).sign(key);
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'], currentDate: new Date(now()) });
        return typeof payload.sub === 'string' ? { userId: payload.sub, issuedAt: typeof payload.iat === 'number' ? payload.iat : 0 } : null;
      } catch {
        return null;
      }
    },
  };
}
