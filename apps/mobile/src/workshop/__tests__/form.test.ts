import { describe, expect, it } from 'vitest';
import { distinctOptions, draftToSubmit, emptyDraft } from '../form';

const TOPIC = '00000000-0000-7000-d000-000000000001';
const good = { ...emptyDraft(), topicId: TOPIC, text: 'پایتخت ایران کدام شهر است؟', options: ['تهران', 'شیراز', 'اصفهان', 'تبریز'] as [string, string, string, string], correct: 0 };

describe('workshop form', () => {
  it('turns a complete draft into the server\'s shape', () => {
    expect(draftToSubmit(good)).toEqual({ topicId: TOPIC, textFa: 'پایتخت ایران کدام شهر است؟', options: ['تهران', 'شیراز', 'اصفهان', 'تبریز'], correctIndex: 0, explanationFa: '', difficulty: 2 });
  });
  it('stays null until a topic, a right answer, a real question and four different choices exist', () => {
    expect(draftToSubmit(emptyDraft())).toBeNull();
    expect(draftToSubmit({ ...good, topicId: null })).toBeNull();
    expect(draftToSubmit({ ...good, correct: null })).toBeNull();
    expect(draftToSubmit({ ...good, text: 'ابج' })).toBeNull();
    expect(draftToSubmit({ ...good, options: ['تهران', 'تهران ', 'اصفهان', 'تبریز'] })).toBeNull();
    expect(draftToSubmit({ ...good, options: ['تهران', '', 'اصفهان', 'تبریز'] })).toBeNull();
  });
  it('counts distinct filled choices', () => {
    expect(distinctOptions(['الف', 'ب', '', 'ب'])).toBe(2);
  });
});
