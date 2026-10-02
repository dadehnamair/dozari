import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True when `moduleUrl` is the entry script. Compares filesystem paths, not `file://` strings:
 * on Windows `process.argv[1]` is `F:\dozari\...` while `import.meta.url` is `file:///F:/dozari/...`,
 * so a string comparison never matches and the server silently never starts.
 */
export function isMainModule(
  moduleUrl: string,
  argv1: string | undefined = process.argv[1],
  caseInsensitive: boolean = process.platform === 'win32',
): boolean {
  if (!argv1) return false;
  const a = resolve(fileURLToPath(moduleUrl));
  const b = resolve(argv1);
  return caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}
