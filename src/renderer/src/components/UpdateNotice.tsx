import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus } from '@shared/types'
import { useT } from '@renderer/i18n/language'

/**
 * Unobtrusive banner shown while an update downloads in the background and once it
 * is ready to install. Restarting is always the user's choice — the staged update
 * also installs automatically on the next quit.
 */
export function UpdateNotice(): JSX.Element | null {
  const { t } = useT()
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let active = true
    void window.api.update.getStatus().then((initial) => {
      if (active) setStatus(initial)
    })
    const unsubscribe = window.api.update.onStatus((next) => {
      setStatus(next)
      setDismissed(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (dismissed) return null
  if (status.state !== 'downloading' && status.state !== 'downloaded') return null

  const isReady = status.state === 'downloaded'
  const message = isReady
    ? t('update.downloaded', { version: status.version ?? '' })
    : t('update.downloading', { percent: status.percent ?? 0 })

  return (
    <div className="update-notice" role="status" aria-live="polite">
      <span className="update-notice__icon" aria-hidden="true">
        {isReady ? <Download size={15} /> : <RefreshCw size={15} className="update-notice__spin" />}
      </span>
      <span className="update-notice__text">{message}</span>
      {isReady && (
        <>
          <button
            type="button"
            className="update-notice__action"
            onClick={() => void window.api.update.install()}
          >
            {t('update.restart')}
          </button>
          <button
            type="button"
            className="update-notice__dismiss"
            aria-label={t('update.dismiss')}
            title={t('update.dismiss')}
            onClick={() => setDismissed(true)}
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}
