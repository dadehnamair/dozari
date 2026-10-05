import { chatHistorySchema, chatMessageSchema, tauntsSchema } from '@dozari/shared';
import type { ChatHistory, ChatMessage, TauntCategory } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', parse: (v: unknown) => T, body?: unknown): Promise<T> =>
  session.authed(async (token) => parse(await callJson(path, method, body, token)));

/** The two rooms of the chat sheet: the player's city and everyone (D103). */
export type ChatTab = 'city' | 'global';

export const fetchChat = (room: ChatTab): Promise<ChatHistory> => authed(`/chat/${room}`, 'GET', (v) => chatHistorySchema.parse(v));
export const fetchTaunts = (): Promise<TauntCategory[]> => authed('/chat/taunts', 'GET', (v) => tauntsSchema.parse(v).categories);
export const sendText = (room: ChatTab, text: string): Promise<ChatMessage> => authed(`/chat/${room}`, 'POST', (v) => chatMessageSchema.parse((v as { message: unknown }).message), { kind: 'text', text });
export const sendTaunt = (room: ChatTab, tauntId: string): Promise<ChatMessage> => authed(`/chat/${room}`, 'POST', (v) => chatMessageSchema.parse((v as { message: unknown }).message), { kind: 'taunt', tauntId });
export const reportMessage = (messageId: string, reason = ''): Promise<void> => authed('/chat/report', 'POST', () => undefined, { messageId, reason });

/** Chat of a private table: only the players seated at it. */
export const fetchTableChat = (code: string): Promise<ChatHistory> => authed(`/chat/table/${code}`, 'GET', (v) => chatHistorySchema.parse(v));
export const sendTableChat = (code: string, text: string): Promise<ChatMessage> => authed(`/chat/table/${code}`, 'POST', (v) => chatMessageSchema.parse((v as { message: unknown }).message), { kind: 'text', text });

/** Private chat with a friend (D115). */
export const fetchDm = (friendId: string): Promise<ChatHistory> => authed(`/chat/dm/${friendId}`, 'GET', (v) => chatHistorySchema.parse(v));
export const sendDm = (friendId: string, text: string): Promise<ChatMessage> => authed(`/chat/dm/${friendId}`, 'POST', (v) => chatMessageSchema.parse((v as { message: unknown }).message), { kind: 'text', text });
