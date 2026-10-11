import { publicTablesSchema, tableViewSchema, tableWatchSchema } from '@dozari/shared';
import type { CreateTableBody, PublicTable, TableReaction, TableView, TableWatch } from '@dozari/shared';
import { session } from '../auth';
import { callJson } from '../net/http';

const authed = <T>(path: string, method: 'GET' | 'POST', body: unknown, parse: (v: unknown) => T): Promise<T> => session.authed(async (token) => parse(await callJson(path, method, body, token)));
const nothing = () => undefined;

export const createTable = (body: CreateTableBody): Promise<TableView> => authed('/tables', 'POST', body, (v) => tableViewSchema.parse(v));
export const fetchTable = (code: string): Promise<TableView> => authed(`/tables/${code}`, 'GET', undefined, (v) => tableViewSchema.parse(v));
/** A look at a playing public table from the stands (read only); each call also counts the caller as a watcher for a few seconds. */
export const fetchWatch = (code: string): Promise<TableWatch> => authed(`/tables/${code}/watch`, 'GET', undefined, (v) => tableWatchSchema.parse(v));
/** A canned cheer from the stands (one every couple of seconds). */
export const reactAtTable = (code: string, kind: TableReaction): Promise<void> => authed(`/tables/${code}/react`, 'POST', { kind }, nothing);
export const fetchMyTable = (): Promise<TableView | null> => authed('/tables/mine', 'GET', undefined, (v) => ((v as { table: unknown }).table ? tableViewSchema.parse((v as { table: unknown }).table) : null));
export const joinTable = (code: string): Promise<TableView> => authed(`/tables/${code}/join`, 'POST', {}, (v) => tableViewSchema.parse(v));
export const leaveTable = (): Promise<void> => authed('/tables/leave', 'POST', {}, nothing);
export const startTable = (): Promise<void> => authed('/tables/start', 'POST', {}, nothing);
export const setTableReady = (ready: boolean): Promise<void> => authed('/tables/ready', 'POST', { ready }, nothing);
export const setTableLocked = (locked: boolean): Promise<void> => authed('/tables/lock', 'POST', { locked }, nothing);
export const setTableSide = (side: 0 | 1): Promise<void> => authed('/tables/side', 'POST', { side }, nothing);
export const shareTable = (): Promise<void> => authed('/tables/share', 'POST', {}, nothing);
export const extendTable = (): Promise<void> => authed('/tables/extend', 'POST', {}, nothing);
export const kickFromTable = (userId: string): Promise<void> => authed('/tables/kick', 'POST', { userId }, nothing);
/** Invites one friend to the caller's table; `online` tells whether the card reached them live or only a Bale nudge went out. */
export const inviteToTable = (userId: string): Promise<{ online: boolean }> => authed('/tables/invite', 'POST', { userId }, (v) => ({ online: (v as { online?: boolean }).online === true }));
/** The open (public) tables, with full, closed and playing ones listed too (view only). */
export const fetchPublicTables = (): Promise<PublicTable[]> => authed('/tables/public', 'GET', undefined, (v) => publicTablesSchema.parse(v).tables);
/** Asks the host of a public table to let you sit down. */
export const requestSeat = (code: string): Promise<void> => authed(`/tables/${code}/request`, 'POST', {}, nothing);
/** Host: let a requester in or turn them down. */
export const answerRequest = (userId: string, accept: boolean): Promise<void> => authed('/tables/answer', 'POST', { userId, accept }, nothing);
