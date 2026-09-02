import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation before an action staff cannot undo.
 *
 * The brief asks for confirm dialogs before destructive admin actions. Two
 * details make this one actually useful rather than a reflex click:
 *
 *  - The buttons say what they do ("Mark as shipped" / "Keep as it is"), never
 *    bare OK/Cancel. A dialog you can dismiss without reading is not a
 *    safeguard.
 *  - Focus moves to the dialog on open and Escape cancels, so it is operable
 *    without a mouse — a clerk working through a batch of orders is faster on
 *    the keyboard.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="a-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        // Only a click on the backdrop itself cancels — not one that bubbled
        // up from inside the dialog.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="a-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <button type="button" className="a-dialog__close" aria-label="Close" onClick={onCancel}>
          <X size={18} />
        </button>
        <h2 id="confirm-title">{title}</h2>
        <p>{body}</p>
        <div className="a-dialog__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onCancel}>
            Keep as it is
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`a-btn ${destructive ? 'a-btn--danger' : 'a-btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
