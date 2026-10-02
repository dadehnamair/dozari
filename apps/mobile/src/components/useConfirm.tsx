import { useState } from 'react';
import type { ReactNode } from 'react';
import { fa } from '../i18n/fa';
import { ConfirmDialog } from './ConfirmDialog';

export interface Ask {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

/** `const { ask, dialog } = useConfirm()`: render `dialog` once, call `ask({...})` before an important action. */
export function useConfirm(): { ask: (a: Ask) => void; dialog: ReactNode } {
  const [pending, setPending] = useState<Ask | null>(null);
  const dialog = pending ? (
    <ConfirmDialog
      title={pending.title}
      message={pending.message}
      danger={pending.danger ?? true}
      confirmLabel={pending.confirmLabel ?? fa.confirm.yes}
      cancelLabel={fa.confirm.no}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const run = pending.onConfirm;
        setPending(null);
        run();
      }}
    />
  ) : null;
  return { ask: setPending, dialog };
}
