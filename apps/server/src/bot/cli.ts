/** `pnpm --filter @dozari/server bot:run [-- --source <id>]`: run the due sources (or one) once and exit. */
import { createDb } from '@dozari/db';
import { createDbBotRepository } from './repository.js';
import { BotService } from './service.js';
import { createDbSettingsStore } from '../settings/db-store.js';
import { SettingsService } from '../settings/service.js';

const db = createDb();
const settings = new SettingsService(createDbSettingsStore(db));
const bot = new BotService(createDbBotRepository(db));
const max = await settings.num('bot.max_candidates_per_run');
const flag = process.argv.indexOf('--source');
const sourceId = flag >= 0 ? process.argv[flag + 1] : undefined;
const runs = sourceId ? [await bot.runOne(sourceId, max)] : await bot.runDue(max);
for (const r of runs) console.log(r ? `${r.status.padEnd(6)} ${r.name}: found ${r.found}, new ${r.added}${r.error ? ` (${r.error})` : ''}` : 'source not found');
process.exit(0);
