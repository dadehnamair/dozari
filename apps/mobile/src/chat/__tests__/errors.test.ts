import { describe, expect, it } from 'vitest';
import { chatErrorText, mergeMessages } from '../errors';

describe('chat helpers', () => {
  it('maps error codes, with a fallback', () => {
    expect(chatErrorText('MUTED')).toContain('ساکت');
    expect(chatErrorText('CONTACT_BLOCKED')).toContain('شماره');
    expect(chatErrorText('???')).toBe('پیام فرستاده نشد.');
  });
  it('merges by id, oldest first, capped', () => {
    const a = [{ id: '1', createdAt: 1 }, { id: '2', createdAt: 2 }];
    const b = [{ id: '2', createdAt: 2 }, { id: '3', createdAt: 3 }];
    expect(mergeMessages(a, b).map((m) => m.id)).toEqual(['1', '2', '3']);
    expect(mergeMessages(a, b, 2).map((m) => m.id)).toEqual(['2', '3']);
  });
});
