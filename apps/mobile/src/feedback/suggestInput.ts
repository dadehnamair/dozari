import { expandYear, submissionInputSchema } from '@dozari/shared';
import type { SubmissionInput, SubmissionKind } from '@dozari/shared';

export interface SuggestFields {
  kind: SubmissionKind;
  productId?: string;
  nameFa: string;
  category: string | null;
  year: string;
  price: string;
  unit: 'toman' | 'rial';
  source: 'user_memory' | 'website';
  sourceText: string;
  note: string;
}

/** Persian / Arabic / Latin digits (and separators) typed in a field → a whole number, or null. */
export function typedWhole(text: string): number | null {
  const ascii = text
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[,،٬\s]/g, '');
  return /^\d{1,14}$/.test(ascii) ? Number(ascii) : null;
}

/** What the form typed as a request body; null while it would not pass the server's checks. */
export function buildSubmission(f: SuggestFields): SubmissionInput | null {
  const year = f.year.trim() ? expandYear(typedWhole(f.year) ?? -1) : null;
  const price = f.price.trim() ? typedWhole(f.price) : null;
  if (f.year.trim() && year === null) return null;
  if (f.price.trim() && (price === null || price <= 0)) return null;
  const parsed = submissionInputSchema.safeParse({
    kind: f.kind,
    productId: f.productId,
    nameFa: f.nameFa.trim() || undefined,
    category: f.category ?? undefined,
    year: year ?? undefined,
    price: price ?? undefined,
    unit: f.unit,
    sourceType: f.source,
    sourceText: f.sourceText.trim(),
    note: f.note.trim(),
  });
  return parsed.success ? parsed.data : null;
}
