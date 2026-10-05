import { z } from 'zod';

/** One word-lesson card (kid track): the item's word, a one-line story and an optional syllable split. Letters are computed in the app. */
export const lessonCardSchema = z.object({
  productId: z.string().min(1),
  wordFa: z.string().min(1).max(60),
  storyFa: z.string().max(300),
  syllablesFa: z.string().max(80).nullable(),
});
export type LessonCard = z.infer<typeof lessonCardSchema>;

/** `POST /lessons` — the cards for these items (only approved lessons come back; missing ones are skipped). */
export const lessonsRequestSchema = z.object({ productIds: z.array(z.string().min(1)).min(1).max(16) });
export const lessonsResponseSchema = z.object({ lessons: z.array(lessonCardSchema) });
export type LessonsResponse = z.infer<typeof lessonsResponseSchema>;

export const LESSON_STATUSES = ['draft', 'approved'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];
