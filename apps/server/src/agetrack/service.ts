import type { FastifyInstance } from 'fastify';
import { ageTrackPutSchema, canSelfSwitchTrack, parseAgeTrack, trackRules } from '@dozari/shared';
import type { AgeTrack, TrackRules } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';

export interface TrackRecord {
  track: AgeTrack;
  /** When the player picked a track; null = never asked. */
  setAt: Date | null;
}

/** I/O boundary of age tracks: the chosen track lives on `users`. */
export interface AgeTrackStore {
  get(userId: string): Promise<TrackRecord>;
  getMany(ids: readonly string[]): Promise<Map<string, AgeTrack>>;
  save(userId: string, track: AgeTrack, at: Date): Promise<void>;
}

export interface MyAgeTrack {
  /** False while the `feature.age_tracks` switch is off: the app shows no chooser and everyone plays the adult game. */
  enabled: boolean;
  track: AgeTrack;
  /** The first-run chooser has been answered (always true when the feature is off). */
  chosen: boolean;
  rules: TrackRules;
}

export type ChooseResult = { ok: true; mine: MyAgeTrack } | { ok: false; error: 'feature_off' | 'needs_guardian' };

export class AgeTrackService {
  constructor(
    private readonly store: AgeTrackStore,
    private readonly enabled: () => Promise<boolean>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async mine(userId: string): Promise<MyAgeTrack> {
    if (!(await this.enabled())) return { enabled: false, track: 'adult', chosen: true, rules: trackRules('adult') };
    const rec = await this.store.get(userId);
    return { enabled: true, track: rec.track, chosen: rec.setAt !== null, rules: trackRules(rec.track) };
  }

  /**
   * The effective track used by queues and content: the stored one when the feature is on, else adult.
   * Never throws; a lookup failure reads as adult (the safest default for the adult game, the strictest rows are only ever set explicitly).
   */
  async effective(userId: string): Promise<AgeTrack> {
    if (!(await this.enabled())) return 'adult';
    return parseAgeTrack((await this.store.get(userId)).track);
  }

  /**
   * First pick: any track. Later: the same or a younger track is free; an older one needs a guardian (phase 2), so it is refused here.
   */
  async choose(userId: string, track: AgeTrack): Promise<ChooseResult> {
    if (!(await this.enabled())) return { ok: false, error: 'feature_off' };
    const rec = await this.store.get(userId);
    if (rec.setAt !== null && !canSelfSwitchTrack(rec.track, track)) return { ok: false, error: 'needs_guardian' };
    await this.store.save(userId, track, this.now());
    return { ok: true, mine: await this.mine(userId) };
  }
}

export function registerAgeTrackRoutes(app: FastifyInstance, auth: AuthService, tracks: AgeTrackService) {
  app.get('/me/age-track', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return tracks.mine(user.id);
  });

  app.put('/me/age-track', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = ageTrackPutSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await tracks.choose(user.id, body.data.track);
    if (out.ok) return out.mine;
    return reply.code(out.error === 'feature_off' ? 503 : 403).send({ error: out.error });
  });
}
