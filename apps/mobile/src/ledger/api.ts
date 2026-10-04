import { ledgerPageSchema } from '@dozari/shared';
import type { LedgerPage } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

export const fetchLedger = (before?: string | null): Promise<LedgerPage> =>
  session.authed(async (token) => ledgerPageSchema.parse(await callJson(`/me/ledger?limit=30${before ? `&before=${encodeURIComponent(before)}` : ''}`, 'GET', undefined, token)));
