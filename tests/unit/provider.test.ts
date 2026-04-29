import { buildOpenAICompatibleUrl, normalizeBaseUrl, parseModelList } from '@main/utils/provider'

describe('provider utilities', () => {
  it('normalizes compatible base URLs', () => {
    expect(normalizeBaseUrl(' https://api.openai.com/v1/ ')).toBe('https://api.openai.com')
    expect(buildOpenAICompatibleUrl('https://example.test/api/v1', 'models')).toBe('https://example.test/api/v1/models')
  })

  it('parses and sorts model lists', () => {
    expect(parseModelList({
      data: [
        { id: 'z-model', owned_by: 'vendor' },
        { id: 'a-model' },
        { object: 'model' }
      ]
    })).toEqual([
      { id: 'a-model', ownedBy: undefined },
      { id: 'z-model', ownedBy: 'vendor' }
    ])
  })

  it('rejects malformed model lists', () => {
    expect(() => parseModelList({ data: {} })).toThrow(/array/)
  })
})
