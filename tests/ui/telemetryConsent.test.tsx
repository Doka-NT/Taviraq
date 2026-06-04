import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig, TelemetryConsentDecision } from '@shared/types'
import { TelemetryConsent } from '@renderer/components/TelemetryConsent'
import { LanguageProvider } from '@renderer/i18n/LanguageContext'

const setTelemetrySettings = vi.fn().mockResolvedValue({})

function configWith(decision: TelemetryConsentDecision): Partial<AppConfig> {
  return { telemetry: { enabled: decision === 'granted', consentDecision: decision, installId: 'anon' } }
}

function renderConsent() {
  return render(
    <LanguageProvider language="en">
      <TelemetryConsent />
    </LanguageProvider>
  )
}

function stubConfig(decision: TelemetryConsentDecision) {
  vi.stubGlobal('api', {
    config: {
      load: vi.fn().mockResolvedValue(configWith(decision)),
      setTelemetrySettings
    }
  })
}

beforeEach(() => {
  setTelemetrySettings.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TelemetryConsent', () => {
  it('prompts on first run while the decision is pending', async () => {
    stubConfig('pending')
    renderConsent()
    await waitFor(() => expect(screen.getByText('Help improve Taviraq?')).toBeInTheDocument())
  })

  it('does not prompt once a decision has been made', async () => {
    stubConfig('granted')
    const { container } = renderConsent()
    await waitFor(() => expect(window.api.config.load).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('opts in when the user accepts', async () => {
    stubConfig('pending')
    renderConsent()
    await waitFor(() => expect(screen.getByText('Share anonymous usage')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Share anonymous usage'))
    expect(setTelemetrySettings).toHaveBeenCalledWith({ enabled: true, consentDecision: 'granted' })
  })

  it('stays off when the user declines', async () => {
    stubConfig('pending')
    renderConsent()
    await waitFor(() => expect(screen.getByText('No thanks')).toBeInTheDocument())
    fireEvent.click(screen.getByText('No thanks'))
    expect(setTelemetrySettings).toHaveBeenCalledWith({ enabled: false, consentDecision: 'denied' })
  })
})
