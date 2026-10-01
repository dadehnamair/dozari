import { transferInfoSchema, transfersSchema } from '@dozari/shared';
import type { TransferInfo, TransferRow } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchTransferInfo = (): Promise<TransferInfo> => authed('/transfers/rules', 'GET', (v) => transferInfoSchema.parse(v));
export const fetchTransfers = (): Promise<TransferRow[]> => authed('/transfers', 'GET', (v) => transfersSchema.parse(v).transfers);
export const sendGift = (friendId: string, amount: number): Promise<void> => authed(`/friends/${friendId}/gift`, 'POST', () => undefined, { amount });
export const offerLoan = (friendId: string, amount: number): Promise<void> => authed(`/friends/${friendId}/loan`, 'POST', () => undefined, { amount });
export const answerLoan = (id: string, action: 'accept' | 'decline' | 'cancel'): Promise<void> => authed(`/loans/${id}/${action}`, 'POST', () => undefined);
export const repayLoan = (id: string, amount: number): Promise<void> => authed(`/loans/${id}/repay`, 'POST', () => undefined, { amount });
