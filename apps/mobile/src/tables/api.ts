import { tableViewSchema } from '@dozari/shared';
import type { CreateTableBody, TableView } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', body: unknown, parse: (v: unknown) => T): Promise<T> => session.authed(async (token) => parse(await callJson(path, method, body, token)));
const nothing = () => undefined;

export const createTable = (body: CreateTableBody): Promise<TableView> => authed('/tables', 'POST', body, (v) => tableViewSchema.parse(v));
export const fetchTable = (code: string): Promise<TableView> => authed(`/tables/${code}`, 'GET', undefined, (v) => tableViewSchema.parse(v));
export const fetchMyTable = (): Promise<TableView | null> => authed('/tables/mine', 'GET', undefined, (v) => ((v as { table: unknown }).table ? tableViewSchema.parse((v as { table: unknown }).table) : null));
export const joinTable = (code: string): Promise<TableView> => authed(`/tables/${code}/join`, 'POST', {}, (v) => tableViewSchema.parse(v));
export const leaveTable = (): Promise<void> => authed('/tables/leave', 'POST', {}, nothing);
export const startTable = (): Promise<void> => authed('/tables/start', 'POST', {}, nothing);
export const setTableReady = (ready: boolean): Promise<void> => authed('/tables/ready', 'POST', { ready }, nothing);
export const setTableLocked = (locked: boolean): Promise<void> => authed('/tables/lock', 'POST', { locked }, nothing);
export const shareTable = (): Promise<void> => authed('/tables/share', 'POST', {}, nothing);
export const extendTable = (): Promise<void> => authed('/tables/extend', 'POST', {}, nothing);
export const kickFromTable = (userId: string): Promise<void> => authed('/tables/kick', 'POST', { userId }, nothing);
