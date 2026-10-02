import { useCallback, useEffect, useState } from 'react';
import { APP_STORE } from '../config/build';
import { parseReviewRules, reviewUrl, shouldPromptReview } from './logic';
import { loadReviewState, updateReviewState } from './state';

/** Decides on Home whether to show the store-review dialog (rules come from the admin settings). */
export function useReviewPrompt(settings: Record<string, unknown>) {
  const [open, setOpen] = useState(false);
  const rules = parseReviewRules(settings);

  useEffect(() => {
    let live = true;
    void loadReviewState().then((state) => {
      if (live && shouldPromptReview(state, parseReviewRules(settings), APP_STORE, Date.now())) setOpen(true);
    });
    return () => {
      live = false;
    };
  }, [settings]);

  const asked = useCallback((done: boolean) => {
    setOpen(false);
    void updateReviewState((s) => ({ ...s, lastPromptAt: Date.now(), prompts: s.prompts + 1, done: s.done || done }));
  }, []);

  return {
    open,
    message: rules.message,
    url: APP_STORE ? reviewUrl(rules, APP_STORE) : null,
    onReview: () => asked(true),
    onLater: () => asked(false),
    onNever: () => asked(true),
  };
}
