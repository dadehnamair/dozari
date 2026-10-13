import { PermissionsAndroid, Platform } from 'react-native';
import { pickContacts, type ContactEntry } from './contactNumbers';

/** `blocked`: Android will not ask again (the player must switch it on in the phone's settings); `error`: the read itself failed, `detail` says how. */
export type ContactsRead = { ok: true; contacts: ContactEntry[] } | { ok: false; reason: 'denied' | 'unsupported' | 'blocked' | 'error'; detail?: string };

type Picker = { select(props: string[], opts: { multiple: boolean }): Promise<{ tel?: string[]; name?: string[] }[]> };

/** Asks for the address book and returns the Iranian mobiles in it with the names saved for them. Web (Android Chrome): the contact picker, where the player ticks the people; native: the contacts permission. */
export async function readContacts(): Promise<ContactsRead> {
  if (Platform.OS === 'web') {
    const picker = (globalThis.navigator as unknown as { contacts?: Picker } | undefined)?.contacts;
    if (!picker) return { ok: false, reason: 'unsupported' };
    try {
      const rows = await picker.select(['name', 'tel'], { multiple: true });
      return { ok: true, contacts: pickContacts(rows.map((r) => ({ name: r.name?.[0], numbers: r.tel ?? [] }))) };
    } catch {
      return { ok: false, reason: 'denied' };
    }
  }
  try {
    // expo-contacts 57 moved the promise API (`getContactsAsync` …) to `/legacy`; the root export now throws at runtime.
    const Contacts = await import('expo-contacts/legacy');
    if (Platform.OS === 'android') {
      // expo-contacts asks for READ and WRITE together; WRITE_CONTACTS is blocked in the manifest (store review), so its
      // request could never be granted. Ask for READ only — it is all reading the address book needs.
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
      if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return { ok: false, reason: 'blocked' };
      if (res !== PermissionsAndroid.RESULTS.GRANTED) return { ok: false, reason: 'denied' };
    } else {
      const perm = await Contacts.requestPermissionsAsync();
      if (!perm.granted) return { ok: false, reason: 'denied' };
    }
    // SDK 57's class-based API: the legacy `getContactsAsync` on the package root throws "deprecated" at runtime.
    const rows = await Contacts.Contact.getAllDetails([Contacts.ContactField.FULL_NAME, Contacts.ContactField.PHONES]);
    return { ok: true, contacts: pickContacts(rows.map((c) => ({ name: c.fullName, numbers: (c.phones ?? []).map((p) => p.number) }))) };
  } catch (e) {
    return { ok: false, reason: 'error', detail: e instanceof Error ? e.message.slice(0, 80) : String(e).slice(0, 80) };
  }
}
