import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Seals the S3 secret keys kept in `backup_targets` (AES-256-GCM). The key comes from `BACKUP_SECRET_KEY`, falling back to `ADMIN_TOKEN`. */
export interface SecretBox {
  seal(plain: string): string;
  /** Null when the value was sealed with another key or is damaged. */
  open(sealed: string): string | null;
}

export function createSecretBox(secret: string): SecretBox {
  const key = createHash('sha256').update(`dozari-backup-v1:${secret}`).digest();
  return {
    seal(plain) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
      return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
    },
    open(sealed) {
      try {
        const [v, iv, tag, enc] = sealed.split(':');
        if (v !== 'v1' || !iv || !tag || !enc) return null;
        const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
        d.setAuthTag(Buffer.from(tag, 'base64'));
        return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
      } catch {
        return null;
      }
    },
  };
}
