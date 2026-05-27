import { findCurrentRequestPrivacyNoticeIndex, mergePrivacyNotices } from '@renderer/utils/privacyNotices'
import type { PrivacyMaskingNotice } from '@shared/types'

interface TestMessage {
  role: string
  content: string
  display?: string
  privacy?: PrivacyMaskingNotice
}

describe('privacy notice aggregation', () => {
  it('keeps the latest cumulative count in one inspectable notice', () => {
    const notice = mergePrivacyNotices({
      maskedSecretCount: 1,
      categories: ['GENERIC_API_KEY'],
      source: 'chat-stream',
      scope: 'provider-payload',
      sessionLabel: 'Local'
    }, {
      maskedSecretCount: 2,
      categories: ['password', 'GENERIC_API_KEY'],
      source: 'chat-display',
      scope: 'chat-display',
      sessionLabel: 'SSH'
    })

    expect(notice).toEqual({
      maskedSecretCount: 2,
      categories: ['GENERIC_API_KEY', 'password'],
      source: 'chat-display',
      scope: 'chat-display'
    })
  })

  it('finds the current request privacy notice across tool messages', () => {
    const messages: TestMessage[] = [
      { role: 'user', content: 'Run a masked tool' },
      {
        role: 'assistant',
        content: '1 secret masked',
        display: 'privacy-status',
        privacy: {
          maskedSecretCount: 1,
          categories: ['GENERIC_API_KEY'],
          source: 'chat-stream',
          scope: 'provider-payload'
        }
      },
      { role: 'assistant', content: 'Calling MCP tool vault.read', display: 'tool-call' }
    ]

    expect(findCurrentRequestPrivacyNoticeIndex(messages)).toBe(1)
  })

  it('does not merge privacy notices across user requests', () => {
    const messages: TestMessage[] = [
      {
        role: 'assistant',
        content: '1 secret masked',
        display: 'privacy-status',
        privacy: {
          maskedSecretCount: 1,
          categories: ['GENERIC_API_KEY'],
          source: 'chat-stream',
          scope: 'provider-payload'
        }
      },
      { role: 'user', content: 'Start another request' },
      { role: 'assistant', content: 'Calling MCP tool vault.read', display: 'tool-call' }
    ]

    expect(findCurrentRequestPrivacyNoticeIndex(messages)).toBe(-1)
  })
})
