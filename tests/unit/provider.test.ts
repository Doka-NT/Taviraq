import {
  buildLmStudioNativeUrl,
  buildOllamaNativeUrl,
  buildOpenAICompatibleUrl,
  normalizeBaseUrl,
  parseLmStudioNativeModelList,
  parseModelList,
  parseOllamaNativeModelList
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

  it('builds Ollama native URLs', () => {
    expect(buildOllamaNativeUrl('http://localhost:11434', 'chat')).toBe('http://localhost:11434/api/chat')
    expect(buildOllamaNativeUrl('http://localhost:11434/api', 'tags')).toBe('http://localhost:11434/api/tags')
    expect(buildOllamaNativeUrl('http://localhost:11434/api/tags', 'chat')).toBe('http://localhost:11434/api/chat')
    expect(buildOllamaNativeUrl('http://localhost:11434/v1', 'chat')).toBe('http://localhost:11434/api/chat')
  })

  it('parses Ollama native models', () => {
    expect(parseOllamaNativeModelList({
      models: [
        { model: 'z-model:latest' },
        { name: 'a-model:latest' },
        { digest: 'missing-model-name' }
      ]
    })).toEqual([
      { id: 'a-model:latest', ownedBy: 'ollama' },
      { id: 'z-model:latest', ownedBy: 'ollama' }
    ])
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
