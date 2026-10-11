import { Client } from 'minio';
import type { Readable } from 'node:stream';

export interface S3Params {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

/** The part of an S3-compatible bucket the backups need. */
export interface BackupStorage {
  /** Throws a short, secret-free message when the bucket cannot be reached or written. */
  check(probeKey: string): Promise<void>;
  put(key: string, body: Readable): Promise<void>;
  remove(key: string): Promise<void>;
  presignGet(key: string, seconds: number): Promise<string>;
}
export type StorageFactory = (p: S3Params) => BackupStorage;

export const isHttpEndpoint = (v: string): boolean => {
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
};

export const createS3Storage: StorageFactory = (p) => {
  const u = new URL(p.endpoint);
  const client = new Client({
    endPoint: u.hostname,
    port: u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80,
    useSSL: u.protocol === 'https:',
    accessKey: p.accessKey,
    secretKey: p.secretKey,
    ...(p.region ? { region: p.region } : {}),
  });
  return {
    async check(probeKey) {
      if (!(await client.bucketExists(p.bucket))) throw new Error('the bucket does not exist');
      await client.putObject(p.bucket, probeKey, Buffer.from('ok'));
      await client.removeObject(p.bucket, probeKey);
    },
    async put(key, body) {
      await client.putObject(p.bucket, key, body, undefined, { 'Content-Type': 'application/gzip' });
    },
    async remove(key) {
      await client.removeObject(p.bucket, key);
    },
    presignGet: (key, seconds) => client.presignedGetObject(p.bucket, key, seconds),
  };
};
