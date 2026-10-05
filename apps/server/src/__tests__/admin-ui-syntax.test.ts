import { describe, expect, it } from 'vitest';
import { ADMIN_CORE_JS } from '../admin/ui/core.js';
import { ADMIN_KIT_JS } from '../admin/ui/kit.js';
import { ADMIN_BOOT_JS, ADMIN_SHELL_JS } from '../admin/ui/shell.js';
import { ADMIN_VIEWS1_JS } from '../admin/ui/views1.js';
import { ADMIN_VIEWS2_JS } from '../admin/ui/views2.js';
import { ADMIN_VIEWS3_JS } from '../admin/ui/views3.js';

/** The admin panel is browser code kept in template strings; a typo there would only show up as a blank panel, so parse it here. */
describe('admin panel script', () => {
  it('is valid JavaScript', () => {
    expect(() => new Function([ADMIN_CORE_JS, ADMIN_KIT_JS, ADMIN_SHELL_JS, ADMIN_VIEWS1_JS, ADMIN_VIEWS2_JS, ADMIN_VIEWS3_JS, ADMIN_BOOT_JS].join('\n'))).not.toThrow();
  });
});

describe('admin age-track switches stay in step with the shared list', () => {
  it('the «رده‌های سنی» tab knows every kill-switch feature', async () => {
    const { TRACK_FEATURES } = await import('@dozari/shared');
    for (const f of TRACK_FEATURES) expect(ADMIN_VIEWS3_JS, f).toContain(`['${f}',`);
  });
});
