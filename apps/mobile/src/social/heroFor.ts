import type { Gender } from '@dozari/shared';
import { CHARACTER_AVATARS } from '../kit/data';
import type { CharacterId } from '../theme/character';

/** Which hero character to draw (D68): the female hero for «female», the original one otherwise (default while unset). */
export const heroFor = (gender: Gender | null | undefined): 'dozari' | 'dozariF' => (gender === 'female' ? 'dozariF' : 'dozari');

/** The home hero: a picked cast avatar (`char-<id>`) wins over the gender default, so changing the profile character changes the home one too. */
export const heroOf = (gender: Gender | null | undefined, avatarKey: string | null | undefined): CharacterId =>
  (avatarKey ? CHARACTER_AVATARS.find((a) => a.key === avatarKey)?.who : undefined) ?? heroFor(gender);
