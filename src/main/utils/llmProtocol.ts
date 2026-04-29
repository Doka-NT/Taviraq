export interface ChatCompletionChunk {
  content: string
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

  const content = (delta as { content?: unknown }).content
  return typeof content === 'string' ? { content } : undefined
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
