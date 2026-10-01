import type { NicknameRules } from '@dozari/shared';
import { fa } from '../i18n/fa';

/** The nickname rules in force, as short Persian phrases (shown under the name field). */
export function nicknameHint(rules: NicknameRules): string {
  const r = fa.profile.nicknameRule;
  const parts = [r.length(rules.minLen, rules.maxLen)];
  if (!rules.allowDigits) parts.push(r.noDigits);
  if (!rules.allowLatin) parts.push(r.noLatin);
  if (!rules.allowPersian) parts.push(r.noPersian);
  return parts.join('، ');
}
