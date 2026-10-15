import { useEffect, useState } from 'react';
import { fa } from '../i18n/fa';
import { PageShell } from '../components/PageShell';
import { fetchMyProfile } from '../social/api';
import { colors } from '../theme/colors';
import { Dm } from './FriendsChat';

/**
 * A private chat opened straight from a friend's profile: it does not need the chat tabs to be open first.
 * (The server still decides who may write: friends on the same age track, chat rules and mutes.)
 */
export function DmSheet({ friend, onClose, onJoinTable }: { friend: { id: string; nickname: string; avatarKey: string }; onClose: () => void; onJoinTable?: (code: string) => void }) {
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    fetchMyProfile().then((p) => setMeId(p.id), () => undefined);
  }, []);
  return (
    <PageShell title={fa.chat.dmTitle(friend.nickname)} color={colors.candy.grape} backLabel={fa.chat.dmClose} onBack={onClose} bandHeight={100}>
      <Dm friend={friend} meId={meId} onBack={onClose} onJoinTable={onJoinTable} />
    </PageShell>
  );
}
