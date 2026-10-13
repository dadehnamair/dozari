/** How one of the four choices looks once the question is answered (the same for price and general questions). */
export type ChoiceVerdict = 'right' | 'wrong' | 'answer' | 'dim';

/**
 * The tapped choice is green when it was right, red when not; then the right one is purple; the others fade.
 * Choices are compared by index (or any equal key), so callers pass whatever identifies a choice.
 */
export function choiceVerdict<T>(choice: T, picked: T | null, correct: T): ChoiceVerdict {
  if (choice === picked) return choice === correct ? 'right' : 'wrong';
  return choice === correct ? 'answer' : 'dim';
}

/** Face colours of the verdicts: green / red / purple, the shelf is the darker edge. */
export const VERDICT_TONES: Record<Exclude<ChoiceVerdict, 'dim'>, { from: string; to: string; shelf: string }> = {
  right: { from: '#D4F7B0', to: '#8BDB4B', shelf: '#4FA02A' },
  wrong: { from: '#FFD0D6', to: '#FF7E8E', shelf: '#C0394B' },
  answer: { from: '#E6D5FF', to: '#B590FF', shelf: '#7E46D6' },
};
