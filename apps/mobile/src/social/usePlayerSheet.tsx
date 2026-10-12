import { useCallback, useState } from 'react';
import { PlayerSheet } from './PlayerSheet';

/** Makes names tappable: `open(id)` from a name's `onPress`, and render `sheet` somewhere above the screen (it is the player's profile, D67). */
export function usePlayerSheet(): { open: (playerId: string) => void; sheet: React.ReactNode } {
  const [id, setId] = useState<string | null>(null);
  const close = useCallback(() => setId(null), []);
  return { open: setId, sheet: id ? <PlayerSheet playerId={id} onClose={close} /> : null };
}
