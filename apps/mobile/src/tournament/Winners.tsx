import { Platform, StyleSheet, Text, View } from 'react-native';
import type { TournamentDetail } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { fa } from '../i18n/fa';
import { avatarOf } from '../social/avatarOf';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';
import { placeLabel } from './text';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const MEDAL: Record<number, { emoji: string; tint: string }> = { 1: { emoji: '🥇', tint: '#FFE48A' }, 2: { emoji: '🥈', tint: '#D9E2EC' }, 3: { emoji: '🥉', tint: '#FFC9A0' } };

/** The tournament's winners: the champion on a bigger card, then the runners-up; each shows avatar, medal and what they won. */
export function Winners({ t }: { t: TournamentDetail }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{'🏆 '}{fa.tournament.results}</Text>
      {t.results.map((r) => {
        const medal = MEDAL[r.place] ?? MEDAL[3]!;
        const prize = t.prizes.find((p) => p.place === r.place);
        const rewards = [r.coins > 0 ? `🪙 ${fa.tournament.reward.coins(r.coins)}` : '', prize && prize.gems > 0 ? `💎 ${fa.tournament.reward.gems(prize.gems)}` : '', prize && (prize.spins ?? 0) > 0 ? `🎡 ${fa.tournament.reward.spins(prize.spins ?? 0)}` : ''].filter(Boolean);
        const champ = r.place === 1;
        const player = t.players.find((p) => p.id === r.id);
        return (
          <View key={`${r.place}-${r.id}`} style={[styles.card, champ ? styles.champ : null, { backgroundColor: medal.tint }]}>
            <Text style={champ ? styles.medalBig : styles.medal}>{medal.emoji}</Text>
            <Avatar avatar={avatarOf(player?.avatarKey ?? '')} size={champ ? 60 : 44} />
            <View style={styles.body}>
              <Text style={styles.place}>{placeLabel(r.place)}</Text>
              <Text style={champ ? styles.nameBig : styles.name} numberOfLines={1}>{r.nickname}</Text>
              {rewards.length > 0 ? (
                <View style={styles.chips}>{rewards.map((x) => <View key={x} style={styles.chip}><Text style={styles.chipText}>{x}</Text></View>)}</View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  wrap: { gap: 8, padding: 12, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, ...lift(5) },
  title: { fontFamily: fonts.display, fontSize: 18, color: '#7E46D6', textAlign: TEXT_RIGHT },
  card: { flexDirection: ROW, alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, minWidth: 0, ...lift(3) },
  champ: { paddingVertical: 14, ...lift(5) },
  medal: { fontSize: 26 },
  medalBig: { fontSize: 36 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  place: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink, opacity: 0.75, textAlign: TEXT_RIGHT },
  name: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, textAlign: TEXT_RIGHT },
  nameBig: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: TEXT_RIGHT },
  chips: { flexDirection: ROW, flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card },
  chipText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink },
});
