import { describe, expect, it } from 'vitest';
import { buildWear, parseFileName, parseSvg, validateSvg, VIEW_BOX } from '../../../scripts/lib/wearSvg.mjs';

const svg = (inner: string, vb = VIEW_BOX) => `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">\n<!-- c -->\n${inner}\n</svg>`;
const HAT = svg('<g><path d="M64 48L68 12" fill="#FFC93C" stroke="#3A2418" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="30" r="4.6" fill="#E04A3A"/></g>');

describe('wear svg pipeline', () => {
  it('reads file names', () => {
    expect(parseFileName('crown.svg')).toEqual({ key: 'crown', layer: 'front' });
    expect(parseFileName('hairLong.back.svg')).toEqual({ key: 'hairLong', layer: 'back' });
    expect(() => parseFileName('hair-long.svg')).toThrow();
    expect(() => parseFileName('crown.png')).toThrow();
  });

  it('turns an svg into react-native-svg components and a slot table', () => {
    const out = buildWear([
      { slot: 'hat', name: 'redCap.svg', src: HAT },
      { slot: 'hat', name: 'redCap.back.svg', src: svg('<rect x="1" y="2" width="3" height="4" rx="1"/>') },
    ]);
    if (out.errors) throw new Error(out.errors.join('\n'));
    expect(out.keys).toEqual(['redCap']);
    expect(out.slots).toContain("redCap: 'hat',");
    expect(out.art).toContain("import { Circle, G, Path, Rect } from 'react-native-svg';");
    expect(out.art).toContain('<Path d="M64 48L68 12" fill="#FFC93C" stroke="#3A2418" strokeWidth="3" strokeLinejoin="round" />');
    expect(out.art).toContain('front: () => (');
    expect(out.art).toContain('back: () => (');
  });

  it('is empty (and imports nothing) when there is no art', () => {
    const out = buildWear([]);
    if (out.errors) throw new Error('unexpected');
    expect(out.art).not.toContain('react-native-svg');
    expect(out.slots).toContain('= {\n};');
  });

  it.each([
    ['wrong viewBox', svg('<path d="M0 0"/>', '0 0 200 260'), 'viewBox'],
    ['a gradient', svg('<defs><linearGradient/></defs><path d="M0 0"/>'), 'not allowed'],
    ['text', svg('<text>hi</text>'), 'not allowed'],
    ['a style attribute', svg('<path d="M0 0" style="fill:red"/>'), 'style'],
    ['a url reference', svg('<path d="M0 0" fill="url(#g)"/>'), 'url'],
    ['an empty drawing', svg('<g></g>'), 'empty'],
  ])('rejects %s', (_n, src, msg) => {
    const out = buildWear([{ slot: 'hat', name: 'bad.svg', src }]);
    expect(out.errors?.join('\n')).toContain(msg);
  });

  it('rejects broken xml and a key used in two slots', () => {
    expect(() => parseSvg('<svg><g></svg>')).toThrow();
    const out = buildWear([
      { slot: 'hat', name: 'same.svg', src: HAT },
      { slot: 'hair', name: 'same.svg', src: HAT },
    ]);
    expect(out.errors?.join('\n')).toContain('already used');
  });

  it('accepts the viewBox with commas', () => {
    expect(validateSvg(parseSvg(svg('<path d="M0 0"/>', '-20,-18,240,276')))).toEqual([]);
  });
});
