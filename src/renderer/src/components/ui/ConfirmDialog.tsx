import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { useT } from '@renderer/i18n/language'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps): JSX.Element {
  const { t } = useT()

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, onConfirm])

  return createPortal(
    <div
      className="modal-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <Trash2 size={15} aria-hidden />
          <span id="confirm-dialog-title">{title}</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          {message}
        </p>
        <p className="modal-shortcut-hint">{t('confirm.shortcutHint')}</p>
        <div className="modal-actions">
          <button type="button" className="quiet-button" onClick={onCancel}>
            {t('confirm.cancel')}
          </button>
          <button type="button" className="delete-prompt-confirm-btn" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
