import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TelemetrySettings } from '@shared/types'

const h = vi.hoisted(() => ({ isPackaged: true, version: '1.2.3' }))

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return h.isPackaged
    },
    getVersion: () => h.version,
    getLocale: () => 'en-US'
  }
}))

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))

const grantedSettings: TelemetrySettings = {
  enabled: true,
  consentDecision: 'granted',
  installId: 'anon-123'
}

async function loadService(endpoint: string | undefined) {
  vi.resetModules()
  if (endpoint === undefined) {
    vi.stubEnv('TAVIRAQ_TELEMETRY_URL', '')
  } else {
    vi.stubEnv('TAVIRAQ_TELEMETRY_URL', endpoint)
  }
  return import('@main/services/telemetryService')
}

beforeEach(() => {
  h.isPackaged = true
  h.version = '1.2.3'
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('telemetryService gating', () => {
  it('sends an aggregate event with non-identifying context when opted in', async () => {
    const svc = await loadService('https://telemetry.example/ingest')
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://telemetry.example/ingest')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      event: 'app_opened',
      installId: 'anon-123',
      appVersion: '1.2.3',
      os: process.platform,
      locale: 'en-US'
    })
    // No terminal content / personal fields leak into the payload.
    expect(Object.keys(body).sort()).toEqual(['appVersion', 'event', 'installId', 'locale', 'os', 'ts'])
  })

  it('does nothing when the user has not opted in', async () => {
    const svc = await loadService('https://telemetry.example/ingest')
    svc.setTelemetrySettings({ ...grantedSettings, enabled: false })
    svc.trackEvent('app_opened')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does nothing when no endpoint is configured', async () => {
    const svc = await loadService(undefined)
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does nothing in an unpackaged (dev) build', async () => {
    h.isPackaged = false
    const svc = await loadService('https://telemetry.example/ingest')
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does nothing for the 0.0.0 placeholder (local/unsigned) build', async () => {
    h.version = '0.0.0'
    const svc = await loadService('https://telemetry.example/ingest')
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('app_opened')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('de-duplicates oncePerRun events within a single run', async () => {
    const svc = await loadService('https://telemetry.example/ingest')
    svc.setTelemetrySettings(grantedSettings)
    svc.trackEvent('session_started', { oncePerRun: true })
    svc.trackEvent('session_started', { oncePerRun: true })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })
})
