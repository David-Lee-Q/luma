import { IconTrash } from './Icons'
import { Sheet } from './Sheet'

interface ConfirmSheetProps {
  title: string
  description: string
  confirmText: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmSheet({
  title,
  description,
  confirmText,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  return (
    <Sheet onClose={onClose} label={title} className="sheet--confirm">
      <div className="confirm-mark">
        <IconTrash size={24} />
      </div>
      <h2 className="confirm-title">{title}</h2>
      <p className="confirm-text">{description}</p>
      <div className="confirm-actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          再想想
        </button>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmText}
        </button>
      </div>
    </Sheet>
  )
}
