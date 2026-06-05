import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TelemetrySettings } from '@shared/types'

const h = vi.hoisted(() => ({
  isPackaged: true,
  version: '1.2.3',
  initialize: vi.fn(() => Promise.resolve()),
  track: vi.fn(() => Promise.resolve())
}))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return h.isPackaged
    },
    getVersion: () => h.version,
    getLocale: () => 'en-US'
  }
}))

vi.mock('@aptabase/electron/main', () => ({
  initialize: h.initialize,
  trackEvent: h.track
}))

const grantedSettings: TelemetrySettings = {
  enabled: true,
  consentDecision: 'granted',
  installId: 'anon-123'
}

async function loadService(appKey: string | undefined) {
  vi.resetModules()
  vi.stubEnv('TAVIRAQ_APTABASE_KEY', appKey ?? '')
  return import('@main/services/telemetryService')
}

beforeEach(() => {
  h.isPackaged = true
  h.version = '1.2.3'
  h.initialize.mockClear()
  h.track.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('telemetryService gating', () => {
  it('initializes the SDK and sends a bare event when opted in', async () => {
    const svc = await loadService('A-EU-1234567890')
    svc.setupTelemetry()
    expect(h.initialize).toHaveBeenCalledWith('A-EU-1234567890')

    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    expect(h.track).toHaveBeenCalledTimes(1)
    // Events carry no properties — Aptabase adds anonymous context itself.
    expect(h.track).toHaveBeenCalledWith('app_opened')
  })

  it('does nothing when the user has not opted in', async () => {
    const svc = await loadService('A-EU-1234567890')
    svc.setupTelemetry()
    svc.setTelemetrySettings({ ...grantedSettings, enabled: false })
    svc.trackEvent('app_opened')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('does nothing when the SDK was never initialized', async () => {
    const svc = await loadService('A-EU-1234567890')
    // setupTelemetry intentionally not called
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('does nothing when no Aptabase key is configured', async () => {
    const svc = await loadService(undefined)
    svc.setupTelemetry()
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    expect(h.initialize).not.toHaveBeenCalled()
    expect(h.track).not.toHaveBeenCalled()
  })

  it('does nothing in an unpackaged (dev) build', async () => {
    h.isPackaged = false
    const svc = await loadService('A-EU-1234567890')
    svc.setupTelemetry()
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('does nothing for the 0.0.0 placeholder (local/unsigned) build', async () => {
    h.version = '0.0.0'
    const svc = await loadService('A-EU-1234567890')
    svc.setupTelemetry()
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    expect(h.track).not.toHaveBeenCalled()
  })

  it('de-duplicates oncePerRun events within a single run', async () => {
    const svc = await loadService('A-EU-1234567890')
    svc.setupTelemetry()
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('session_started', { oncePerRun: true })
    svc.trackEvent('session_started', { oncePerRun: true })
    expect(h.track).toHaveBeenCalledTimes(1)
  })
})
