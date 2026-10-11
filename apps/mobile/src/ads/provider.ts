/**
 * The ad network behind rewarded ads (docs/logic/ads.md). The app never talks to a network directly: a native glue module (an Iranian
 * network SDK, D18) registers an `AdProvider` at startup, and nothing is offered while none is ready. The server alone decides the reward.
 */
export type AdShowResult = 'completed' | 'dismissed' | 'unavailable' | 'error';

export interface AdProvider {
  name: string;
  /** An ad is loaded and can be shown now. */
  isReady(): boolean;
  /** Shows a full-screen rewarded video; `proof` is the network's completion token, when it has one. */
  show(placement: string): Promise<{ result: AdShowResult; proof?: string }>;
}

let current: AdProvider | null = null;

export const registerAdProvider = (p: AdProvider | null): void => {
  current = p;
};
export const adProvider = (): AdProvider | null => current;

/** Development only: a stand-in that "plays" an ad for a few seconds, so the flow can be tried without an SDK. Never registered in a release build. */
export const devAdProvider = (seconds = 11): AdProvider => ({
  name: 'dev',
  isReady: () => true,
  show: () => new Promise((resolve) => setTimeout(() => resolve({ result: 'completed' }), seconds * 1000)),
});

if (typeof __DEV__ !== 'undefined' && __DEV__) registerAdProvider(devAdProvider());
