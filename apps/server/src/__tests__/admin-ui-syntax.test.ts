import { describe, expect, it } from 'vitest';
import { ADMIN_CORE_JS } from '../admin/ui/core.js';
import { ADMIN_BOOT_JS, ADMIN_SHELL_JS } from '../admin/ui/shell.js';
import { ADMIN_VIEWS1_JS } from '../admin/ui/views1.js';
import { ADMIN_VIEWS2_JS } from '../admin/ui/views2.js';

/** The admin panel is browser code kept in template strings; a typo there would only show up as a blank panel, so parse it here. */
describe('admin panel script', () => {
  it('is valid JavaScript', () => {
    expect(() => new Function([ADMIN_CORE_JS, ADMIN_SHELL_JS, ADMIN_VIEWS1_JS, ADMIN_VIEWS2_JS, ADMIN_BOOT_JS].join('\n'))).not.toThrow();
  });
});
