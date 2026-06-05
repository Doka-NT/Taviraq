import { app } from 'electron'
import { initialize, trackEvent as aptabaseTrackEvent } from '@aptabase/electron/main'
import type { TelemetryEvent, TelemetrySettings } from '@shared/types'

/**
 * Placeholder version kept by dev and local/unsigned packages. Only the release
 * workflow stamps a real version from the tag, so this doubles as a "is this a
 * real release artifact" marker — telemetry never runs outside real releases.
 */
const DEV_VERSION = '0.0.0'

/**
 * Aptabase Cloud app key (e.g. `A-EU-1234567890`), baked in at build time via
 * electron-vite `define` (see `electron.vite.config.ts`). A packaged app
 * launched from Finder has no shell environment, so the key cannot be read from
 * `process.env` at runtime — it must be a compile-time constant. When unset
 * (the default), telemetry is a hard no-op: a build with no key configured
 * never initializes the SDK or sends anything. The `process.env` fallback only
 * applies under tests, where the `define` constant is not substituted.
 */
declare const __APTABASE_KEY__: string
const APP_KEY = (
  typeof __APTABASE_KEY__ !== 'undefined'
    ? __APTABASE_KEY__
    : process.env.TAVIRAQ_APTABASE_KEY ?? ''
).trim()

let currentSettings: TelemetrySettings | undefined
let initialized = false
/** Events already sent in this app run, for `oncePerRun` de-duplication. */
const sentThisRun = new Set<TelemetryEvent>()

/**
 * Telemetry is only ever active in a packaged macOS *release* build that has a
 * configured Aptabase key. Dev runs, local/unsigned packages (version `0.0.0`),
 * and key-less builds can never emit.
 */
function isTelemetryPossible(): boolean {
  return app.isPackaged && app.getVersion() !== DEV_VERSION && APP_KEY !== ''
}

/**
 * Initialize the Aptabase SDK once. Initialization on its own sends nothing —
 * only `trackEvent` does, and only after the user opts in. Safe to call early;
 * the SDK buffers any events until initialization resolves.
 */
export function setupTelemetry(): void {
  if (initialized || !isTelemetryPossible()) return
  initialized = true
  void initialize(APP_KEY)
}

/** Keep the main process's view of the user's consent/opt-in in sync. */
export function setTelemetrySettings(settings: TelemetrySettings | undefined): void {
  currentSettings = settings
}

/**
 * Emit an aggregate funnel event through Aptabase. Does nothing unless telemetry
 * is possible, the SDK is initialized, AND the user has opted in. Events carry
 * no properties — only the bare event name. Aptabase appends coarse,
 * non-identifying context (OS, app version, locale, an anonymous rotating
 * session) on its own; no terminal content, command text, prompts, persistent
 * install id, or personal data is ever sent.
 */
export function trackEvent(event: TelemetryEvent, options: { oncePerRun?: boolean } = {}): void {
  if (!isTelemetryPossible() || !initialized) return
  if (!currentSettings?.enabled) return
  if (options.oncePerRun) {
    if (sentThisRun.has(event)) return
    sentThisRun.add(event)
  }
  void aptabaseTrackEvent(event)
}
