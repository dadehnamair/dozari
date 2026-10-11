import type { RefObject } from 'react';
import { Share } from 'react-native';
import type { View } from 'react-native';

type Nav = { share?: (d: { files?: File[]; text?: string; title?: string }) => Promise<void>; canShare?: (d: { files: File[] }) => boolean };

/** The card as a PNG file; null when the browser cannot draw it. */
async function cardPng(ref: RefObject<View | null>): Promise<File | null> {
  // On web the ref of a View is its DOM element.
  const node = ref.current as unknown as HTMLElement | null;
  if (!node || typeof (globalThis as { document?: unknown }).document === 'undefined') return null;
  try {
    const { toBlob } = await import('html-to-image');
    // The share card lays out at 360x450; 3x gives the same 1080x1350 image as the phones.
    const blob = await toBlob(node, { pixelRatio: 3, cacheBust: true, skipFonts: false });
    return blob ? new File([blob], 'dozari.png', { type: 'image/png' }) : null;
  } catch {
    return null;
  }
}

/**
 * Web: the card becomes a PNG and goes through the browser's share sheet (a phone's PWA), or downloads when files cannot be shared.
 * Anything that goes wrong falls back to the words and the invite code, as before.
 */
export async function captureAndShare(ref: RefObject<View | null>, message: string): Promise<void> {
  const file = await cardPng(ref);
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as Nav;
  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: message });
      return;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return; // the player closed the sheet
    }
  }
  if (file) {
    const url = URL.createObjectURL(file);
    const a = (globalThis as unknown as { document: { createElement(t: string): { href: string; download: string; click(): void } } }).document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  await Share.share({ message });
}
