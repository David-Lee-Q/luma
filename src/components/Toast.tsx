import { useLibrary } from '../lib/library'
import { IconCheck, IconInfo } from './Icons'

export function Toast() {
  const { toast } = useLibrary()
  if (!toast) return null

  return (
    <div className={`toast toast--${toast.tone}`} role="status" key={toast.id}>
      <span className="toast-icon">
        {toast.tone === 'success' ? <IconCheck size={16} /> : <IconInfo size={16} />}
      </span>
      <span>{toast.text}</span>
    </div>
  )
}
