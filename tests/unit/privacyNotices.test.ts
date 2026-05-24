import { mergePrivacyNotices } from '@renderer/utils/privacyNotices'

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
})
