import type { ChatMessage } from '@shared/types'

export function stripTrailingAssistantMessages<T extends Pick<ChatMessage, 'role'>>(messages: T[]): T[] {
  let end = messages.length

  while (end > 0 && messages[end - 1].role === 'assistant') {
    end -= 1
  }

  return messages.slice(0, end)
}
