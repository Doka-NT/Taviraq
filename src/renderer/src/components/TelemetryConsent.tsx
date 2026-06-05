import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import type { TelemetryConsentDecision } from '@shared/types'
import { useT } from '@renderer/i18n/language'

/**
 * First-run, opt-in consent prompt for privacy-respecting activation telemetry.
 * Telemetry stays off until the user explicitly accepts here. The prompt only
 * appears while the stored consent decision is still `pending`; once the user
 * chooses, it never shows again and the choice can be changed in
 * Settings → Security & Privacy.
 */
export function TelemetryConsent(): JSX.Element | null {
  const { t } = useT()
  const [decision, setDecision] = useState<TelemetryConsentDecision | null>(null)

  useEffect(() => {
    let active = true
    void window.api.config.load().then((config) => {
      if (active) setDecision(config.telemetry?.consentDecision ?? 'pending')
    })
    // If the choice is made elsewhere (e.g. the Settings toggle) while this
    // prompt is still visible, reflect it so a stale prompt can't overwrite it.
    const unsubscribe = window.api.config.onTelemetryChanged((settings) => {
      setDecision(settings.consentDecision)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (decision !== 'pending') return null

  const choose = (enabled: boolean): void => {
    setDecision(enabled ? 'granted' : 'denied')
    void window.api.config.setTelemetrySettings({
      enabled,
      consentDecision: enabled ? 'granted' : 'denied'
    })
  }

  return (
    <div className="telemetry-consent" role="dialog" aria-modal="false" aria-labelledby="telemetry-consent-title">
      <div className="telemetry-consent__icon" aria-hidden="true">
        <BarChart3 size={18} />
      </div>
      <div className="telemetry-consent__body">
        <strong id="telemetry-consent-title" className="telemetry-consent__title">
          {t('telemetry.consent.title')}
        </strong>
        <p className="telemetry-consent__text">{t('telemetry.consent.body')}</p>
        <div className="telemetry-consent__actions">
          <button type="button" className="telemetry-consent__accept" onClick={() => choose(true)}>
            {t('telemetry.consent.accept')}
          </button>
          <button type="button" className="telemetry-consent__decline" onClick={() => choose(false)}>
            {t('telemetry.consent.decline')}
          </button>
        </div>
      </div>
    </div>
  )
}
