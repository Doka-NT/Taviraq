import {
  buildLmStudioNativeUrl,
  buildOpenAICompatibleUrl,
  normalizeBaseUrl,
  parseLmStudioNativeModelList,
  parseModelList
} from '@main/utils/provider'

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

  it('builds LM Studio native URLs', () => {
    expect(buildLmStudioNativeUrl('http://localhost:1234', 'chat')).toBe('http://localhost:1234/api/v1/chat')
    expect(buildLmStudioNativeUrl('http://localhost:1234/api/v1', 'models')).toBe('http://localhost:1234/api/v1/models')
    expect(buildLmStudioNativeUrl('http://localhost:1234/v1', 'chat')).toBe('http://localhost:1234/api/v1/chat')
  })

  it('parses LM Studio native LLM models', () => {
    expect(parseLmStudioNativeModelList({
      models: [
        { type: 'embedding', key: 'embed', publisher: 'nomic' },
        { type: 'llm', key: 'z-model', publisher: 'vendor' },
        { type: 'llm', key: 'a-model' }
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
