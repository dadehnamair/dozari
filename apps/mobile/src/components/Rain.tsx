import { useMemo } from 'react';
import { rainDrops } from './fx';
import { Falling, Layer } from './Falling';

/** Loss mood: thin rain streaks over the whole parent. */
export function Rain({ distance = 380 }: { distance?: number }) {
  const drops = useMemo(() => rainDrops(), []);
  return (
    <Layer>
      {drops.map((d, i) => (
        <Falling
          key={i}
          duration={d.duration}
          phase={d.phase}
          distance={distance}
          style={{ position: 'absolute', top: 0, left: `${d.left}%`, width: d.width, height: d.height, borderRadius: 2, backgroundColor: 'rgba(220,230,255,1)', opacity: d.opacity }}
        />
      ))}
    </Layer>
  );
}
