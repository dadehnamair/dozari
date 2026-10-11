import { spawn } from 'node:child_process';
import { Transform } from 'node:stream';
import type { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';

export interface DumpSource {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** A running dump: `stream` is the gzipped SQL; `done` settles when the process is over (rejects on a non-zero exit). */
export interface DumpHandle {
  stream: Readable;
  done: Promise<void>;
}
export type Dumper = () => DumpHandle;

export function parseDatabaseUrl(url: string): DumpSource {
  const u = new URL(url);
  return { host: u.hostname, port: u.port ? Number(u.port) : 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.replace(/^\//, '') };
}

/** Marker every real dump of this schema contains; a smaller one is a failed run (same check as deploy/backup.sh). */
const MARKER = 'CREATE TABLE `users`';

/**
 * Dumps the whole database with `mysqldump` (consistent snapshot, routines included) and gzips it on the fly.
 * The password goes through `MYSQL_PWD`, never the command line. A dump without the users table fails the stream.
 */
export function createMysqldumpDumper(src: DumpSource, opts: { bin?: string; extraArgs?: string[] } = {}): Dumper {
  return () => {
    const args = ['--host', src.host, '--port', String(src.port), '--user', src.user, '--single-transaction', '--quick', '--routines', '--no-tablespaces', '--default-character-set=utf8mb4', ...(opts.extraArgs ?? []), src.database];
    const child = spawn(opts.bin ?? 'mysqldump', args, { env: { PATH: process.env.PATH ?? '', MYSQL_PWD: src.password }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString('utf8')).slice(-1000);
    });
    let seen = false;
    let tail = '';
    const check = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        if (!seen) {
          const text = tail + chunk.toString('latin1');
          seen = text.includes(MARKER);
          tail = text.slice(-MARKER.length);
        }
        cb(null, chunk);
      },
      flush(cb) {
        cb(seen ? null : new Error('the dump has no users table'));
      },
    });
    const gz = createGzip();
    child.stdout.pipe(check).pipe(gz);
    check.on('error', (e) => gz.destroy(e));
    gz.on('error', () => undefined); // consumers add their own listener; this only stops an unattended stream from crashing the process
    const done = new Promise<void>((resolve, reject) => {
      child.on('error', (e) => {
        gz.destroy(e);
        reject(e);
      });
      child.on('close', (code) => {
        if (code === 0) return resolve();
        const err = new Error(`mysqldump exited with code ${code}: ${stderr.trim()}`);
        gz.destroy(err);
        reject(err);
      });
    });
    done.catch(() => undefined); // the caller awaits it; this only keeps an early failure from being "unhandled"
    return { stream: gz, done };
  };
}
