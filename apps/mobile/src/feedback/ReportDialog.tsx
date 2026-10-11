import { REPORT_CATEGORIES } from '@dozari/shared';
import type { ReportCategory } from '@dozari/shared';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { reportMessage } from '../chat/api';
import { Chips, FormDialog, formStyles as s } from './FormDialog';
import { reportUser } from './api';

const t = fa.feedback.report;
const codeOf = (e: unknown): string => (e instanceof ApiError ? e.code : 'generic');
const OPTIONS = REPORT_CATEGORIES.map((c) => [c, t.categories[c] ?? c] as const);

/** Report a player (from their profile) or a chat message: a reason from the list plus an optional description. */
export function ReportDialog({ target, onClose }: { target: { kind: 'user'; userId: string } | { kind: 'message'; messageId: string }; /** `sent` is true only when the report actually went through. */ onClose: (sent: boolean) => void }) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const send = () => {
    if (!category || busy) return;
    setBusy(true);
    setError(null);
    const call = target.kind === 'user' ? reportUser(target.userId, category, details.trim()) : reportMessage(target.messageId, `${t.categories[category] ?? category}${details.trim() ? `: ${details.trim()}` : ''}`.slice(0, 200));
    call.then(
      () => (setDone(true), setBusy(false)),
      (e) => (setError(t.errors[codeOf(e)] ?? t.errors.generic ?? ''), setBusy(false)),
    );
  };

  return (
    <FormDialog title={t.title} onClose={() => onClose(done)}>
      {done ? (
        <>
          <Text style={s.ok}>{t.done}</Text>
          <Pressable onPress={() => onClose(true)} accessibilityRole="button" style={[s.btn, s.go]}><Text style={s.btnText}>{fa.feedback.close}</Text></Pressable>
        </>
      ) : (
        <>
          <Text style={s.label}>{t.pick}</Text>
          <Chips options={OPTIONS} value={category} onPick={setCategory} />
          <Text style={s.label}>{t.details}</Text>
          <TextInput value={details} onChangeText={setDetails} multiline maxLength={target.kind === 'user' ? 500 : 150} style={[s.input, s.multiline]} accessibilityLabel={t.details} />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <View style={s.buttons}>
            <Pressable onPress={send} disabled={!category || busy} accessibilityRole="button" style={[s.btn, s.go, !category || busy ? s.off : null]}><Text style={s.btnText}>{t.send}</Text></Pressable>
            <Pressable onPress={() => onClose(false)} accessibilityRole="button" style={[s.btn, s.cancel]}><Text style={s.btnText}>{fa.feedback.cancel}</Text></Pressable>
          </View>
        </>
      )}
    </FormDialog>
  );
}
