import { describe, expect, it } from 'vitest';
import { noticeNotification } from '../noticeText';

describe('noticeNotification', () => {
  it('names the sender of a friend request', () => {
    expect(noticeNotification({ kind: 'friend_request', from: 'علی' })?.body).toContain('علی');
  });
  it('tags table invites by code so two invites do not replace each other', () => {
    expect(noticeNotification({ kind: 'table_invite', from: 'علی', code: 'A1' })?.tag).not.toBe(noticeNotification({ kind: 'table_invite', from: 'علی', code: 'B2' })?.tag);
  });
  it('words a refused table request', () => {
    expect(noticeNotification({ kind: 'table_answer', accepted: false })?.body).toMatch(/پذیرفته نشد/);
  });
});
