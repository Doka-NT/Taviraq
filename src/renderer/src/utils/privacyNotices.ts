import type { PrivacyMaskingNotice } from '@shared/types'

export function mergePrivacyNotices(
  existing: PrivacyMaskingNotice,
  incoming: PrivacyMaskingNotice
): PrivacyMaskingNotice {
  const sessionLabel = existing.sessionLabel && incoming.sessionLabel
    ? existing.sessionLabel === incoming.sessionLabel ? existing.sessionLabel : undefined
    : incoming.sessionLabel ?? existing.sessionLabel

  return {
    maskedSecretCount: existing.maskedSecretCount + incoming.maskedSecretCount,
    categories: [...new Set([...existing.categories, ...incoming.categories])],
    source: incoming.source,
    scope: incoming.scope,
    sessionLabel
  }
}
