import { lookupDetailSchema, lookupSearchSchema } from '@dozari/shared';
import type { LookupDetail, LookupSearch } from '@dozari/shared';
import { callJson } from '../net/http';

export const searchProducts = async (q: string): Promise<LookupSearch> =>
  lookupSearchSchema.parse(await callJson(`/lookup/search?q=${encodeURIComponent(q)}`, 'GET'));

export const fetchLookup = async (id: string, year?: number): Promise<LookupDetail> =>
  lookupDetailSchema.parse(await callJson(`/lookup/${id}${year ? `?year=${year}` : ''}`, 'GET'));
