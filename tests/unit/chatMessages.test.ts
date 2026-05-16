import { stripTrailingAssistantMessages } from '@renderer/utils/chatMessages'
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
})
