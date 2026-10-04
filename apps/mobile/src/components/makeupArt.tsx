import { Path } from 'react-native-svg';
import { GLOSS, MAKEUP } from '../theme/makeup-data';

/** Makeup layers of the face (docs/design/Character.dc.html): each goes at its own depth inside `FaceArt`. */

/** Under the eyes: blush and eyeshadow (shadow only while the eyes are open). */
export function MakeupBase({ k, eyesOpen }: { k: string; eyesOpen: boolean }) {
  const m = MAKEUP[k];
  if (!m) return null;
  return (
    <>
      {m.blush ? <Path d={m.blush} fill={m.blushColor} opacity={0.75} stroke="none" /> : null}
      {m.shadow && eyesOpen ? <Path d={m.shadow} fill={m.shadowColor} opacity={0.85} stroke="none" /> : null}
    </>
  );
}

/** Over the eyes: the winged liner. */
export function MakeupLiner({ k, eyesOpen }: { k: string; eyesOpen: boolean }) {
  const m = MAKEUP[k];
  return m?.liner && eyesOpen ? <Path d={m.liner} fill="#2B1240" stroke="#2B1240" strokeWidth={2.4} /> : null;
}

/** Under the mouth shape: the lipstick strokes the mouth outline in its colour. */
export function MakeupLip({ k, mouthD }: { k: string; mouthD: string }) {
  const m = MAKEUP[k];
  return m?.lip ? <Path d={mouthD} fill="none" stroke={m.lip} strokeWidth={7.5} /> : null;
}

/** Over the mouth shape: the gloss highlight. */
export function MakeupGloss({ k }: { k: string }) {
  return MAKEUP[k]?.gloss ? <Path d={GLOSS} fill="none" stroke="#fff" strokeWidth={2} opacity={0.9} /> : null;
}

/** After the nose: painted shapes and dots. */
export function MakeupMarks({ k }: { k: string }) {
  const m = MAKEUP[k];
  if (!m) return null;
  return (
    <>
      {m.paint ? <Path d={m.paint} fill={m.paintColor} strokeWidth={2} /> : null}
      {m.dots ? <Path d={m.dots} fill="none" stroke={m.dotsColor} strokeWidth={m.dotsWidth} /> : null}
    </>
  );
}
