import { Pressable, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { DailyRewardCard } from '../components/DailyRewardCard';
import { Toast } from '../components/Toast';
import { fa } from '../i18n/fa';
import { colors } from '../theme/colors';
import type { useDailyReward } from '../daily/useDailyReward';
import { styles } from './homeStyles';

/** The daily-reward card on a dimmed overlay; tapping outside closes it. */
export function DailyRewardOverlay({ daily, onClose }: { daily: ReturnType<typeof useDailyReward>; onClose: () => void }) {
  if (!daily.status) return null;
  return (
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.solo.back}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <DailyRewardCard
              steps={daily.status.steps}
              day={daily.status.day}
              canClaim={daily.status.canClaim && !daily.claiming}
              onClaim={daily.claim}
              waitText={daily.countdown ? `${daily.countdown} ${fa.daily.wait}` : undefined}
            />
            {daily.won !== null ? (
              <View style={styles.won}>
                <Toast text={`${toPersianDigits(String(daily.won))} ${fa.daily.won}`} tone={colors.candy.yellow} />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
  );
}
