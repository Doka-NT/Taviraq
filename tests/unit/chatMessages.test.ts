import { applyAuthoritativeAssistantContent, stripTrailingAssistantMessages } from '@renderer/utils/chatMessages'
import type { ChatMessage } from '@shared/types'

describe('chat message utilities', () => {
  it('keeps histories that already end with a user message', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Check this command' },
      { role: 'assistant', content: 'Run npm test' },
      { role: 'user', content: 'Try again' }
    ]

    expect(stripTrailingAssistantMessages(messages)).toEqual(messages)
  })

  it('strips a trailing assistant message before regeneration', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Explain this error' },
      { role: 'assistant', content: 'The path is missing' }
    ]

    expect(stripTrailingAssistantMessages(messages)).toEqual([
      { role: 'user', content: 'Explain this error' }
    ])
  })

  it('strips consecutive trailing assistant messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Run the next step' },
      { role: 'assistant', content: 'Run npm test' },
      { role: 'assistant', content: 'Command edited before run' }
    ]

    expect(stripTrailingAssistantMessages(messages)).toEqual([
      { role: 'user', content: 'Run the next step' }
    ])
  })

  it('reconciles streamed assistant text with the authoritative final content', () => {
    const message = {
      role: 'assistant' as const,
      content: 'Извини, предыдущее сообщение слом. Перепиш:'
    }

    expect(applyAuthoritativeAssistantContent(
      message,
      'Извини, предыдущее сообщение сломалось. Перепишу:'
    )).toEqual({
      role: 'assistant',
      content: 'Извини, предыдущее сообщение сломалось. Перепишу:',
      maskedContent: undefined
    })
  })

  it('keeps masked final content for future provider turns while showing a redacted message', () => {
    const message = {
      role: 'assistant' as const,
      content: 'Use [secret]'
    }
    const authoritative = 'Use [[TAVIRAQ_SECRET_1_GENERIC_API_KEY]]'

    expect(applyAuthoritativeAssistantContent(message, authoritative)).toEqual({
      role: 'assistant',
      content: 'Use [secret]',
      maskedContent: authoritative
    })
  })

  it('does not apply final content to user messages', () => {
    const message = {
      role: 'user' as const,
      content: 'Original prompt'
    }

    expect(applyAuthoritativeAssistantContent(message, 'Different')).toBe(message)
  })
})
