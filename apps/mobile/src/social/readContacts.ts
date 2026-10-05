import { Platform } from 'react-native';
import { pickMobiles } from './contactNumbers';

export type ContactsRead = { ok: true; phones: string[] } | { ok: false; reason: 'denied' | 'unsupported' };

type Picker = { select(props: string[], opts: { multiple: boolean }): Promise<{ tel?: string[] }[]> };

/** Asks for the address book and returns the Iranian mobiles in it. Web (Android Chrome): the contact picker, where the player ticks the people; native: the contacts permission. */
export async function readContacts(): Promise<ContactsRead> {
  if (Platform.OS === 'web') {
    const picker = (globalThis.navigator as unknown as { contacts?: Picker } | undefined)?.contacts;
    if (!picker) return { ok: false, reason: 'unsupported' };
    try {
      const rows = await picker.select(['tel'], { multiple: true });
      return { ok: true, phones: pickMobiles(rows.flatMap((r) => r.tel ?? [])) };
    } catch {
      return { ok: false, reason: 'denied' };
    }
  }
  const Contacts = await import('expo-contacts');
  const perm = await Contacts.requestPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'denied' };
  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
  return { ok: true, phones: pickMobiles(data.flatMap((c) => (c.phoneNumbers ?? []).map((p) => p.number ?? ''))) };
}
