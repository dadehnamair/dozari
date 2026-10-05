import { z } from 'zod';

/** Field limits shared by the admin form, the server validation and the app. */
export const SPONSOR_LIMITS = { name: 60, tagline: 120, description: 1000, url: 300 } as const;

/** A public https link (banner, logo, website). Anything else is rejected so the app never opens or loads odd schemes. */
export const isHttpsUrl = (v: string): boolean => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};
export const httpsUrlSchema = z.string().trim().max(SPONSOR_LIMITS.url).refine(isHttpsUrl, 'https_only');

/** `#RRGGBB` accent colour of a sponsor card. */
export const accentColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** What the app shows for a tournament's sponsor (list rows get the short form, the tournament page the full one). */
export const sponsorSchema = z.object({
  id: z.string().uuid(),
  nameFa: z.string(),
  taglineFa: z.string(),
  descriptionFa: z.string(),
  bannerUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  linkUrl: z.string().nullable(),
  accent: z.string().nullable(),
});
export type Sponsor = z.infer<typeof sponsorSchema>;

/** The short form on a list row. */
export const sponsorBriefSchema = sponsorSchema.pick({ id: true, nameFa: true, logoUrl: true });
export type SponsorBrief = z.infer<typeof sponsorBriefSchema>;
