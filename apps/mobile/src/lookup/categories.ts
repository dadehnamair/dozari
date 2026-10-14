import { useEffect, useState } from 'react';
import { PRODUCT_CATEGORIES } from '@dozari/shared';
import { callJson } from '../net/http';
import { fa } from '../i18n/fa';

export type CategoryOption = readonly [slug: string, label: string];

const BUILT_IN: CategoryOption[] = PRODUCT_CATEGORIES.map((c) => [c, fa.lookup.categories[c] ?? c] as const);
let cached: CategoryOption[] | null = null;

/** The product categories the admin defined (name and order included); the built-in list until the server answers or when it cannot. */
export function useProductCategories(): CategoryOption[] {
  const [list, setList] = useState<CategoryOption[]>(cached ?? BUILT_IN);
  useEffect(() => {
    if (cached) return;
    let live = true;
    callJson('/lookup/categories', 'GET')
      .then((r) => {
        const rows = (r as { categories?: { slug?: unknown; nameFa?: unknown }[] }).categories;
        const next = (rows ?? []).filter((c) => typeof c.slug === 'string' && typeof c.nameFa === 'string').map((c) => [c.slug as string, c.nameFa as string] as const);
        if (next.length === 0) return;
        cached = next;
        if (live) setList(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return list;
}
