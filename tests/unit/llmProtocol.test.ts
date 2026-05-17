import { parseAnthropicStreamEvent, parseChatCompletionChunk, parseSseEvents, parseSseLines } from '@main/utils/llmProtocol'

describe('LLM protocol parsing', () => {
  it('extracts SSE data events and remainder', () => {
    const parsed = parseSseLines('data: {"a":1}\n\ndata: [DONE]\n\ndata: partial')
    expect(parsed.events).toEqual(['{"a":1}', '[DONE]'])
    expect(parsed.remainder).toBe('data: partial')
  })

  it('extracts named SSE events', () => {
    const parsed = parseSseEvents('event: prompt_processing.progress\ndata: {"progress":0.5}\n\nevent: message.delta\ndata: {"content":"hi"}\n\n')
    expect(parsed.events).toEqual([
      { event: 'prompt_processing.progress', data: '{"progress":0.5}' },
      { event: 'message.delta', data: '{"content":"hi"}' }
    ])
    expect(parsed.remainder).toBe('')
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

  it('extracts Anthropic text deltas', () => {
    expect(parseAnthropicStreamEvent({
      event: 'content_block_delta',
      data: '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}'
    })).toEqual({ content: 'hi' })
  })

  it('throws Anthropic stream errors', () => {
    expect(() => parseAnthropicStreamEvent({
      event: 'error',
      data: '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}'
    })).toThrow('Overloaded')
  })
})
