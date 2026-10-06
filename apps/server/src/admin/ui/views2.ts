import { ADMIN_VIEWS2_CORE_JS } from './views2/core.js';
import { ADMIN_VIEWS2_USERS_JS } from './views2/users.js';
import { ADMIN_VIEWS2_CONTENT_JS } from './views2/content.js';
import { ADMIN_VIEWS2_ECONOMY_JS } from './views2/economy.js';
import { ADMIN_VIEWS2_LANDING_JS } from './views2/landing.js';
import { ADMIN_VIEWS2_COMMUNITY_JS } from './views2/community.js';
import { ADMIN_VIEWS2_OPS_JS } from './views2/ops.js';
import { ADMIN_VIEWS2_PUZZLES_JS } from './views2/puzzles.js';
import { ADMIN_VIEWS2_AI_JS } from './views2/ai.js';

/** The second half of the admin panel's views, one script (the chunks share globals and run in this order). */
export const ADMIN_VIEWS2_JS = [ADMIN_VIEWS2_CORE_JS, ADMIN_VIEWS2_USERS_JS, ADMIN_VIEWS2_CONTENT_JS, ADMIN_VIEWS2_ECONOMY_JS, ADMIN_VIEWS2_LANDING_JS, ADMIN_VIEWS2_COMMUNITY_JS, ADMIN_VIEWS2_OPS_JS, ADMIN_VIEWS2_PUZZLES_JS, ADMIN_VIEWS2_AI_JS].join('');
