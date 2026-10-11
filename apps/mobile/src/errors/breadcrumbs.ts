/** The last few things the app did (screens opened, calls that failed): they ride along with an error report so the cause can be traced. Memory only, never persisted. */
const MAX = 25;
const trail: string[] = [];

export function crumb(kind: 'screen' | 'api' | 'app', text: string): void {
  trail.push(`${new Date().toISOString().slice(11, 19)} ${kind}: ${text.slice(0, 120)}`);
  if (trail.length > MAX) trail.shift();
}

export const crumbs = (): string[] => [...trail];

/** The screen the player is on, as the app last announced it. */
let current = '';
export const setCurrentScreen = (name: string): void => {
  if (name !== current) crumb('screen', name);
  current = name;
};
export const currentScreen = (): string => current;
