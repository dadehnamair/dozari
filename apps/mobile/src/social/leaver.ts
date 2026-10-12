import { jalaliDateInTehran, toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';

/** «تا ۲۸ مهر برداشته می‌شود» — the day the leaver badge comes off, in Solar Hijri (Tehran). */
export const leaverUntilText = (untilMs: number): string => {
  const d = jalaliDateInTehran(untilMs);
  return fa.leave.until(`${toPersianDigits(String(d.day))} ${fa.months[d.month - 1]?.name ?? ''}`);
};
