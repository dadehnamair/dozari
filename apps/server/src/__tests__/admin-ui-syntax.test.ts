import { describe, expect, it } from 'vitest';
import { ADMIN_CORE_JS } from '../admin/ui/core.js';
import { ADMIN_KIT_JS } from '../admin/ui/kit.js';
import { ADMIN_BOOT_JS, ADMIN_SHELL_JS } from '../admin/ui/shell.js';
import { ADMIN_VIEWS1_JS } from '../admin/ui/views1.js';
import { ADMIN_VIEWS2_JS } from '../admin/ui/views2.js';
import { ADMIN_VIEWS2_PUZZLES_JS } from '../admin/ui/views2/puzzles.js';
import { ADMIN_VIEWS3_JS } from '../admin/ui/views3.js';

/** The admin panel is browser code kept in template strings; a typo there would only show up as a blank panel, so parse it here. */
describe('admin panel script', () => {
  it('is valid JavaScript', () => {
    expect(() => new Function([ADMIN_CORE_JS, ADMIN_KIT_JS, ADMIN_SHELL_JS, ADMIN_VIEWS1_JS, ADMIN_VIEWS2_JS, ADMIN_VIEWS3_JS, ADMIN_BOOT_JS].join('\n'))).not.toThrow();
  });
});

/** A syntax check cannot see a deleted helper, so every local helper the puzzles view calls must still be declared in it. */
describe('admin puzzles view', () => {
  it('declares every draw*/review helper it calls', () => {
    const called = new Set([...ADMIN_VIEWS2_PUZZLES_JS.matchAll(/(?<![.\w])(draw\w*|filterSelects|matches|revOk|revOpts|when|openAssistant|puzzleCard|reload)\(/g)].map((m) => m[1]!));
    for (const name of called) expect(ADMIN_VIEWS2_PUZZLES_JS, name).toMatch(new RegExp(`(function ${name}\\(|var ${name} = function)`));
  });
});

describe('admin catalog similar products', () => {
  const similarGroups = new Function(`${ADMIN_VIEWS1_JS.match(/function nameKeyFa[\s\S]*?\n}\n(?=VIEWS\.catalog)/)![0]}\nreturn similarGroups;`)() as (p: { id: string; nameFa: string }[]) => Record<string, { n: number; gid: string }>;

  it('groups products by normalized name or name containment', () => {
    const g = similarGroups([
      { id: 'a', nameFa: 'تن ماهی' },
      { id: 'b', nameFa: 'تن‌ماهی' },
      { id: 'c', nameFa: 'کنسرو تن ماهی' },
      { id: 'd', nameFa: 'شیر' },
      { id: 'e', nameFa: 'شیر کاکائو' },
    ]);
    expect([g.a!.n, g.b!.n, g.c!.n]).toEqual([3, 3, 3]);
    expect(g.a!.gid).toBe(g.c!.gid);
    expect([g.d!.n, g.e!.n]).toEqual([1, 1]);
  });
});

describe('admin age-track switches stay in step with the shared list', () => {
  it('the «رده‌های سنی» tab knows every kill-switch feature', async () => {
    const { TRACK_FEATURES } = await import('@dozari/shared');
    for (const f of TRACK_FEATURES) expect(ADMIN_VIEWS3_JS, f).toContain(`['${f}',`);
  });
});

describe('admin economy page', () => {
  it('has a Persian label for every ledger reason', async () => {
    const { LEDGER_REASONS } = await import('@dozari/db');
    for (const reason of LEDGER_REASONS) expect(ADMIN_VIEWS3_JS, reason).toContain(`${reason}: '`);
  });
});
