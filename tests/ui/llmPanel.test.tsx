import { cleanCommandOutput } from '@renderer/utils/commandOutput'
import { buildAgentContinuation, wasTerminalContextSentToProvider } from '@renderer/utils/agentContinuation'
import { estimateComposerContextTokens, formatComposerContextTokens } from '@renderer/utils/composerContext'

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

  it('estimates composer context tokens from payload characters', () => {
    expect(estimateComposerContextTokens(0)).toBe(0)
    expect(estimateComposerContextTokens(1)).toBe(1)
    expect(estimateComposerContextTokens(78_000)).toBe(19_500)
  })

  it('formats composer context tokens compactly', () => {
    expect(formatComposerContextTokens(0)).toBe('0')
    expect(formatComposerContextTokens(999)).toBe('999')
    expect(formatComposerContextTokens(1000)).toBe('1k')
    expect(formatComposerContextTokens(12_040)).toBe('12k')
    expect(formatComposerContextTokens(12_560)).toBe('12.6k')
  })
})
