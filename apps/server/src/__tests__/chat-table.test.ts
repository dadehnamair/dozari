import { describe, expect, it } from 'vitest';
import { ChatService } from '../chat/service.js';
import { createMemoryChatStore } from '../chat/store.js';

const A = '00000000-0000-7000-8000-000000000001';
const B = '00000000-0000-7000-8000-000000000002';
const C = '00000000-0000-7000-8000-000000000003';

function setup(opts: { activated?: boolean; perk?: boolean } = {}) {
  const seated = new Map<string, string[]>([['ABCD2', [A, B]]]);
  const chat = new ChatService(createMemoryChatStore(), {
    cityOf: async () => null,
    profileOf: async (id) => ({ nickname: id === A ? 'الف' : 'ب', avatarKey: 'avatar-01' }),
    badgeTitleOf: async () => null,
    isActivated: async () => opts.activated ?? true,
    mute: async () => null,
    hasContactPerk: async () => opts.perk ?? false,
    areFriends: async () => false,
    tableMembers: (id, code) => (seated.get(code.toUpperCase())?.includes(id) ? [...seated.get(code.toUpperCase())!] : null),
    rules: async () => ({ maxLen: 40, textNeedsActivation: true, enabled: true, globalEnabled: true }),
  });
  const pushed: { to: string; text: string }[] = [];
  chat.toUser = (to, m) => pushed.push({ to, text: m.text });
  return { chat, pushed };
}

describe('private table chat', () => {
  it('reaches every seated player live and is kept in history', async () => {
    const { chat, pushed } = setup();
    const out = await chat.sendTable(A, 'abcd2', { kind: 'text', text: 'سلام رفقا' });
    expect(out.ok).toBe(true);
    expect(pushed.map((p) => p.to).sort()).toEqual([A, B]);
    const h = await chat.tableHistory(B, 'ABCD2');
    expect(typeof h).toBe('object');
    if (typeof h === 'object') expect(h.messages.map((m) => m.text)).toEqual(['سلام رفقا']);
  });

  it('refuses players who do not sit at the table (read and write)', async () => {
    const { chat } = setup();
    expect(await chat.sendTable(C, 'ABCD2', { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'NOT_IN_TABLE' });
    expect(await chat.tableHistory(C, 'ABCD2')).toBe('NOT_IN_TABLE');
    expect(await chat.tableHistory(A, 'ZZZZ9')).toBe('NOT_IN_TABLE');
  });

  it('applies the normal text rules: activation and contact info', async () => {
    const locked = setup({ activated: false });
    expect(await locked.chat.sendTable(A, 'ABCD2', { kind: 'text', text: 'سلام' })).toMatchObject({ ok: false, error: 'NEEDS_ACTIVATION' });
    const open = setup();
    expect(await open.chat.sendTable(A, 'ABCD2', { kind: 'text', text: 'زنگ بزن ۰۹۱۲۳۴۵۶۷۸۹' })).toMatchObject({ ok: false, error: 'CONTACT_BLOCKED' });
    const perk = setup({ perk: true });
    expect((await perk.chat.sendTable(A, 'ABCD2', { kind: 'text', text: 'زنگ بزن ۰۹۱۲۳۴۵۶۷۸۹' })).ok).toBe(true);
  });

  it('does not let a table card be posted inside a table', async () => {
    const { chat } = setup();
    expect((await chat.sendTable(A, 'ABCD2', { kind: 'table', code: 'ABCD2', label: 'x' })).ok).toBe(false);
  });
});
