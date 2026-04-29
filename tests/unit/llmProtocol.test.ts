import { parseChatCompletionChunk, parseSseLines } from '@main/utils/llmProtocol'

describe('LLM protocol parsing', () => {
  it('extracts SSE data events and remainder', () => {
    const parsed = parseSseLines('data: {"a":1}\n\ndata: [DONE]\n\ndata: partial')
    expect(parsed.events).toEqual(['{"a":1}', '[DONE]'])
    expect(parsed.remainder).toBe('data: partial')
  })

  it('extracts streamed chat content', () => {
    expect(parseChatCompletionChunk({
      choices: [
        {
          delta: {
            content: 'hello'
          }
        }
      ]
    })).toEqual({ content: 'hello' })
  })
})
