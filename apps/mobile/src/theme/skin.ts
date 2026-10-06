import { useTheme } from './themeStore';

/** Dark panels of the adult look («صرافی و گاوصندوق»): near-black panel, gold frame, cream-gold text (docs/design/CLAUDE.md). */
export const DARK = {
  panel: '#17100C',
  raised: '#24170F',
  field: '#0E0A08',
  frame: '#E8B64A',
  text: '#FFE9A8',
  sub: 'rgba(255,233,168,0.72)',
  line: 'rgba(232,182,74,0.28)',
} as const;

/** True in the adult look: sheets and pages paint dark panels with light text instead of cream with ink. */
export function useDark(): boolean {
  return useTheme() === 'adult';
}
