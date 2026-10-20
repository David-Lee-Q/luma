import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLockBody } from '../lib/useLockBody'

interface SheetProps {
  onClose: () => void
  children: ReactNode
  label: string
  className?: string
}

export function Sheet({ onClose, children, label, className = '' }: SheetProps) {
  useLockBody(true)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-grabber" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
