import type { Gender } from '@dozari/shared';

/** Which hero character to draw (D68): the female hero for «female», the original one otherwise (default while unset). */
export const heroFor = (gender: Gender | null | undefined): 'dozari' | 'dozariF' => (gender === 'female' ? 'dozariF' : 'dozari');
