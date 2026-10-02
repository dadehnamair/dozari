import { useMemo } from 'react';
import { confettiPieces } from './fx';
import { Falling, Layer } from './Falling';

/** Win celebration: 12 coloured chips falling over the whole parent. */
export function Confetti({ distance = 170 }: { distance?: number }) {
  const pieces = useMemo(() => confettiPieces(), []);
  return (
    <Layer>
      {pieces.map((p, i) => (
        <Falling
          key={i}
          duration={p.duration}
          phase={p.phase}
          distance={distance}
          spin={600}
          style={{ position: 'absolute', top: 0, left: `${p.left}%`, width: 8, height: 13, borderRadius: 2, backgroundColor: p.color }}
        />
      ))}
    </Layer>
  );
}
