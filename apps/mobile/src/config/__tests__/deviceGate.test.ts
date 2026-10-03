import { describe, expect, it } from 'vitest';
import { appAddress, deviceKind, downloadLink, gateVerdict } from '../deviceGate';

const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

describe('device gate', () => {
  it('tells the platforms apart', () => {
    expect(deviceKind({ userAgent: CHROME_WIN, maxTouchPoints: 0 })).toBe('desktop');
    expect(deviceKind({ userAgent: MAC, maxTouchPoints: 0 })).toBe('desktop');
    expect(deviceKind({ userAgent: MAC, maxTouchPoints: 5 })).toBe('ios'); // iPadOS posing as a Mac
    expect(deviceKind({ userAgent: ANDROID, maxTouchPoints: 5 })).toBe('android');
    expect(deviceKind({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe('ios');
  });
  it('lets native, an installed PWA, a switched-off gate and an escaped tester through', () => {
    const base = { web: true, standalone: false, switchOn: true, escaped: false, kind: 'desktop' as const };
    expect(gateVerdict(base)).toBe('desktop');
    expect(gateVerdict({ ...base, kind: 'android' })).toBe('android');
    expect(gateVerdict({ ...base, kind: 'ios' })).toBe('ios');
    expect(gateVerdict({ ...base, web: false })).toBe('pass');
    expect(gateVerdict({ ...base, standalone: true })).toBe('pass');
    expect(gateVerdict({ ...base, switchOn: false })).toBe('pass');
    expect(gateVerdict({ ...base, escaped: true })).toBe('pass');
  });
  it('only trusts web addresses for the QR and the download', () => {
    expect(appAddress('https://mrbots.ir', 'https://x.test')).toBe('https://mrbots.ir');
    expect(appAddress('javascript:alert(1)', 'https://x.test')).toBe('https://x.test');
    expect(appAddress('', 'https://x.test')).toBe('https://x.test');
    expect(downloadLink('https://mrbots.ir/app.apk')).toBe('https://mrbots.ir/app.apk');
    expect(downloadLink('ftp://x')).toBeNull();
    expect(downloadLink(undefined)).toBeNull();
  });
});
