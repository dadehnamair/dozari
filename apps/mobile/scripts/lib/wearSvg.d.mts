export const SLOTS: readonly string[];
export const VIEW_BOX: string;
export interface SvgEl { name: string; attrs: Record<string, string>; children: SvgEl[] }
export function parseFileName(file: string): { key: string; layer: 'front' | 'back' };
export function parseSvg(src: string, file?: string): SvgEl;
export function validateSvg(svg: SvgEl, file?: string): string[];
export function svgToJsx(svg: SvgEl, pad?: string): string;
export function buildWear(files: { slot: string; name: string; src: string }[]): { errors: string[] } | { art: string; slots: string; keys: string[]; errors?: undefined };
