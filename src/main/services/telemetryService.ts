// SPDX-License-Identifier: MPL-2.0
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
 * Once-per-run events that fired while consent was still pending. They are held
 * (not sent) and replayed if and only if the user later opts in, so the
 * first-run onboarding flow still produces its funnel signals; cleared on denial.
 */
const pendingPreConsent = new Map<TelemetryEvent, Record<string, string | number> | undefined>()

/**
 * Telemetry is only ever active in a packaged macOS *release* build that has a
 * configured Aptabase key. Dev runs, local/unsigned packages (version `0.0.0`),
 * and key-less builds can never emit.
 */
function isTelemetryPossible(): boolean {
  return app.isPackaged && app.getVersion() !== DEV_VERSION && APP_KEY !== ''
}

/**
 * Whether opted-in events can actually be sent in this build/runtime. The
 * renderer uses this so the Settings toggle never shows an active "sharing"
 * state when telemetry can't really emit (dev, unsigned, or key-less builds).
 */
export function isTelemetryActive(): boolean {
  return isTelemetryPossible()
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
export function trackEvent(
  event: TelemetryEvent,
  options: { oncePerRun?: boolean; props?: Record<string, string | number> } = {}
): void {
  if (!isTelemetryPossible() || !initialized) return
  if (!currentSettings?.enabled) {
    // While consent is still pending, hold once-per-run events so they can be
    // replayed on opt-in. After an explicit denial, hold nothing.
    const pending = !currentSettings || currentSettings.consentDecision === 'pending'
    if (pending && options.oncePerRun && !sentThisRun.has(event) && !pendingPreConsent.has(event)) {
      pendingPreConsent.set(event, options.props)
    }
    return
  }
  if (options.oncePerRun) {
    if (sentThisRun.has(event)) return
    sentThisRun.add(event)
  }
  // Props, when present, are low-cardinality enums only (e.g. an error class) —
  // never content, free text, or identifiers.
  void aptabaseTrackEvent(event, options.props)
}

/** Replay events that were held while consent was pending. Call after opt-in. */
export function flushPendingEvents(): void {
  if (!isTelemetryPossible() || !initialized || !currentSettings?.enabled) {
    pendingPreConsent.clear()
    return
  }
  for (const [event, props] of pendingPreConsent) {
    if (sentThisRun.has(event)) continue
    sentThisRun.add(event)
    void aptabaseTrackEvent(event, props)
  }
  pendingPreConsent.clear()
}

/** Drop any held pre-consent events (e.g. after the user declines). */
export function clearPendingEvents(): void {
  pendingPreConsent.clear()
}
