import { Pressable, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { Item } from '../components/Item';
import { fonts } from '../theme/colors';
import { BrassSquare, Plate } from './adultKit';

/** Adult-look pieces of the board duel's play screen («صرافی و گاوصندوق», docs/design/CLAUDE.md: gold = play, copper = duel). */

/** Header row: leave button, the turn clock (red in the last ten seconds), the combo slot and the mode pill. */
export function ArenaBarAdult({ leaveLabel, onLeave, clockLabel, clock, urgent, combo, mode, wrapClock }: { leaveLabel: string; onLeave: () => void; clockLabel: string; clock: string; urgent: boolean; combo?: React.ReactNode; mode: string; /** Wraps the clock (the app pulses it in the last seconds). */ wrapClock?: (clock: React.ReactNode) => React.ReactNode }) {
  const clockNode = (
    <Plate radius={14} border={urgent ? '#FF6B55' : '#E0895A'} from={urgent ? '#4A1610' : '#2A1E16'} to={urgent ? '#2A0A06' : '#17100C'} height={40} style={styles.clock}>
      <View style={styles.clockIcon} accessibilityLabel={clockLabel}><Item icon="hourglass" /></View>
      <Text style={[styles.clockText, { color: urgent ? '#FFC9BF' : '#FFE9A8' }]}>{clock}</Text>
    </Plate>
  );
  return (
    <View style={styles.bar}>
      <BrassSquare glyph="pause" label={leaveLabel} onPress={onLeave} />
      <View style={styles.clockWrap}>{wrapClock ? wrapClock(clockNode) : clockNode}</View>
      {combo}
      <Plate radius={13} border="#8A5A16" ledge={3} height={34} style={styles.mode}>
        <Text style={styles.modeText} numberOfLines={1}>{mode}</Text>
      </Plate>
    </View>
  );
}

/** Round power-up button (magnifier / freeze) with its count badge. */
export function PowerPlateAdult({ kind, count, enabled, label, onPress }: { kind: 'magnifier' | 'freeze'; count: number; enabled: boolean; label: string; onPress: () => void }) {
  const on = enabled && count > 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !on }} onPress={on ? onPress : undefined} style={({ pressed }) => [{ opacity: on ? 1 : 0.45 }, pressed && on ? styles.pressed : null]}>
      <Plate radius={26} border={kind === 'freeze' ? '#7FD0F0' : '#E8B64A'} from={kind === 'freeze' ? '#1C3A4A' : '#3A2A1C'} to="#17100C" ledge={3} height={48} style={styles.power}>
        <View style={styles.powerIcon}><Item icon={kind} /></View>
      </Plate>
      <View style={styles.badge}><Text style={styles.badgeText}>{toPersianDigits(String(count))}</Text></View>
    </Pressable>
  );
}

/** Bought item (reveal / shuffle): a small plate with the icon and how many are left. */
export function ItemPlateAdult({ icon, text, enabled, label, onPress }: { icon: string; text: string; enabled: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !enabled }} onPress={enabled ? onPress : undefined} style={({ pressed }) => [{ opacity: enabled ? 1 : 0.45 }, pressed && enabled ? styles.pressed : null]}>
      <Plate radius={19} border="#8A5A16" ledge={3} height={34} style={styles.item}>
        <View style={styles.itemIcon}><Item icon={icon} /></View>
        <Text style={styles.itemText}>{text}</Text>
      </Plate>
    </Pressable>
  );
}

/** Whose move it is: gold when it is the player's, copper when it is the rival's, bronze when a teammate leads. */
export function TurnPillAdult({ text, tone }: { text: string; tone: 'mine' | 'rival' | 'mate' }) {
  const c = tone === 'mine' ? { bd: '#E8B64A', from: '#5A4A1A', to: '#2A200A', fg: '#FFF1B8' } : tone === 'mate' ? { bd: '#8FDCFA', from: '#1C3A4A', to: '#0E1E28', fg: '#D6F2FF' } : { bd: '#E0895A', from: '#4A2A18', to: '#2A140A', fg: '#FFD2B0' };
  return (
    <Plate radius={99} border={c.bd} from={c.from} to={c.to} ledge={3} style={styles.turn}>
      <Text style={[styles.turnText, { color: c.fg }]}>{text}</Text>
    </Plate>
  );
}

/** Short message over the turn pill or above the buttons. */
export function ToastAdult({ text }: { text: string }) {
  return (
    <Plate radius={99} border="#E8B64A" from="#0E0A08" to="#0E0A08" ledge={2} style={styles.toast}>
      <Text style={styles.toastText} numberOfLines={2}>{text}</Text>
    </Plate>
  );
}

const styles = StyleSheet.create({
  bar: { direction: 'rtl', flexDirection: 'row', alignItems: 'center', gap: 8 },
  clockWrap: { flex: 1, alignItems: 'center' },
  clock: { minWidth: 118, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  clockIcon: { width: 26, height: 26 },
  clockText: { fontFamily: fonts.display, fontSize: 24, lineHeight: 34 },
  mode: { paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  modeText: { fontFamily: fonts.display, fontSize: 14, lineHeight: 22, color: '#E8B64A' },
  pressed: { transform: [{ translateY: 2 }] },
  power: { width: 48, alignItems: 'center', justifyContent: 'center' },
  powerIcon: { width: 30, height: 30 },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, borderWidth: 2, borderColor: '#000', backgroundColor: '#E0895A', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 19, color: '#2A1206' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 },
  itemIcon: { width: 22, height: 22 },
  itemText: { fontFamily: fonts.display, fontSize: 14, lineHeight: 22, color: '#FFE9A8' },
  turn: { paddingHorizontal: 18, paddingVertical: 2 },
  turnText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 28 },
  toast: { paddingHorizontal: 16, paddingVertical: 3, maxWidth: '100%' },
  toastText: { fontFamily: fonts.display, fontSize: 15, lineHeight: 24, color: '#E8B64A', textAlign: 'center' },
});
