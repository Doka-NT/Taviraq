import { cleanCommandOutput } from '@renderer/utils/commandOutput'
import { buildAgentContinuation } from '@renderer/utils/agentContinuation'

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
    const output = 'SECRET_TOKEN=abc1234567890abc1234567890'
    const continuation = buildAgentContinuation('printenv', output, true)

    expect(continuation).toContain('strict terminal context')
    expect(continuation).not.toContain(output)
  })
})
