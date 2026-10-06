import { useId } from 'react';
import { Image as RNImage } from 'react-native';
import Svg, { ClipPath, Circle, Defs, G, Image as SvgImage, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import art1 from '../../assets/keepsake/yadegar-1.webp';
import art2 from '../../assets/keepsake/yadegar-2.webp';
import art3 from '../../assets/keepsake/yadegar-3.webp';
import art4 from '../../assets/keepsake/yadegar-4.webp';
import art5 from '../../assets/keepsake/yadegar-5.webp';
import art6 from '../../assets/keepsake/yadegar-6.webp';
import art7 from '../../assets/keepsake/yadegar-7.webp';
import art8 from '../../assets/keepsake/yadegar-8.webp';
import { YADEGAR_BEADS, YADEGAR_CARDS, YADEGAR_GEMS, YADEGAR_PAPER, YADEGAR_SCALLOP } from './yadegarData';
import { dateSegments } from './yadegarGeometry';

/** The eight scenes of the designer's first series (`docs/design/yadegar`), rendered from the design to WebP. */
const ART: Record<string, number> = { '1': art1, '2': art2, '3': art3, '4': art4, '5': art5, '6': art6, '7': art7, '8': art8 };

/** «yadegar-3» → '3'; null for a keepsake that has no designed art (it keeps the placeholder frame). */
export const yadegarCard = (artKey: string | null | undefined): string | null => {
  const m = /^yadegar-([1-8])$/.exec(artKey ?? '');
  return m ? m[1]! : null;
};

const src = (card: string) => {
  const uri = RNImage.resolveAssetSource(ART[card]!)?.uri;
  return uri ? { uri } : ART[card]!;
};

/** The framed medal («مُهر»): gold ring (scalloped with gems for a rare card), beads, and the round crop of the scene. `dim` greys out a keepsake not completed yet. */
export function YadegarMedal({ card, size = 80, dim = false }: { card: string; size?: number; dim?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = YADEGAR_CARDS[card];
  if (!c || !ART[card]) return null;
  const [fx, fy, fs] = c.focal;
  const k = 116 / fs;
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" opacity={dim ? 0.45 : 1}>
      <Defs>
        <LinearGradient id={`${id}gd`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fff1b8" />
          <Stop offset="0.3" stopColor="#e0b04a" />
          <Stop offset="0.55" stopColor="#9a6a1a" />
          <Stop offset="0.8" stopColor="#f0cf6a" />
          <Stop offset="1" stopColor="#8a5a12" />
        </LinearGradient>
        <ClipPath id={`${id}mc`}><Circle cx={80} cy={80} r={58} /></ClipPath>
      </Defs>
      {c.rare ? <Path d={YADEGAR_SCALLOP} fill={`url(#${id}gd)`} stroke="#5a3a0a" strokeWidth={1.2} /> : <Circle cx={80} cy={80} r={76} fill={`url(#${id}gd)`} stroke="#5a3a0a" strokeWidth={1.2} />}
      {YADEGAR_BEADS.map((b, i) => <Circle key={i} cx={b.x} cy={b.y} r={2.1} fill="#fff4c8" stroke="#7a5212" strokeWidth={0.6} />)}
      {c.rare ? YADEGAR_GEMS.map((g, i) => <Circle key={i} cx={g.x} cy={g.y} r={5} fill="#1f6aa8" stroke="#fff1b8" strokeWidth={1.4} />) : null}
      <Circle cx={80} cy={80} r={60} fill="#2b1240" stroke="#5a3a0a" strokeWidth={1} />
      <G clipPath={`url(#${id}mc)`}>
        <G transform={`translate(22 22) scale(${k}) translate(${-(fx - fs / 2)} ${-(fy - fs / 2)})`}>
          <SvgImage x={0} y={0} width={300} height={400} href={src(card)} preserveAspectRatio="none" />
        </G>
      </G>
    </Svg>
  );
}

/** The scene as a photo with a deckled paper edge and the «camera date» imprint (the card's face). */
export function YadegarPhoto({ card, width = 160, dim = false }: { card: string; width?: number; dim?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = YADEGAR_CARDS[card];
  if (!c || !ART[card]) return null;
  return (
    <Svg width={width} height={(width * 426) / 326} viewBox="0 0 326 426" opacity={dim ? 0.5 : 1}>
      <Defs>
        <LinearGradient id={`${id}pp`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fbf6ea" />
          <Stop offset="1" stopColor="#e8dcc2" />
        </LinearGradient>
      </Defs>
      <Path d={YADEGAR_PAPER} fill={`url(#${id}pp)`} />
      <G transform="translate(13 13)">
        <SvgImage x={0} y={0} width={300} height={400} href={src(card)} preserveAspectRatio="none" />
        <Rect width={300} height={400} fill="none" stroke="#000" strokeOpacity={0.25} />
        <G opacity={0.9}>{dateSegments(c.date).map((s, i) => <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={0.8} fill="#ff8a2a" />)}</G>
      </G>
    </Svg>
  );
}

/**
 * The jigsaw of the card, assembled: the pieces the player owns show the scene, the missing ones are empty paper-coloured slots. With `scatter` the
 * pieces lie where the designer tossed them (the «puzzle» artboard); without, they sit in place.
 */
export function YadegarPuzzle({ card, owned, width = 160, scatter = false }: { card: string; owned: readonly number[]; width?: number; scatter?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const c = YADEGAR_CARDS[card];
  if (!c || !ART[card]) return null;
  const vb = scatter ? c.pvb : '0 0 300 400';
  const [, , vw, vh] = vb.split(' ').map(Number) as [number, number, number, number];
  return (
    <Svg width={width} height={(width * vh) / vw} viewBox={vb}>
      <Defs>{c.pieces.map((p, i) => <ClipPath key={i} id={`${id}q${i}`}><Path d={p.d} /></ClipPath>)}</Defs>
      {c.pieces.map((p, i) => {
        const have = owned.includes(i + 1);
        return (
          <G key={i} transform={scatter ? p.tf : undefined}>
            {have ? null : <Path d={p.d} fill="#2b1240" opacity={0.55} stroke="#fff6e8" strokeWidth={2} strokeDasharray="8 6" strokeOpacity={0.55} />}
            {have ? (
              <>
                {scatter ? <Path d={p.d} fill="#bfae8e" transform="translate(0 4)" /> : null}
                <G clipPath={`url(#${id}q${i})`}><SvgImage x={0} y={0} width={300} height={400} href={src(card)} preserveAspectRatio="none" /></G>
                <Path d={p.d} fill="none" stroke="#fff6e8" strokeWidth={1.4} opacity={0.45} />
              </>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}
