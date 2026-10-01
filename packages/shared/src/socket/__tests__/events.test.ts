import { describe, expect, it } from 'vitest';
import { applyCommand, matchClientView, startMatch } from '../../game/match.js';
import { mulberry32 } from '../../game/rng.js';
import type { GroupLevel, SoloPuzzle } from '../../game/solo.js';
import {
  ClientEvent,
  ERROR_CODES,
  ServerEvent,
  ackSchema,
  guestLoginSchema,
  matchEndedSchema,
  matchEventSchema,
  matchFoundSchema,
  matchSubmitSchema,
  matchViewSchema,
  queueJoinSchema,
  sessionSchema,
} from '../events.js';

const uuid = '0190a0c0-1234-7abc-8def-0123456789ab';
const puzzle: SoloPuzzle = { groups: ([0, 1, 2, 3] as GroupLevel[]).map((level) => ({ level, productIds: [0, 1, 2, 3].map((i) => `g${level}p${i}`) })) };

describe('event names', () => {
  it('are unique and follow domain:action', () => {
    const names = [...Object.values(ClientEvent), ...Object.values(ServerEvent)];
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n === 'error' || /^[a-z]+:[a-z]+$/.test(n)).toBe(true);
  });

  it('error codes are unique upper snake case', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    for (const c of ERROR_CODES) expect(c).toMatch(/^[A-Z_]+$/);
  });
});

describe('client payloads', () => {
  it('validates queue:join and match:submit', () => {
    expect(queueJoinSchema.safeParse({ mode: 'duel' }).success).toBe(true);
    expect(queueJoinSchema.safeParse({ mode: 'team' }).success).toBe(false);
    expect(matchSubmitSchema.safeParse({ itemIds: ['a', 'b', 'c', 'd'] }).success).toBe(true);
    for (const itemIds of [['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', ''], 'abcd']) {
      expect(matchSubmitSchema.safeParse({ itemIds }).success).toBe(false);
    }
  });

  it('acks are ok or an error code', () => {
    expect(ackSchema.safeParse({ ok: true }).success).toBe(true);
    expect(ackSchema.safeParse({ ok: false, error: 'NOT_YOUR_TURN' }).success).toBe(true);
    expect(ackSchema.safeParse({ ok: false, error: 'free text' }).success).toBe(false);
    expect(ackSchema.safeParse({ ok: false }).success).toBe(false);
  });

  it('checks the guest login device id', () => {
    expect(guestLoginSchema.safeParse({ deviceId: '0f8fad5b-d9cb-469f-a165-70867728950e' }).success).toBe(true);
    expect(guestLoginSchema.safeParse({ deviceId: 'nope' }).success).toBe(false);
    expect(sessionSchema.safeParse({ token: 't', user: { id: uuid, nickname: 'n', avatarKey: 'avatar-01' } }).success).toBe(true);
  });
});

describe('server payloads', () => {
  const profile = (side: 0 | 1) => ({ side, nickname: 'سارا', avatarKey: 'avatar-03', level: 4, coins: 120 });

  it('match:found carries two public profiles and no bot flag', () => {
    const found = { matchId: uuid, you: 0, players: [profile(0), profile(1)] };
    expect(matchFoundSchema.safeParse(found).success).toBe(true);
    expect(JSON.stringify(Object.keys(profile(0)))).not.toMatch(/bot/i);
  });

  it('accepts a real reducer snapshot once names are attached, and cannot carry an unsolved group', () => {
    let s = startMatch(puzzle, ['u0', 'u1'], mulberry32(1), 1000, 0);
    const r = applyCommand(s, { t: 'submit', by: 'u0', itemIds: puzzle.groups[2]!.productIds as string[] }, { now: 2000 });
    if ('error' in r) throw new Error(r.error);
    s = r.state;
    const view = matchClientView(s, 'u0')!;
    const wire = {
      matchId: uuid,
      you: view.you,
      cards: view.cards.map((id) => ({ id, nameFa: `کالا ${id}`, unitFa: null })),
      solved: view.solved.map((g) => ({ ...g, titleFa: 'عنوان', explanationFa: 'توضیح', productIds: [...g.productIds] })),
      scores: view.scores,
      mistakes: view.mistakes,
      lockedOut: view.lockedOut,
      turn: view.turn,
      turnId: view.turnId,
      turnEndsAt: view.turnEndsAt,
      status: view.status,
      result: view.result,
    };
    const parsed = matchViewSchema.parse(wire);
    expect(parsed.cards).toHaveLength(12);
    // zod strips unknown keys: smuggling a solution field does not survive parsing
    expect(matchViewSchema.parse({ ...wire, groups: puzzle.groups })).not.toHaveProperty('groups');
  });

  it('accepts every reducer event shape', () => {
    const events = [
      { t: 'guess', side: 0, itemIds: ['a', 'b', 'c', 'd'], outcome: 'one_away' },
      { t: 'group_solved', side: 1, level: 2, points: 4, firstBlood: true },
      { t: 'group_revealed', level: 0 },
      { t: 'locked_out', side: 0 },
      { t: 'timeout', side: 1 },
      { t: 'turn', side: 0, turnId: 3 },
      { t: 'finished', result: { winner: null, reason: 'solved' } },
    ];
    for (const e of events) expect(matchEventSchema.safeParse(e).success).toBe(true);
    expect(matchEventSchema.safeParse({ t: 'guess', side: 2, itemIds: [], outcome: 'wrong' }).success).toBe(false);
  });

  it('match:ended carries the full solution only as four groups', () => {
    const groups = [0, 1, 2, 3].map((level) => ({ level, titleFa: 't', explanationFa: 'e', productIds: ['a', 'b', 'c', 'd'] }));
    expect(matchEndedSchema.safeParse({ matchId: uuid, result: { winner: 0, reason: 'solved' }, scores: [5, 3], groups }).success).toBe(true);
    expect(matchEndedSchema.safeParse({ matchId: uuid, result: { winner: 0, reason: 'solved' }, scores: [5, 3], groups: groups.slice(1) }).success).toBe(false);
  });
});
