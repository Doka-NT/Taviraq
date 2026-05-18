interface ComposerPrivacyMessage {
  display?: 'command-output' | 'system-status' | 'privacy-status'
  output?: string
}

export function formatComposerContextChars(count: number): string {
  if (count >= 1000) {
    const rounded = Math.round(count / 100) / 10
    return `${Number.isInteger(rounded) ? Math.trunc(rounded) : rounded}k`
  }

  return String(Math.max(0, count))
}

export function latestMaskedSecretCount(messages: ComposerPrivacyMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message.display !== 'privacy-status') continue
    const count = Number(message.output)
    return Number.isFinite(count) && count > 0 ? count : 0
  }

  return 0
}
