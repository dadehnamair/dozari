import { ZodError } from 'zod';
import { fa } from '../i18n/fa';
import { ApiError } from './api';

/** Turns a failed request into a user message plus a small technical line (so "can't connect" is diagnosable). */
export function describeError(err: unknown, baseUrl: string): { message: string; detail: string } {
  const e = fa.solo.errors;
  if (err instanceof ApiError) {
    if (err.code === 'no_puzzles') return { message: e.noPuzzles, detail: '' };
    if (err.code === 'done') return { message: e.dailyDone, detail: '' };
    if (err.code === 'daily_cap') return { message: e.dailyCap, detail: '' };
    if (err.code === 'unavailable') return { message: e.noPuzzles, detail: '' };
    return { message: e.server, detail: `${err.status} ${err.code}` };
  }
  if (err instanceof ZodError) return { message: e.badResponse, detail: err.issues[0]?.message ?? '' };
  // fetch() rejects with a TypeError when the server is down, the address is wrong, or the browser blocks it (CORS).
  return { message: e.network, detail: `${e.address}: ${baseUrl}` };
}
