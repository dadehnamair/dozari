import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createMysqldumpDumper, parseDatabaseUrl } from '../backup/dump.js';

const src = parseDatabaseUrl('mysql://dozari:p%40ss@db:3307/dozari');

function fake(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'fake-dump-'));
  const bin = join(dir, 'mysqldump');
  writeFileSync(bin, `#!/bin/sh\n${script}\n`);
  chmodSync(bin, 0o755);
  return bin;
}

async function collect(h: ReturnType<ReturnType<typeof createMysqldumpDumper>>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of h.stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

describe('mysqldump dumper', () => {
  it('parses the database url', () => {
    expect(src).toEqual({ host: 'db', port: 3307, user: 'dozari', password: 'p@ss', database: 'dozari' });
  });

  it('gzips the dump and passes the password by env, not argv', async () => {
    const bin = fake("echo \"-- pw=$MYSQL_PWD\"; echo 'CREATE TABLE `users` (id int);'; echo \"args: $*\"");
    const h = createMysqldumpDumper(src, { bin })();
    const text = gunzipSync(await collect(h)).toString();
    await h.done;
    expect(text).toContain('CREATE TABLE `users`');
    expect(text).toContain('pw=p@ss');
    expect(text.split('args:')[1]).not.toContain('p@ss');
    expect(text).toContain('--single-transaction');
  });

  it('fails a dump without the users table', async () => {
    const h = createMysqldumpDumper(src, { bin: fake('echo "CREATE TABLE other (id int);"') })();
    await expect(collect(h)).rejects.toThrow(/users table/);
  });

  it('fails on a non-zero exit', async () => {
    const h = createMysqldumpDumper(src, { bin: fake("echo 'CREATE TABLE `users` (id int);'; echo boom >&2; exit 2") })();
    await expect(h.done).rejects.toThrow(/code 2: boom/);
  });
});
