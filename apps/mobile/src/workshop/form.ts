import { normalizeFa, workshopSubmitSchema } from '@dozari/shared';
import type { WorkshopSubmit } from '@dozari/shared';

/** The question form as typed. */
export interface Draft {
  topicId: string | null;
  text: string;
  options: [string, string, string, string];
  correct: number | null;
  explanation: string;
  /** 1 easy · 2 medium · 3 hard. */
  difficulty: 1 | 2 | 3;
}

export const emptyDraft = (): Draft => ({ topicId: null, text: '', options: ['', '', '', ''], correct: null, explanation: '', difficulty: 2 });

/** The question to send, or null while the form is not complete and valid (the same schema the server uses). */
export function draftToSubmit(d: Draft): WorkshopSubmit | null {
  if (!d.topicId || d.correct === null) return null;
  const parsed = workshopSubmitSchema.safeParse({ topicId: d.topicId, textFa: d.text.trim(), options: d.options.map((o) => o.trim()), correctIndex: d.correct, explanationFa: d.explanation.trim(), difficulty: d.difficulty });
  return parsed.success ? parsed.data : null;
}

/** How many of the four choices are filled in and different from each other (to guide the author). */
export function distinctOptions(options: readonly string[]): number {
  return new Set(options.map((o) => normalizeFa(o)).filter(Boolean)).size;
}
