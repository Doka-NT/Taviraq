const APPROX_CHARS_PER_CONTEXT_TOKEN = 4

export function estimateComposerContextTokens(charCount: number): number {
  return Math.ceil(Math.max(0, charCount) / APPROX_CHARS_PER_CONTEXT_TOKEN)
}

export function formatComposerContextTokens(tokenCount: number): string {
  if (tokenCount >= 1000) {
    const rounded = Math.round(tokenCount / 100) / 10
    return `${Number.isInteger(rounded) ? Math.trunc(rounded) : rounded}k`
  }

  return String(Math.max(0, tokenCount))
}
