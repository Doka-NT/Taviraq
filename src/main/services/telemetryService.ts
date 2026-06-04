import { app } from 'electron'
import type { TelemetryEvent, TelemetrySettings } from '@shared/types'

/**
 * Placeholder version kept by dev and local/unsigned packages. Only the release
 * workflow stamps a real version from the tag, so this doubles as a "is this a
 * real release artifact" marker — telemetry never runs outside real releases.
 */
const DEV_VERSION = '0.0.0'

/**
 * HTTPS ingest endpoint baked in at build time via electron-vite `define`
 * (see `electron.vite.config.ts`). A packaged app launched from Finder has no
 * shell environment, so the endpoint cannot be read from `process.env` at
 * runtime — it must be a compile-time constant. When unset (the default), the
 * client is a hard no-op: a build with no endpoint configured never sends
 * anything, anywhere. The `process.env` fallback only applies under tests,
 * where the `define` constant is not substituted.
 */
declare const __TELEMETRY_ENDPOINT__: string
const ENDPOINT = (
  typeof __TELEMETRY_ENDPOINT__ !== 'undefined'
    ? __TELEMETRY_ENDPOINT__
    : process.env.TAVIRAQ_TELEMETRY_URL ?? ''
).trim()

/** Network send is best-effort and must never delay or block the app. */
const SEND_TIMEOUT_MS = 5000

let currentSettings: TelemetrySettings | undefined
/** Events already sent in this app run, for `oncePerRun` de-duplication. */
const sentThisRun = new Set<TelemetryEvent>()

/**
 * Telemetry is only ever sent from a packaged macOS *release* build that has a
 * configured ingest endpoint. Dev runs, local/unsigned packages (version
 * `0.0.0`), and endpoint-less builds can never emit.
 */
function isTelemetryPossible(): boolean {
  return app.isPackaged && app.getVersion() !== DEV_VERSION && ENDPOINT !== ''
}

/** Keep the main process's view of the user's consent/opt-in in sync. */
export function setTelemetrySettings(settings: TelemetrySettings | undefined): void {
  currentSettings = settings
}

/**
 * Emit an aggregate funnel event. Does nothing unless telemetry is possible AND
 * the user has opted in. The payload is a bare event name plus coarse,
 * non-identifying context (anonymous install id, app version, OS, locale) — no
 * terminal content, command text, prompts, or personal data.
 */
export function trackEvent(event: TelemetryEvent, options: { oncePerRun?: boolean } = {}): void {
  if (!isTelemetryPossible()) return
  const settings = currentSettings
  if (!settings?.enabled) return
  if (options.oncePerRun) {
    if (sentThisRun.has(event)) return
    sentThisRun.add(event)
  }
  void send(event, settings.installId)
}

async function send(event: TelemetryEvent, installId: string): Promise<void> {
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event,
        installId,
        appVersion: app.getVersion(),
        os: process.platform,
        locale: app.getLocale(),
        ts: new Date().toISOString()
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    })
  } catch {
    // Telemetry is best-effort and must never surface an error to the user.
  }
}
