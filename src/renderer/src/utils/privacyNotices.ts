import type { PrivacyMaskingNotice } from '@shared/types'

interface PrivacyNoticeCarrier {
  role?: string
  display?: string
  privacy?: PrivacyMaskingNotice
}

export function mergePrivacyNotices(
  existing: PrivacyMaskingNotice,
  incoming: PrivacyMaskingNotice
): PrivacyMaskingNotice {
  const sessionLabel = existing.sessionLabel && incoming.sessionLabel
    ? existing.sessionLabel === incoming.sessionLabel ? existing.sessionLabel : undefined
    : incoming.sessionLabel ?? existing.sessionLabel

  const merged: PrivacyMaskingNotice = {
    maskedSecretCount: Math.max(existing.maskedSecretCount, incoming.maskedSecretCount),
    categories: [...new Set([...existing.categories, ...incoming.categories])],
    source: incoming.source,
    scope: incoming.scope
  }

  if (sessionLabel) {
    merged.sessionLabel = sessionLabel
  }

  return merged
}

export function findCurrentRequestPrivacyNoticeIndex<T extends PrivacyNoticeCarrier>(
  messages: T[]
): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role === 'user') break
    if (message.privacy && (message.role === 'assistant' || message.display === 'privacy-status')) {
      return index
    }
  }

  return -1
}
