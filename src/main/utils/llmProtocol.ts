export interface ChatCompletionChunk {
  content?: string
  reasoningContent?: string
}

export function parseChatCompletionChunk(payload: unknown): ChatCompletionChunk | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined
  }

  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined
  }

  const delta = (choices[0] as { delta?: unknown }).delta
  if (!delta || typeof delta !== 'object') {
    return undefined
  }

  const content = readDeltaText(delta, ['content'])
  const reasoningContent = readDeltaText(delta, [
    'reasoning_content',
    'reasoning',
    'thinking_content',
    'thinking'
  ])

  if (!content && !reasoningContent) return undefined
  return { content, reasoningContent }
}

function readDeltaText(delta: object, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = (delta as Record<string, unknown>)[key]
    if (typeof value === 'string') return value
    if (Array.isArray(value)) {
      const text = value
        .map((part) => {
          if (typeof part === 'string') return part
          if (!part || typeof part !== 'object') return ''
          const text = (part as { text?: unknown }).text
          return typeof text === 'string' ? text : ''
        })
        .join('')
      if (text) return text
    }
  }
  return undefined
}

export function parseSseLines(buffer: string): { events: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const remainder = parts.pop() ?? ''

  return {
    events: parts
      .map((event) =>
        event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
      )
      .filter(Boolean),
    remainder
  }
}
