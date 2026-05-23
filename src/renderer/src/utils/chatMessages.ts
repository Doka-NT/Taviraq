import type { ChatMessage } from '@shared/types'
import {
  DISPLAY_SECRET_LABEL,
  SECRET_PLACEHOLDER_GLOBAL_RE,
  SECRET_PLACEHOLDER_RE
} from '@shared/secretPlaceholders'

export function stripTrailingAssistantMessages<T extends Pick<ChatMessage, 'role'>>(messages: T[]): T[] {
  let end = messages.length

  while (end > 0 && messages[end - 1].role === 'assistant') {
    end -= 1
  }

  return messages.slice(0, end)
}

export function applyAuthoritativeAssistantContent<
  T extends Pick<ChatMessage, 'role' | 'content'> & { maskedContent?: string }
>(
  message: T,
  authoritativeMaskedContent: string | undefined,
  secretReplacement = DISPLAY_SECRET_LABEL
): T {
  if (message.role !== 'assistant' || !authoritativeMaskedContent) return message

  const hasSecretPlaceholders = SECRET_PLACEHOLDER_RE.test(authoritativeMaskedContent)
  return {
    ...message,
    content: authoritativeMaskedContent.replace(SECRET_PLACEHOLDER_GLOBAL_RE, secretReplacement),
    maskedContent: hasSecretPlaceholders ? authoritativeMaskedContent : undefined
  }
}
