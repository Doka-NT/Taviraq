import type { TelemetryConsentDecision, TelemetryEvent, TelemetrySettings } from './types'

/**
 * The complete set of aggregate activation-funnel events Taviraq may emit.
 * Each event is a bare signal — it never carries terminal content, command
 * text, prompts, or any other payload.
 */
export const TELEMETRY_EVENTS: readonly TelemetryEvent[] = [
  'app_first_run',
  'app_opened',
  'session_started',
  'ai_request_sent',
  'provider_configured',
  'ai_response_received',
  'ai_request_failed'
]

function normalizeConsentDecision(value: unknown): TelemetryConsentDecision {
  return value === 'granted' || value === 'denied' ? value : 'pending'
}

/**
 * Build a fresh, default-off telemetry settings object. `generateInstallId`
 * supplies the anonymous identifier (node `randomUUID` in the main process).
 */
export function createDefaultTelemetrySettings(generateInstallId: () => string): TelemetrySettings {
  return {
    enabled: false,
    consentDecision: 'pending',
    installId: generateInstallId()
  }
}

/**
 * Normalize untrusted/persisted telemetry settings. `enabled` is forced false
 * unless the user has explicitly granted consent, so a malformed or tampered
 * config can never silently turn telemetry on. A missing/blank `installId` is
 * regenerated so the field is always a stable anonymous value.
 */
export function normalizeTelemetrySettings(
  value: unknown,
  generateInstallId: () => string
): TelemetrySettings {
  const record = value && typeof value === 'object' ? (value as Partial<TelemetrySettings>) : {}
  const consentDecision = normalizeConsentDecision(record.consentDecision)
  const installId =
    typeof record.installId === 'string' && record.installId.trim()
      ? record.installId.trim()
      : generateInstallId()

  const settings: TelemetrySettings = {
    enabled: record.enabled === true && consentDecision === 'granted',
    consentDecision,
    installId
  }

  if (typeof record.consentedAt === 'string' && record.consentedAt.trim()) {
    settings.consentedAt = record.consentedAt
  }

  return settings
}
