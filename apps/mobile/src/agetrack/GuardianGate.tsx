import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { useHardwareBack } from '../nav/useHardwareBack';
import { GuardianStep } from './GuardianStep';
import { needsGuardian } from './guardianGate';

const INK = '#3A2418';

function GateOverlay({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <GuardianStep onDone={onClose} />
      </Pressable>
    </Pressable>
  );
}

/**
 * Friends and tables are closed to a kid/teen until a guardian is linked (docs/logic/age-tracks.md). The first time a request answers
 * `needs_guardian`, `intercept(error)` returns true and opens the one-step guardian screen over the current sheet; «بعداً» closes it.
 * Render `gate` once at the end of the screen. Every other error is left to the caller.
 */
export function useGuardianGate(): { gate: ReactNode; intercept: (e: unknown) => boolean } {
  const [open, setOpen] = useState(false);
  const intercept = useCallback((e: unknown) => {
    if (!needsGuardian(e)) return false;
    setOpen(true);
    return true;
  }, []);
  return { gate: open ? <GateOverlay onClose={() => setOpen(false)} /> : null, intercept };
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 16 },
});
