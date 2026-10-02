import { chatHistorySchema, chatMessageSchema, tauntsSchema } from '@dozari/shared';
import type { ChatHistory, ChatMessage, TauntCategory } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

export const fetchCityChat = (): Promise<ChatHistory> => authed('/chat/city', 'GET', (v) => chatHistorySchema.parse(v));
export const fetchTaunts = (): Promise<TauntCategory[]> => authed('/chat/taunts', 'GET', (v) => tauntsSchema.parse(v).categories);
export const sendText = (text: string): Promise<ChatMessage> => authed('/chat/city', 'POST', (v) => chatMessageSchema.parse((v as { message: unknown }).message), { kind: 'text', text });
export const sendTaunt = (tauntId: string): Promise<ChatMessage> => authed('/chat/city', 'POST', (v) => chatMessageSchema.parse((v as { message: unknown }).message), { kind: 'taunt', tauntId });
export const reportMessage = (messageId: string): Promise<void> => authed('/chat/report', 'POST', () => undefined, { messageId });
