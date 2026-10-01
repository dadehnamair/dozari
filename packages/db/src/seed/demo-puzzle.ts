import { eq, like } from 'drizzle-orm';
import { createDb } from '../client.js';
import { pricePoints, products, puzzleGroupItems, puzzleGroups, puzzles } from '../schema.js';

/**
 * DEV ONLY: one playable puzzle built from clearly fake products (`demo-*`, hidden from the catalog
 * via is_active = false) so the solo screen can be tried before real puzzles exist. The prices are
 * invented and must never be used as real data. `--remove` deletes everything this script created.
 */
const GROUPS = [
  { title: 'نمونه ۱: خوراکی', note: 'demo', items: ['نان نمونه', 'پنیر نمونه', 'دوغ نمونه', 'ماست نمونه'] },
  { title: 'نمونه ۲: وسیله', note: 'demo', items: ['خودکار نمونه', 'دفتر نمونه', 'مداد نمونه', 'پاک‌کن نمونه'] },
  { title: 'نمونه ۳: پوشاک', note: 'demo', items: ['کفش نمونه', 'کلاه نمونه', 'جوراب نمونه', 'کیف نمونه'] },
  { title: 'نمونه ۴: سرگرمی', note: 'demo', items: ['توپ نمونه', 'عروسک نمونه', 'بازی نمونه', 'کتاب نمونه'] },
] as const;

const db = createDb();

if (process.argv.includes('--remove')) {
  const demo = await db.select({ id: products.id }).from(products).where(like(products.slug, 'demo-%'));
  const demoIds = new Set(demo.map((d) => d.id));
  const items = await db.select({ puzzleId: puzzleGroupItems.puzzleId, productId: puzzleGroupItems.productId }).from(puzzleGroupItems);
  const puzzleIds = new Set(items.filter((i) => demoIds.has(i.productId)).map((i) => i.puzzleId));
  for (const id of puzzleIds) await db.delete(puzzles).where(eq(puzzles.id, id));
  await db.delete(products).where(like(products.slug, 'demo-%'));
  console.log(`removed ${puzzleIds.size} demo puzzle(s) and ${demo.length} demo products`);
  process.exit(0);
}

const existing = await db.select({ id: products.id }).from(products).where(like(products.slug, 'demo-%')).limit(1);
if (existing.length > 0) {
  console.log('demo data already present (use --remove first to recreate)');
  process.exit(0);
}

const [puzzle] = await db.insert(puzzles).values({ status: 'approved', source: 'curated' }).$returningId();
if (!puzzle) throw new Error('puzzle insert failed');

let n = 0;
for (const [level, g] of GROUPS.entries()) {
  const [group] = await db
    .insert(puzzleGroups)
    .values({ puzzleId: puzzle.id, level, titleFa: g.title, explanationFa: 'داده‌ی نمونه برای آزمایش؛ قیمت‌ها ساختگی است', ruleKind: 'curated', ruleNote: g.note })
    .$returningId();
  if (!group) throw new Error('group insert failed');
  for (const name of g.items) {
    n += 1;
    const [product] = await db
      .insert(products)
      .values({ slug: `demo-${n}`, nameFa: name, category: 'other', isActive: false })
      .$returningId();
    if (!product) throw new Error('product insert failed');
    await db.insert(pricePoints).values([
      { productId: product.id, year: 1370, priceRials: BigInt(n * 100), sourceType: 'other', sourceNote: 'DEMO — fabricated, dev only', confidence: 1, status: 'approved' },
      { productId: product.id, year: 1385, priceRials: BigInt(n * 5_000), sourceType: 'other', sourceNote: 'DEMO — fabricated, dev only', confidence: 1, status: 'approved' },
      { productId: product.id, year: 1400, priceRials: BigInt(n * 120_000), sourceType: 'other', sourceNote: 'DEMO — fabricated, dev only', confidence: 1, status: 'approved' },
    ]);
    await db.insert(puzzleGroupItems).values({ groupId: group.id, puzzleId: puzzle.id, productId: product.id });
  }
}
console.log('demo puzzle created (fake data, dev only). Remove with: pnpm --filter @dozari/db demo:puzzle:remove');
process.exit(0);
