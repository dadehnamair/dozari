import { useEffect } from 'react';
import { LAST_LIFE_HEARTBEAT_MS } from '@dozari/shared';
import { buzz, playSfx } from '../sound/engine';

/** A soft lub-dub (sound and a double buzz where allowed) while the player is on the last life (D178). */
export function useHeartbeat(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const beat = () => {
      playSfx('heartbeat');
      buzz(35);
      setTimeout(() => buzz(25), 200);
    };
    beat();
    const t = setInterval(beat, LAST_LIFE_HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [active]);
}
