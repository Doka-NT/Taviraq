import { cleanCommandOutput } from '@renderer/utils/commandOutput'
import { buildAgentContinuation, wasTerminalContextSentToProvider } from '@renderer/utils/agentContinuation'
import { formatComposerContextChars, latestMaskedSecretCount } from '@renderer/utils/composerContext'

describe('LlmPanel command output cleanup', () => {
  it('strips PTY echo when a secret placeholder was resolved before execution', () => {
    const command = 'curl -H "Authorization: Bearer [[TAVIRAQ_SECRET_1_BEARER_TOKEN]]" https://example.test'
    const output = [
      'curl -H "Authorization: Bearer token-ABC1234567890_token-ABC1234567890" https://example.test',
      '{"ok":true}',
      '$ '
    ].join('\n')

    expect(cleanCommandOutput(command, output)).toBe('{"ok":true}')
  })

  it('withholds command output from provider continuation in strict mode', () => {
    const command = 'curl -H "Authorization: Bearer token-ABC1234567890_token-ABC1234567890" https://example.test'
    const output = 'SECRET_TOKEN=abc1234567890abc1234567890'
    const continuation = buildAgentContinuation(command, output, true)

    expect(continuation).toContain('strict terminal context')
    expect(continuation).not.toContain(command)
    expect(continuation).not.toContain(output)
  })

  it('marks strict command output as hidden from provider for display labels', () => {
    const strictContinuation = buildAgentContinuation('ps aux', 'secret output', true)
    const regularContinuation = buildAgentContinuation('pwd', '/Users/artem', false)

    expect(wasTerminalContextSentToProvider(strictContinuation)).toBe(false)
    expect(wasTerminalContextSentToProvider(regularContinuation)).toBe(true)
    expect(wasTerminalContextSentToProvider(regularContinuation, false)).toBe(false)
  })

  it('formats composer context size compactly', () => {
    expect(formatComposerContextChars(0)).toBe('0')
    expect(formatComposerContextChars(999)).toBe('999')
    expect(formatComposerContextChars(12_040)).toBe('12k')
    expect(formatComposerContextChars(12_560)).toBe('12.6k')
  })

  it('uses the latest privacy status for composer masked secret count', () => {
    expect(latestMaskedSecretCount([
      { display: 'privacy-status', output: '2' },
      { display: 'system-status', output: 'not a privacy marker' },
      { display: 'privacy-status', output: '5' }
    ])).toBe(5)
    expect(latestMaskedSecretCount([{ display: 'privacy-status', output: 'bad' }])).toBe(0)
  })
})
