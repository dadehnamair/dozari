import { AVATARS } from '../kit/data';
import type { AvatarSpec } from '../kit/data';

/** The kit avatar for a stored `avatarKey`; an unknown key falls back to the first one. */
export const avatarOf = (key: string): AvatarSpec => AVATARS.find((a) => a.key === key) ?? (AVATARS[0] as AvatarSpec);
