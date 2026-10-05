import type { FastifyInstance } from 'fastify';
import { lessonsRequestSchema } from '@dozari/shared';
import type { LessonCard, LessonStatus } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';

export interface LessonInput {
  wordFa: string;
  storyFa: string;
  syllablesFa: string | null;
}

/** One row of the admin lesson editor: a kid item with its lesson, or none yet. */
export interface AdminLessonRow {
  productId: string;
  nameFa: string;
  iconKey: string | null;
  lesson: (LessonInput & { status: LessonStatus; reviewedAt: number | null }) | null;
}

/** I/O boundary of word lessons (docs/logic/age-tracks.md §Kid word lesson). */
export interface LessonStore {
  /** Approved lessons for these items; items without one are skipped. */
  approvedFor(productIds: readonly string[]): Promise<LessonCard[]>;
  /** Every item of the kid track with its lesson (or null), for the editor. */
  listKidItems(status?: LessonStatus | 'missing'): Promise<AdminLessonRow[]>;
  /** Writes the text and puts the lesson back to draft (an edited text must be reviewed again). False when the item is unknown. */
  save(productId: string, input: LessonInput): Promise<boolean>;
  /** Approve or send back to draft. 'not_found' when there is no lesson. */
  setStatus(productId: string, status: LessonStatus, reviewer: string | null): Promise<'ok' | 'not_found'>;
}

export function registerLessonRoutes(app: FastifyInstance, auth: AuthService, store: LessonStore) {
  app.post('/lessons', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = lessonsRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    return { lessons: await store.approvedFor(body.data.productIds) };
  });
}
