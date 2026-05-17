import {
  buildAnthropicUrl,
  buildLmStudioNativeUrl,
  buildOllamaNativeUrl,
  buildOpenAICompatibleUrl,
  normalizeBaseUrl,
  parseAnthropicModelList,
  parseLmStudioNativeModelList,
  parseModelList,
  parseOllamaNativeModelList
} from '@main/utils/provider'

describe('provider utilities', () => {
  it('normalizes compatible base URLs', () => {
    expect(normalizeBaseUrl(' https://api.openai.com/v1/ ')).toBe('https://api.openai.com/v1')
    expect(buildOpenAICompatibleUrl('https://example.test', 'models')).toBe('https://example.test/v1/models')
    expect(buildOpenAICompatibleUrl('https://example.test/api/v1', 'models')).toBe('https://example.test/api/v1/models')
    expect(buildOpenAICompatibleUrl('https://api.edenai.run/v3', 'chat/completions')).toBe('https://api.edenai.run/v3/chat/completions')
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

  it('builds Anthropic native URLs', () => {
    expect(buildAnthropicUrl('https://api.anthropic.com', 'messages')).toBe('https://api.anthropic.com/v1/messages')
    expect(buildAnthropicUrl('https://api.anthropic.com/v1', 'models')).toBe('https://api.anthropic.com/v1/models')
    expect(buildAnthropicUrl('https://proxy.example.test/anthropic/v1/messages', 'models')).toBe('https://proxy.example.test/anthropic/v1/models')
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

  it('parses Anthropic models', () => {
    expect(parseAnthropicModelList({
      data: [
        { id: 'claude-z-20260101', display_name: 'Claude Z' },
        { id: 'claude-a-20260101', display_name: 'Claude A' },
        { type: 'model' }
      ]
    })).toEqual([
      { id: 'claude-a-20260101', ownedBy: 'Claude A' },
      { id: 'claude-z-20260101', ownedBy: 'Claude Z' }
    ])
  })

  it('rejects malformed model lists', () => {
    expect(() => parseModelList({ data: {} })).toThrow(/array/)
    expect(() => parseAnthropicModelList({ data: {} })).toThrow(/array/)
  })
})
