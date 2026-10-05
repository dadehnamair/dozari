import type { FastifyInstance } from 'fastify';
import { ageTrackPutSchema, canMeet, canSelfSwitchTrack, parseAgeTrack, trackRules } from '@dozari/shared';
import { trackFeatureKey } from '@dozari/shared';
import type { BooleanTrackRule, TrackFeature } from '@dozari/shared';
import type { AgeTrack, ChildLimits, TrackRules } from '@dozari/shared';
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
  /** What the guardian chose for this child (kid/teen with a guardian), so the app can hide features and show the soft rest card; null for everybody else. */
  limits: ChildLimits | null;
}

/** Which of `others` may `me` meet (friends, search, profiles, rankings)? Everybody reads as adult while the feature is off, so all may. */
export type Meetable = (me: string, others: readonly string[]) => Promise<Set<string>>;

/** True = this player may not use social features yet (needs a guardian). */
export type SocialBlocked = (userId: string) => Promise<boolean>;

export type ChooseResult = { ok: true; mine: MyAgeTrack } | { ok: false; error: 'feature_off' | 'needs_guardian' };

export class AgeTrackService {
  /** Reads an on/off admin switch (`track.kid.chat` …); set at start-up. Absent = every switch is on. */
  featureSwitch?: (key: string) => Promise<boolean>;
  /** Writes a row to the audit log (every band change is recorded, docs/logic/age-tracks.md §Admin panel); set at start-up, best effort. */
  audit?: (action: string, target: string, detail?: string) => void;

  constructor(
    private readonly store: AgeTrackStore,
    private readonly enabled: () => Promise<boolean>,
    private readonly now: () => Date = () => new Date(),
    /** Whether a child has a linked guardian (phase 2); absent = nobody does, so a kid/teen stays gated. */
    private readonly hasGuardian: (userId: string) => Promise<boolean> = async () => false,
    /** The guardian's choices for a child, or null when there is no guardian or no row. */
    private readonly limitsOf: (userId: string) => Promise<ChildLimits | null> = async () => null,
  ) {}

  async mine(userId: string): Promise<MyAgeTrack> {
    if (!(await this.enabled())) return { enabled: false, track: 'adult', chosen: true, rules: trackRules('adult'), limits: null };
    const rec = await this.store.get(userId);
    const rules = trackRules(rec.track);
    return { enabled: true, track: rec.track, chosen: rec.setAt !== null, rules, limits: rules.socialNeedsGuardian ? await this.limitsOf(userId) : null };
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
   * True when `userId` is a kid/teen who has no linked guardian yet: friends, requests, tables and friend duels are closed until the one-step
   * guardian screen is done (docs/logic/age-tracks.md §First-run flow). Never true while the feature is off, and never for adults.
   */
  async socialBlocked(userId: string): Promise<boolean> {
    if (!(await this.enabled())) return false;
    const track = parseAgeTrack((await this.store.get(userId)).track);
    return trackRules(track).socialNeedsGuardian && !(await this.hasGuardian(userId));
  }

  /** May this player use what a yes/no track rule guards (coin wagers, real-money buying, tournaments…)? Everybody may while the feature is off; a failing lookup reads as the track's narrower answer only through `effective`, which is adult. */
  async allows(userId: string, rule: BooleanTrackRule): Promise<boolean> {
    return trackRules(await this.effective(userId))[rule];
  }

  /** Has the admin switched this feature off for the player's whole track (kid or teen)? Never for adults, and never while the age-track feature is off. */
  async featureOff(userId: string, feature: TrackFeature): Promise<boolean> {
    if (!this.featureSwitch || !(await this.enabled())) return false;
    const track = await this.effective(userId);
    if (track === 'adult') return false;
    try {
      return !(await this.featureSwitch(trackFeatureKey(track, feature)));
    } catch {
      return false; // a failing lookup never locks a feature
    }
  }

  /** How much of this player's public profile other players may see (`trackRules.publicProfile`). */
  async profileDepth(userId: string): Promise<'basic' | 'stats' | 'full'> {
    return trackRules(await this.effective(userId)).publicProfile;
  }

  /** The guardian switched friend duels and tables off for this child. */
  async duelsOff(userId: string): Promise<boolean> {
    return (await this.limits(userId))?.duelsEnabled === false;
  }

  /** The guardian wants to approve this child's friends first (`friend_approval = ask`). */
  async friendsNeedApproval(userId: string): Promise<boolean> {
    return (await this.limits(userId))?.friendApproval === 'ask';
  }

  /** The guardian's limits for a kid/teen who has a guardian, else null (adults and unlinked children have none). Never throws. */
  async limits(userId: string): Promise<ChildLimits | null> {
    if (!(await this.enabled())) return null;
    try {
      if (!trackRules(parseAgeTrack((await this.store.get(userId)).track)).socialNeedsGuardian) return null;
      return await this.limitsOf(userId);
    } catch {
      return null;
    }
  }

  /** The subset of `others` on the same track as `me` (`canMeet`); with the feature off every id passes. */
  async meetable(me: string, others: readonly string[]): Promise<Set<string>> {
    if (!(await this.enabled())) return new Set(others);
    const tracks = await this.store.getMany([me, ...others]);
    const mine = parseAgeTrack(tracks.get(me));
    return new Set(others.filter((id) => canMeet(mine, parseAgeTrack(tracks.get(id)))));
  }

  /**
   * First pick: any track. Later: the same or a younger track is free; an older one needs a guardian (phase 2), so it is refused here.
   */
  async choose(userId: string, track: AgeTrack): Promise<ChooseResult> {
    if (!(await this.enabled())) return { ok: false, error: 'feature_off' };
    const rec = await this.store.get(userId);
    if (rec.setAt !== null && !canSelfSwitchTrack(rec.track, track)) return { ok: false, error: 'needs_guardian' };
    await this.store.save(userId, track, this.now());
    this.audit?.('age_track.choose', userId, `${rec.setAt === null ? 'first' : rec.track}->${track}`);
    return { ok: true, mine: await this.mine(userId) };
  }
}

export function registerAgeTrackRoutes(app: FastifyInstance, auth: AuthService, tracks: AgeTrackService, playTime?: { beat(userId: string): Promise<{ today: number; counted: boolean }> }) {
  // The open app reports once a minute; the minutes feed the guardian's play reminder and digest (a child's own app only).
  app.post('/me/heartbeat', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return playTime ? playTime.beat(user.id) : { today: 0, counted: false };
  });

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
