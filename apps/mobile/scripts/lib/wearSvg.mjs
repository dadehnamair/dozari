// Converts designer-drawn wearable SVGs (assets/wear/<slot>/<key>[.front|.back].svg) into react-native-svg components.
// Pure functions (no I/O) so they can be unit-tested; scripts/build-wear.mjs does the file work.

export const SLOTS = ['hat', 'hair', 'glasses', 'outfit', 'accessory'];
export const VIEW_BOX = '-20 -18 240 276';

const ELEMENTS = { g: 'G', path: 'Path', circle: 'Circle', rect: 'Rect' };
const ATTRS = new Set([
  'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'transform',
]);
const KEY = /^[a-zA-Z][a-zA-Z0-9]*$/;

/** `hairLong` -> { key: 'hairLong', layer: 'front' }, `cape.back` -> { key: 'cape', layer: 'back' }. */
export function parseFileName(file) {
  const m = /^(.+?)(?:\.(front|back))?\.svg$/.exec(file);
  if (!m || !KEY.test(m[1])) throw new Error(`${file}: the name must be <key>.svg, <key>.front.svg or <key>.back.svg with a letters-and-digits key (e.g. hairLong)`);
  return { key: m[1], layer: m[2] ?? 'front' };
}

/** Minimal XML reader for the small SVG subset we accept. Returns the root element { name, attrs, children }. */
export function parseSvg(src, file = 'svg') {
  const text = src.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  let m;
  let consumed = 0;
  while ((m = re.exec(text))) {
    if (m.index !== consumed) throw new Error(`${file}: cannot read the SVG near "${text.slice(consumed, consumed + 30).trim()}"`);
    consumed = re.lastIndex;
    if (m[5] !== undefined) {
      if (m[5].trim()) throw new Error(`${file}: text inside the SVG is not allowed ("${m[5].trim().slice(0, 20)}")`);
      continue;
    }
    const [, closing, name, rawAttrs, selfClose] = m;
    if (closing) {
      const top = stack.pop();
      if (!top || top.name !== name) throw new Error(`${file}: </${name}> does not match <${top?.name}>`);
      continue;
    }
    const attrs = {};
    for (const a of rawAttrs.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = a[2] ?? a[3];
    const el = { name, attrs, children: [] };
    stack[stack.length - 1].children.push(el);
    if (!selfClose) stack.push(el);
  }
  if (consumed !== text.length && text.slice(consumed).trim()) throw new Error(`${file}: trailing content`);
  if (stack.length !== 1) throw new Error(`${file}: <${stack[stack.length - 1].name}> is never closed`);
  const svgs = root.children;
  if (svgs.length !== 1 || svgs[0].name !== 'svg') throw new Error(`${file}: the file must contain one <svg> root`);
  return svgs[0];
}

/** Rejects anything the character renderer cannot draw faithfully; returns the list of problems (empty = fine). */
export function validateSvg(svg, file = 'svg') {
  const problems = [];
  const vb = (svg.attrs.viewBox ?? '').trim().split(/[\s,]+/).join(' ');
  if (vb !== VIEW_BOX) problems.push(`${file}: viewBox must be "${VIEW_BOX}" (it is "${svg.attrs.viewBox ?? 'missing'}")`);
  let count = 0;
  const walk = (el) => {
    for (const c of el.children) {
      if (!ELEMENTS[c.name]) problems.push(`${file}: <${c.name}> is not allowed (only path, circle, rect, g)`);
      for (const k of Object.keys(c.attrs)) if (!ATTRS.has(k)) problems.push(`${file}: attribute "${k}" on <${c.name}> is not allowed`);
      for (const [k, v] of Object.entries(c.attrs)) if (/url\(|javascript:/i.test(v)) problems.push(`${file}: "${k}" must not reference gradients, filters or urls`);
      if (c.name !== 'g') count += 1;
      walk(c);
    }
  };
  walk(svg);
  if (count === 0) problems.push(`${file}: the drawing is empty`);
  return problems;
}

const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const esc = (v) => v.replace(/\\/g, '\\\\').replace(/"/g, '&quot;');

function toJsx(el, pad) {
  const attrs = Object.entries(el.attrs).map(([k, v]) => ` ${camel(k)}="${esc(v)}"`).join('');
  const tag = ELEMENTS[el.name];
  if (el.children.length === 0) return `${pad}<${tag}${attrs} />`;
  return `${pad}<${tag}${attrs}>\n${el.children.map((c) => toJsx(c, pad + '  ')).join('\n')}\n${pad}</${tag}>`;
}

/** The JSX of everything inside the <svg> root. */
export function svgToJsx(svg, pad = '    ') {
  return svg.children.map((c) => toJsx(c, pad)).join('\n');
}

/**
 * files: [{ slot, name, src }] (name is the file name). Returns the two generated sources:
 * `art` (react-native-svg components, mobile) and `slots` (key -> slot table, shared with the server).
 */
export function buildWear(files) {
  const items = new Map();
  const errors = [];
  for (const f of [...files].sort((a, b) => `${a.slot}/${a.name}`.localeCompare(`${b.slot}/${b.name}`))) {
    const label = `${f.slot}/${f.name}`;
    try {
      if (!SLOTS.includes(f.slot)) throw new Error(`${label}: the folder must be one of ${SLOTS.join(', ')}`);
      const { key, layer } = parseFileName(f.name);
      const svg = parseSvg(f.src, label);
      const bad = validateSvg(svg, label);
      if (bad.length) { errors.push(...bad); continue; }
      const cur = items.get(key) ?? { slot: f.slot, layers: {} };
      if (cur.slot !== f.slot) throw new Error(`${label}: key "${key}" is already used in slot "${cur.slot}"`);
      cur.layers[layer] = svgToJsx(svg, '        ');
      items.set(key, cur);
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (errors.length) return { errors };
  const keys = [...items.keys()];
  const layerFn = (name, jsx) => `    ${name}: () => (\n      <G>\n${jsx}\n      </G>\n    ),\n`;
  const comps = keys.map((k) => {
    const { layers } = items.get(k);
    return `  ${k}: {\n${layers.front ? layerFn('front', layers.front) : ''}${layers.back ? layerFn('back', layers.back) : ''}  },`;
  });
  const body = comps.join('\n');
  const used = ['Circle', 'Path', 'Rect'].filter((t) => body.includes(`<${t} `));
  const art = `// GENERATED by scripts/build-wear.mjs from assets/wear/**/*.svg: do not edit.\nimport type { ReactElement } from 'react';\n${keys.length ? `import { ${['G', ...used].sort().join(', ')} } from 'react-native-svg';\n` : ''}\nexport interface GeneratedWear {\n  front?: () => ReactElement;\n  back?: () => ReactElement;\n}\n\nexport const GENERATED_WEAR: Readonly<Record<string, GeneratedWear>> = {\n${body ? `${body}\n` : ''}};\n`;
  const slots = `// GENERATED by apps/mobile/scripts/build-wear.mjs from assets/wear/**/*.svg: do not edit.\nimport type { CosmeticSlot } from './hints-contract.js';\n\n/** Wearables drawn as SVG files (key -> slot); merged over the built-in table in wear.ts. */\nexport const GENERATED_WEAR_SLOT_OF: Readonly<Record<string, CosmeticSlot>> = {\n${keys.map((k) => `  ${k}: '${items.get(k).slot}',\n`).join('')}};\n`;
  return { art, slots, keys };
}
