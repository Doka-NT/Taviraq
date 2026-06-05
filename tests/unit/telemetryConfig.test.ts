import { describe, expect, it } from 'vitest'
import { createDefaultTelemetrySettings, normalizeTelemetrySettings, TELEMETRY_EVENTS } from '@shared/telemetryConfig'

const id = (): string => 'fixed-install-id'

describe('telemetryConfig', () => {
  it('exposes the aggregate funnel event taxonomy', () => {
    expect(TELEMETRY_EVENTS).toEqual([
      'app_first_run',
      'app_opened',
      'session_started',
      'ai_request_sent',
      'provider_configured',
      'ai_response_received',
      'ai_request_failed'
    ])
  })

  it('creates default-off, pending settings', () => {
    const settings = createDefaultTelemetrySettings(id)
    expect(settings).toEqual({ enabled: false, consentDecision: 'pending', installId: 'fixed-install-id' })
  })

  it('forces enabled to false unless consent is granted', () => {
    expect(normalizeTelemetrySettings({ enabled: true, consentDecision: 'pending' }, id).enabled).toBe(false)
    expect(normalizeTelemetrySettings({ enabled: true, consentDecision: 'denied' }, id).enabled).toBe(false)
    expect(normalizeTelemetrySettings({ enabled: true, consentDecision: 'granted' }, id).enabled).toBe(true)
  })

  it('regenerates a missing or blank install id', () => {
    expect(normalizeTelemetrySettings({ installId: '' }, id).installId).toBe('fixed-install-id')
    expect(normalizeTelemetrySettings({}, id).installId).toBe('fixed-install-id')
    expect(normalizeTelemetrySettings({ installId: 'keep-me' }, id).installId).toBe('keep-me')
  })

  it('coerces an unknown consent decision to pending', () => {
    expect(normalizeTelemetrySettings({ consentDecision: 'bogus' }, id).consentDecision).toBe('pending')
  })

  it('ignores a non-object value', () => {
    const settings = normalizeTelemetrySettings(null, id)
    expect(settings.enabled).toBe(false)
    expect(settings.consentDecision).toBe('pending')
  })
})
