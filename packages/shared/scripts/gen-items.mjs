// Rebuilds packages/shared/src/items/{data,groups}.ts from the design files, so the icon pack never drifts:
//   node packages/shared/scripts/gen-items.mjs        (run after the designer updates docs/design/Item.dc.html, 12 or docs/design/products/*)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const design = (n) => readFileSync(join(root, 'docs/design', n), 'utf8');
const out = join(root, 'packages/shared/src/items');

const item = design('Item.dc.html');
const start = item.indexOf('/* part:');
const end = item.indexOf('class Component', start);
if (start < 0 || end < 0) throw new Error('Item.dc.html layout changed');
let body = item.slice(start, end);
body = body.replace(/^\/\*.*\*\/\n/, '').replace('const I={', 'export const ITEMS: Record<string, Icon> = {').replace(/\};\s*$/, '};\n');

// Products v2 (docs/design/products/ProductIcon.dc.html): `const N={slug: icon}` are new hand-drawn product icons, keyed by product slug.
// They reuse the O/E/R helpers and colour consts of Item.dc.html and add their own builders (CAR, BX, MB, BT, PERF), kept as source text.
const pi = readFileSync(join(root, 'docs/design/products/ProductIcon.dc.html'), 'utf8');
const nStart = pi.indexOf('const N={');
const nEnd = pi.indexOf('\n};', nStart);
if (nStart < 0 || nEnd < 0) throw new Error('ProductIcon.dc.html layout changed');
// Name clashes with Item.dc.html: CAR/CB have another signature there, and ProductIcon's orange is brighter (#FF7A3D vs #E8743B).
const clash = (t) => t.replace(/\bCAR=/g, 'PCAR=').replace(/\bCAR\(/g, 'PCAR(').replace(/\bCB\b/g, 'PCB').replace(/\bOR\b/g, 'POR');
const nBody = clash(pi.slice(nStart + 'const N={'.length, nEnd).replace(/^\n/, ''));
const builders = clash(pi.slice(pi.indexOf('const CB={'), nStart)).replace(/^const PCAR=\(c,t,post=\[\]\)/m, 'const PCAR=(c,t,post=[])');
const productConsts = "const POR='#FF7A3D',SV='#D9DEE3',GL='#EAF8FF';\n";
const newKeys = [...nBody.matchAll(/^'([^']+)':/gm)].map((m) => m[1]);
body = body.replace(/\};\n$/, `${nBody.replace(/,?\s*$/, ',')}\n};\n`);
const consts = item.slice(item.indexOf('const O='), start).replace(/\(x,y,r\)/, '(x: number,y: number,r: number)').replace(/\(x,y,rx,ry\)/, '(x: number,y: number,rx: number,ry: number)').replace(/\(x,y,w,h,r\)/, '(x: number,y: number,w: number,h: number,r: number)');
// The designer's slug map lists some slugs twice (same value); a duplicate key in an object literal is a TS error.
const dedupeKeys = (m) => JSON.stringify(new Function(`return ${m}`)()).replace(/"/g, "'");
const typed = (t) =>
  t
  // builders added by the designer: type their parameters, and move the slug -> icon map out so it is exported, not unused
  .replace('const CB={', "const CB: Record<string, [string, string]>={")
  .replace('[...pre,[CB[t][0],c],[CB[t][1],', '[...pre,[CB[t]![0],c],[CB[t]![1],')
  .replace('const CAR=(c,t,pre=[],post=[])=>({p:', 'const CAR=(c: string,t: string,pre: Part[]=[],post: Part[]=[]): Icon=>({p: <Part[]>')
  .replace('const GRID=(x0,y0,nx,ny,dx,dy,w,h)=>', 'const GRID=(x0: number,y0: number,nx: number,ny: number,dx: number,dy: number,w: number,h: number)=>')
  .replace('const SEED=(x,y)=>', 'const SEED=(x: number,y: number)=>')
  .replace('const SEEDS=(c,ln)=>({p:', 'const SEEDS=(c: string,ln: string): Icon=>({p: <Part[]>')
  .replace('const BOTTLE=(c,lab,cap,txt,tc)=>({p:', 'const BOTTLE=(c: string,lab: string,cap: string,txt: string,tc: string): Icon=>({p: <Part[]>')
  .replace('const GLASS=(c,ex)=>({p:', 'const GLASS=(c: string,ex: Part[]): Icon=>({p: <Part[]>')
  .replace('const ARAQ=(liq,emb)=>({p:', 'const ARAQ=(liq: string,emb: Part[]): Icon=>({p: <Part[]>')
  .replace('const CAN=(c,b,ex)=>({p:', 'const CAN=(c: string,b: string,ex: Part[]): Icon=>({p: <Part[]>')
  .replace('const PH=(body,scr,ex)=>({p:', 'const PH=(body: string,scr: string,ex: Part[]): Icon=>({p: <Part[]>')
  .replace('const BOWL=(c,top,extra)=>({p:', 'const BOWL=(c: string,top: string,extra: Part[]): Icon=>({p:')
  .replace('const TIX=(c,ex)=>({p:', 'const TIX=(c: string,ex: Part[]): Icon=>({p:')
  .replace('const PCB={', "const PCB: Record<'sedan' | 'hatch' | 'van', [string, string]>={")
  .replace('const PCAR=(c,t,post=[])=>({p:', 'const PCAR=(c: string,t: keyof typeof PCB,post: Part[]=[]): Icon=>({p: <Part[]>')
  .replace('const BX=(c,top,side,t,tc,ex=[])=>({p:', 'const BX=(c: string,top: string,side: string,t: string,tc: string,ex: Part[]=[]): Icon=>({p: <Part[]>')
  .replace('const MB=(c,cap,t,tc)=>({p:', 'const MB=(c: string,cap: string,t: string,tc: string): Icon=>({p:')
  .replace('const BT=(c,cap,lab,t,tc)=>({p:', 'const BT=(c: string,cap: string,lab: string,t: string,tc: string): Icon=>({p:')
  .replace('const PC=(x,y,c)=>', 'const PC=(x: number,y: number,c: string): Part[]=><Part[]>')
  .replace('const TK=(c,t1,t2,ex=[])=>({p:', 'const TK=(c: string,t1: string,t2: string,ex: Part[]=[]): Icon=>({p: <Part[]>')
  .replace("let PERF='';", "let PERF = '';")
  .replace(/^const S=(\{.*\});$/m, (_, m) => `export const SAMPLE_ICONS: Record<string, string> = ${dedupeKeys(m)};`);
// A builder of the design file that no icon calls (the designer keeps some around) would be an unused const and fail the lint (max-warnings 0): drop
// each single-line arrow builder whose name occurs once, repeating because dropping one can leave a helper it used unused.
const pruneUnused = (t) => {
  for (;;) {
    const dead = [...t.matchAll(/^const (\w+)=\(.*\n/gm)].find((m) => (t.match(new RegExp(`\\b${m[1]}\\b`, 'g')) ?? []).length === 1);
    if (!dead) return t;
    t = t.replace(dead[0], '');
  }
};
// An entry is a literal `{p:[...]}` or a call of a builder of the design file (`CAR(...)`, `BOWL(...)`, `TIX(...)`).
const keys = [...body.matchAll(/^[ \t]*'?([A-Za-z0-9_-]+)'?:(?:\{p:|[A-Z]+\()/gm)].map((m) => m[1]);
writeFileSync(
  join(out, 'data.ts'),
  `/**
 * Item and product icons (docs/design/Item.dc.html): ${keys.length} hand-drawn icons on a 64 grid. GENERATED by scripts/gen-items.mjs, do not edit.
 * A part is [path, fill], [path, 'L', width, colour] (line), [path, fill, 'N'] (no outline) or [path, 'H'] (white highlight).
 */
export type Part = [string, string, (string | number)?, string?];
/** [x, y, size, text, colour] */
export type ItemText = [number, number, number, string, string];
type Icon = { p: Part[]; t?: ItemText[] };

${pruneUnused(typed(consts + productConsts + builders + body))}`,
);

/** Categories and Persian names come from design 12 (items) and 14 (products). */
const groups = [];
const d12 = design('Dozari - 12 Item Icons.dc.html');
const cats = new Function(`${d12.slice(d12.indexOf('const CATS='), d12.indexOf('class Component'))}; return CATS;`)();
for (const [t, c, list] of cats) groups.push({ id: `item-${groups.length}`, titleFa: t, color: c, icons: list.map(([k, fa]) => ({ key: k, fa })) });
const d14 = design('products/Dozari Products v1.dc.html');
const g14 = new Function(`${d14.slice(d14.indexOf('const G=['), d14.indexOf('class Component'))}; return G;`)();
for (const [t, c, s] of g14) groups.push({ id: `product-${groups.length}`, titleFa: t, color: c, icons: s.split(',').map((x) => { const [k, fa] = x.split(':'); return { key: k, fa }; }) });
// Design 14 also draws the sample catalogue's products (SAMPLES: product slug -> Persian name); Item.dc.html's `S` maps each slug to its icon key.
const slugIcon = new Function(`${item.slice(item.indexOf('const S='), item.indexOf('};', item.indexOf('const S=')) + 2)}; return S;`)();
const samples = new Function(`${d14.slice(d14.indexOf('const SAMPLES='), d14.indexOf('const G=['))}; return SAMPLES;`)();
for (const [t, c, list] of samples) {
  groups.push({ id: `sample-${groups.length}`, titleFa: t, color: c, icons: list.split(',').map((x) => { const [slug, fa] = x.split(':'); return { key: slugIcon[slug.replace(/^sample-/, '')], fa }; }).filter((i) => i.key) });
}
// Products v2: the icons drawn in ProductIcon.dc.html, named by products.json (slug -> name_fa), one category per kind of product.
const table = JSON.parse(readFileSync(join(root, 'docs/design/products/products.json'), 'utf8')).find((x) => x.type === 'table').data;
const nameFa = Object.fromEntries(table.map((r) => [r.slug, r.name_fa]));
// Products v3 (docs/design/products/Dozari Products v3.dc.html): its `NEW` list (slug|name) names the icons added after v2. Pushed before v2 so
// each icon lands in the newest pack that lists it (the dedupe below keeps the first).
const v3 = design('products/Dozari Products v3.dc.html');
const v3Start = v3.indexOf('const NEW=`');
if (v3Start >= 0) {
  const v3Names = v3.slice(v3Start + 'const NEW=`'.length, v3.indexOf('`', v3Start + 'const NEW=`'.length)).split('\n').map((l) => l.split('|'));
  groups.push({ id: 'product-v3', titleFa: 'محصولات ۳', color: '#8FDCFA', icons: v3Names.map(([k, fa]) => ({ key: k, fa })) });
}
groups.push({ id: 'product-v2', titleFa: 'محصولات ۲', color: '#B8F08F', icons: newKeys.map((k) => ({ key: k, fa: nameFa[k] ?? k })) });
// Products v4 (docs/design/products/Dozari Products v4.dc.html): `G` lists the newest pack in 7 groups (`OLD` marks the ones reused from earlier packs).
// Pushed first so each icon lands in the newest pack that lists it. Each key is a product slug; Item.dc.html's `S` maps it to its icon key (a slug with no drawing is dropped by the filter below).
const v4 = design('products/Dozari Products v4.dc.html');
const v4Start = v4.indexOf('const G=[');
if (v4Start >= 0) {
  const g4 = new Function(`${v4.slice(v4Start, v4.indexOf('class Component', v4Start))}; return G;`)();
  for (const [t, c, s] of g4) groups.unshift({ id: `v4-${groups.length}`, titleFa: t, color: c, icons: s.split(',').map((x) => { const [k, fa] = x.split(':'); return { key: slugIcon[k] ?? k, fa }; }) });
}

// The picker used to show all ~26 source groups as filters (overlapping, tiny, half of them "pack 2/3" dumps). Fold them into a few
// families. A family is chosen by the source group when that is unambiguous (SRC), else by the first rule matching the key or Persian name.
const FAMILIES = [
  ['money', 'پول و جایزه', '#FFC93C'],
  ['power', 'کمک و قدرت', '#3FC1F0'],
  ['fruit', 'میوه و سبزی', '#FF8FB6'],
  ['grocery', 'بقالی و نان', '#FFAA7A'],
  ['sweet', 'شیرینی و تنقلات', '#FFE48A'],
  ['meal', 'غذا', '#F5B97A'],
  ['drink', 'نوشیدنی', '#8FDCFA'],
  ['vehicle', 'خودرو و سفر', '#B8F08F'],
  ['tech', 'برقی و دیجیتال', '#C9A3FF'],
  ['tools', 'ابزار', '#D9C7A5'],
  ['home', 'خانه و بهداشت', '#9FE3C8'],
  ['wear', 'پوشاک و آرایش', '#F3A6D8'],
  ['fun', 'سرگرمی و تحصیل', '#FFB86B'],
];
const SRC = {
  'پول و گنجینه': 'money', 'جایزه و افتخار': 'money', 'کمک‌ها و قدرت‌ها': 'power', 'انرژی و زمان': 'power', 'نوستالژی': 'fun', 'سرگرمی و گل': 'fun',
  'اسباب‌بازی': 'fun', 'نوشت‌افزار': 'fun', 'خونه و آشپزخونه': 'home',
  // classified per icon by RULES (they mix kinds, or are the "pack 2/3" dumps); the value is only the fallback
  'میوه': 'fruit', 'آجیل و سبزیجات': 'fruit', 'بقالی': 'grocery', 'اجناس بازار': 'grocery', 'نان و بقالی': 'grocery', 'نون و شیرینی': 'sweet', 'تنقلات': 'sweet',
  'غذا و نوشیدنی': 'meal', 'غذا': 'meal', 'نوشیدنی': 'drink', 'حمل‌ونقل': 'vehicle', 'سفر و حمل‌ونقل': 'vehicle', 'خودرو': 'vehicle',
  'لوازم برقی و سرگرمی': 'tech', 'موبایل و لوازم جانبی': 'tech', 'کامپیوتر و الکترونیک': 'tech', 'پوشاک و زیورآلات': 'wear', 'پوشاک و بهداشت': 'wear',
  'خدمات، خانه و پول': 'home', 'ابزار': 'tools', 'میوه و بقالی': 'grocery', 'غذا و تنقلات': 'meal',
};
// Groups whose source category is already right; every other group is sorted icon by icon with RULES (first match on `key fa` wins).
const AUTHORITATIVE = new Set(['پول و گنجینه', 'جایزه و افتخار', 'کمک‌ها و قدرت‌ها', 'انرژی و زمان', 'نوستالژی', 'سرگرمی و گل', 'اسباب‌بازی', 'نوشت‌افزار', 'خونه و آشپزخونه', 'میوه', 'آجیل و سبزیجات']);
const RULES = [
  ['fun', /soccer-ticket/],
  ['wear', /soccer-jersey|soccer-shoes/],
  ['home', /tigh|nacet|تیغ/],
  ['tech', /payphone|تلفن سکه/],
  ['money', /sekke|goldCoin|dollar|سکه|دلار|اسکناس/],
  ['tools', /hammer|pliers|screwdriver|wrench|tape-measure|hand-wood-saw|flat-metal-file|spirit-level|چکش|انبر|آچار|اره دستی|سوهان فلز|تراز/],
  ['vehicle', /peykan|paykan|peugeot|renault|citroen|nissan|samand|pride|saipa|ikco|jian|mazda|p206|vanet|tire\b|engine-oil|battery-60|ticket|train|bus\b|busTicket|minibus|taxi|snapp|toll|gazooil|naft|cng|gasPump|bicycle|motorbike|تاکسی|خودرو|سواری|وانت|بلیت|بلیط|قطار|اتوبوس|بنزین|گازوئیل|نفت سفید|ژتون تلفن|دوچرخه|موتور|پیکان|پراید|سمند|لاستیک|باتری ماشین|تعویض روغن|ژیان|کرایه/],
  ['fun', /newspaper|magazine|gamenet|atari|handheld|vhs|filmRoll|cd\b|روزنامه|مجله|گیم‌نت|آتاری|بازی‌ماشین|ویدیو|فیلم عکاسی|سی‌دی بازی|pencil|fountain|geometry|glue|highlighter|sharpener|watercolor|soccer|مداد|خودنویس|پرگار|چسب|ماژیک|تراش|آبرنگ|فوتبال|تمبر|brick-game/],
  ['tech', /nokia|sony|motorola|samsung|power-bank|earphone|phone|charger|recharge|micro-sd|floppy|cd-r|playstation|mouse|modem|mp3|calculator|walkman|console|dvd|camera|hard-drive|laptop|\btv|tv-|fridge|washer|flash|pankeh|polowpaz|charkh|simkart|dialup|kart-tele|گوشی|تلویزیون|پلوپز|پنکه|چرخ خیاطی|سیم‌کارت|اینترنت|کارت اعتباری|لپ‌تاپ|ماوس|مودم|یخچال|لباس‌شویی|فلش|دوربین|هارد|دیسکت|شارژ|ماشین‌حساب/],
  ['drink', /sharbat|araq|shir-|^milk|doogh|nescafe|ghahveh|chaye|^tea\b|pepsi|delester|maolshair|abmiveh|ablimoo|serkeh|ab-havij|nooshidani|coffee|juice|soda|^water( |$)|شربت|عرق|شیر (?!موز)|شیرکاکائو|قهوه|چای سیاه|نوشابه|ماءالشعیر|رانی|آبلیمو|آب‌هویج|آبمیوه|سرکه|دوغ|نوشیدنی/],
  ['sweet', /pashmak|sohan|halva|biscuit|cake|cookie|icecream|bastani|alaska|gaz-isfahan|^gaz |baslogh|ghotab|naghl|wafer|koloocheh|nan-khamei|lavashak|tokhmeh|zorat|toot-khoshk|pudr-jele|candy|lollipop|baklava|pofak|chips|gum|chocolate|gummy|nokhodchi|ajil|zoolbia|بیسکویت|کیک|بستنی|آلاسکا|گز|باسلوق|قطاب|نقل|ویفر|کلوچه|لواشک|تخمه|بوداده|توت خشک|ژله|پشمک|سوهان|حلوا|آبنبات|باقلوا|پفک|چیپس|آدامس|شکلات|پاستیل|نخودچی|آجیل مخلوط|زولبیا|نان خامه/],
  ['meal', /kabab|kebab|beryani|ghormeh|qormeh|omelet|sandwich|^ash|ash-|kuku|faloodeh|labu|chelo|konserv|sosis|kalbas|zheton-daneshjooyi|pizza|burger|fish|chicken|falafel|dizi|halim|بریانی|کباب|قورمه|املت|ساندویچ|آش|کوکو|فالوده|لبو|کنسرو|سوسیس|کالباس|غذای دانشجویی|پیتزا|همبرگر|ماهی|^مرغ|فلافل|دیزی|حلیم/],
  ['fruit', /fresh-|khorma|khordan|green-beans|lobia|lentil|watermelon|pomegranate|pistachio|pesteh|خرما|سبزی|لوبیا|عدس|خربزه|انار|هندوانه|پسته/],
  ['home', /teaGlass|teapot|samovar|rug\b|jug\b|spiceSack|استکان چای|قوری|سماور|فرش|کوزه|کیسهٔ ادویه|powder-darya|maye-|saboon|sefidkonandeh|spray|capsule|bokhari|tigh|nacet|tiz-k|soap|brush|toothpaste|shampoo|tissue|diaper|پودر لباس|مایع|صابون|سفیدکننده|اسپری|کپسول|بخاری|تیغ|مسواک|مسواش|خمیردندان|شامپو|دستمال|پوشک|شانه/],
  ['wear', /boluze|kefsh|jersey|nail-polish|surme|hena|face-powder|nivea|vaseline|glycerin|بلوز|کفش|پیراهن|لاک|سرمه|حنا|پنکک|نیوآ|وازلین|گلیسیرین/],
  ['grocery', /berenj|makaroni|shekar|goosht|panir|kareh|rob-|roghan|bread|sangak|barbari|lavash|taftoon|nan\b|cheese|egg|honey|jam|pickles|oil|rice|flour|sugar|salt|cinnamon|cardamom|saffron|yogurt|meat|برنج|ماکارونی|شکر|گوشت|پنیر|کره|رب|روغن|نان|تخم‌مرغ|عسل|مربا|ترشی|آرد|قند|نمک|دارچین|هل|زعفران|ماست/],
];
const familyOf = (srcTitle, k, fa) => {
  const fallback = SRC[srcTitle] ?? 'home';
  if (AUTHORITATIVE.has(srcTitle)) return fallback;
  const hit = RULES.find(([, re]) => re.test(`${k} ${fa}`));
  return hit ? hit[0] : fallback;
};
// Names for icons no design list names (they would otherwise show their key in the picker).
const NAME_FA = { briefcase: 'کیف اداری', leaf: 'برگ', spices: 'ادویه' };

const seen = new Set();
const byFamily = new Map(FAMILIES.map(([id]) => [id, []]));
for (const g of groups) {
  for (const i of g.icons) {
    if (!keys.includes(i.key) || seen.has(i.key)) continue;
    seen.add(i.key);
    byFamily.get(familyOf(g.titleFa, i.key, i.fa)).push(i);
  }
}
const rest = keys.filter((k) => !seen.has(k));
for (const k of rest) byFamily.get(familyOf('سایر', k, NAME_FA[k] ?? k)).push({ key: k, fa: NAME_FA[k] ?? k });
const clean = FAMILIES.map(([id, titleFa, color]) => ({ id, titleFa, color, icons: byFamily.get(id) })).filter((g) => g.icons.length);
writeFileSync(
  join(out, 'groups.ts'),
  `/** Icon pack categories with Persian names (design 12, products v1-v4), folded into a few families for the pickers. GENERATED by scripts/gen-items.mjs, do not edit. */
export interface ItemGroup {
  id: string;
  titleFa: string;
  color: string;
  icons: { key: string; fa: string }[];
}
export const ITEM_GROUPS: readonly ItemGroup[] = ${JSON.stringify(clean, null, 1)};
`,
);
console.log(keys.length, 'icons,', clean.length, 'groups, uncategorised:', rest.length, rest.join(','));
