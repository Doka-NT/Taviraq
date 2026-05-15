import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addSecretFindingsToContext,
  containsSecretPlaceholder,
  createContextFromTexts,
  createSecretMaskContext,
  createStreamingPlaceholderRedactor,
  createStreamingUnmasker,
  displaySecretPlaceholders,
  findSupplementalStrictSecrets,
  maskTextForDisplay,
  maskText,
  parseGitleaksReport,
  resolveSecretPlaceholders,
  sanitizeSavedChatForStorage,
  unmaskText
} from '@main/utils/secretMasking'

afterEach(() => {
  vi.doUnmock('node:fs/promises')
  vi.resetModules()
})

describe('secret masking utilities', () => {
  it('parses gitleaks JSON findings', () => {
    const findings = parseGitleaksReport(JSON.stringify([
      {
        RuleID: 'github-pat',
        Description: 'GitHub Personal Access Token',
        Secret: 'ghp_0123456789abcdefghijklmnopqrstuvwxyzABCD',
        Match: 'GITHUB_TOKEN=ghp_0123456789abcdefghijklmnopqrstuvwxyzABCD'
      }
    ]))

    expect(findings).toEqual([
      {
        ruleId: 'github-pat',
        description: 'GitHub Personal Access Token',
        secret: 'ghp_0123456789abcdefghijklmnopqrstuvwxyzABCD',
        match: 'GITHUB_TOKEN=ghp_0123456789abcdefghijklmnopqrstuvwxyzABCD'
      }
    ])
  })

  it('deduplicates secrets and restores masked text', () => {
    const context = createSecretMaskContext()
    addSecretFindingsToContext(context, [
      { ruleId: 'generic-api-key', secret: 'sk-live-ABCdef1234567890_ABCdef1234567890' },
      { ruleId: 'generic-api-key', secret: 'sk-live-ABCdef1234567890_ABCdef1234567890' }
    ])

    const input = [
      'OPENAI_API_KEY=sk-live-ABCdef1234567890_ABCdef1234567890',
      'again sk-live-ABCdef1234567890_ABCdef1234567890'
    ].join('\n')
    const masked = maskText(input, context)

    expect(context.bindings).toHaveLength(1)
    expect(masked).not.toContain('sk-live-ABCdef1234567890_ABCdef1234567890')
    expect(masked).toContain('[[TAVIRAQ_SECRET_1_GENERIC_API_KEY]]')
    expect(unmaskText(masked, context)).toBe(input)
  })

  it('replaces longer overlapping secrets first', () => {
    const context = createSecretMaskContext()
    addSecretFindingsToContext(context, [
      { ruleId: 'short-token', secret: 'abc12345' },
      { ruleId: 'long-token', secret: 'abc12345-SECRET-67890' }
    ])

    expect(maskText('value=abc12345-SECRET-67890', context)).toBe('value=[[TAVIRAQ_SECRET_2_LONG_TOKEN]]')
  })

  it('finds contextual high-entropy values without flagging git SHAs', () => {
    const findings = findSupplementalStrictSecrets([
      'DEPLOY_TOKEN=AbCdEf1234567890_AbCdEf1234567890',
      'COMMIT=2df91d10f0802b5eb69f93333bf3b64b98003113'
    ].join('\n'))

    expect(findings.map((finding) => finding.secret)).toEqual(['AbCdEf1234567890_AbCdEf1234567890'])
  })

  it('does not flag long filesystem paths as contextual secrets', () => {
    const findings = findSupplementalStrictSecrets([
      'TOKEN_PATH=/Users/artem/AbCdEf1234567890_AbCdEf1234567890',
      'PASSWORD_FILE=~/secrets/AbCdEf1234567890_AbCdEf1234567890',
      'API_KEY=C:\\Users\\artem\\AbCdEf1234567890_AbCdEf1234567890',
      'SECRET=\\\\server\\share\\AbCdEf1234567890_AbCdEf1234567890'
    ].join('\n'))

    expect(findings).toHaveLength(0)
  })

  it('falls back to contextual checks when gitleaks is unavailable', async () => {
    vi.doMock('node:fs/promises', () => ({
      access: vi.fn().mockRejectedValue(new Error('missing gitleaks'))
    }))
    vi.resetModules()

    const { scanTextForSecrets } = await import('@main/utils/secretMasking')
    const findings = await scanTextForSecrets('DEPLOY_TOKEN=AbCdEf1234567890_AbCdEf1234567890', 'on')

    expect(findings.map((finding) => finding.secret)).toContain('AbCdEf1234567890_AbCdEf1234567890')
  })

  it('skips scanner work when masking mode is off', async () => {
    const context = await createContextFromTexts([
      'OPENAI_API_KEY=sk-live-ABCdef1234567890_ABCdef1234567890'
    ], 'off')

    expect(context.bindings).toHaveLength(0)
  })

  it('unmasks placeholders split across stream chunks', () => {
    const context = createSecretMaskContext()
    addSecretFindingsToContext(context, [
      { ruleId: 'generic-token', secret: 'secret-value-ABC123_secret-value-ABC123' }
    ])
    const unmasker = createStreamingUnmasker(context)
    const chunks = [
      unmasker.push('token [[TAVIRAQ_SEC'),
      unmasker.push('RET_1_GENERIC_TOKEN]] ok'),
      unmasker.flush()
    ]

    expect(chunks.join('')).toBe('token secret-value-ABC123_secret-value-ABC123 ok')
  })

  it('redacts placeholders split across stream chunks', () => {
    const redactor = createStreamingPlaceholderRedactor()
    const chunks = [
      redactor.push('token [[TAVIRAQ_SEC'),
      redactor.push('RET_1_GENERIC_TOKEN]] ok'),
      redactor.flush()
    ]

    expect(chunks.join('')).toBe('token [secret] ok')
  })

  it('resolves placeholders for confirmed local execution', () => {
    const context = createSecretMaskContext()
    addSecretFindingsToContext(context, [
      { ruleId: 'bearer-token', secret: 'token-ABC1234567890_token-ABC1234567890' }
    ])
    const command = 'curl -H "Authorization: Bearer [[TAVIRAQ_SECRET_1_BEARER_TOKEN]]" https://example.test'

    expect(containsSecretPlaceholder(command)).toBe(true)
    expect(resolveSecretPlaceholders(command, context)).toContain('token-ABC1234567890_token-ABC1234567890')
  })

  it('extends an existing context without reusing old placeholder ids', async () => {
    const existing = createSecretMaskContext()
    addSecretFindingsToContext(existing, [
      { ruleId: 'generic-api-key', secret: 'sk-live-ABCdef1234567890_ABCdef1234567890' }
    ])

    const next = await createContextFromTexts([
      'DEPLOY_TOKEN=DeployABC1234567890_DeployABC1234567890'
    ], 'on', undefined, existing)

    expect(next.bindings.map((binding) => binding.placeholder)).toEqual([
      '[[TAVIRAQ_SECRET_1_GENERIC_API_KEY]]',
      '[[TAVIRAQ_SECRET_2_DEPLOY_TOKEN]]'
    ])
    expect(resolveSecretPlaceholders('[[TAVIRAQ_SECRET_1_GENERIC_API_KEY]]', next))
      .toBe('sk-live-ABCdef1234567890_ABCdef1234567890')
    expect(resolveSecretPlaceholders('[[TAVIRAQ_SECRET_2_DEPLOY_TOKEN]]', next))
      .toBe('DeployABC1234567890_DeployABC1234567890')
  })

  it('masks real secret values in command output for display', () => {
    const context = createSecretMaskContext()
    addSecretFindingsToContext(context, [
      { ruleId: 'generic-api-key', secret: 'sk-live-ABCdef1234567890_ABCdef1234567890' }
    ])

    const output = displaySecretPlaceholders(maskText(
      'token sk-live-ABCdef1234567890_ABCdef1234567890',
      context
    ))

    expect(output).toBe('token [secret]')
  })

  it('scans command output for new secrets before displaying it', async () => {
    const existing = createSecretMaskContext()
    addSecretFindingsToContext(existing, [
      { ruleId: 'generic-api-key', secret: 'sk-live-ABCdef1234567890_ABCdef1234567890' }
    ])

    const result = await maskTextForDisplay([
      'OPENAI_API_KEY=sk-live-ABCdef1234567890_ABCdef1234567890',
      'DEPLOY_TOKEN=DeployABC1234567890_DeployABC1234567890'
    ].join('\n'), 'on', existing)

    expect(result.text).toBe([
      'OPENAI_API_KEY=[secret]',
      'DEPLOY_TOKEN=[secret]'
    ].join('\n'))
    expect(result.context.bindings.map((binding) => binding.placeholder)).toEqual([
      '[[TAVIRAQ_SECRET_1_GENERIC_API_KEY]]',
      '[[TAVIRAQ_SECRET_2_DEPLOY_TOKEN]]'
    ])
    expect(resolveSecretPlaceholders('[[TAVIRAQ_SECRET_2_DEPLOY_TOKEN]]', result.context))
      .toBe('DeployABC1234567890_DeployABC1234567890')
  })

  it('redacts raw scanned secrets before saving chat history', async () => {
    const secret = 'sk-live-ABCdef1234567890_ABCdef1234567890'
    const sanitized = await sanitizeSavedChatForStorage({
      id: 'chat-1',
      title: `OPENAI_API_KEY=${secret}`,
      messages: [
        {
          role: 'user',
          content: `OPENAI_API_KEY=${secret}`
        },
        {
          role: 'assistant',
          content: 'done',
          output: `token ${secret}`,
          reasoningContent: `saw ${secret}`
        }
      ],
      createdAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z'
    }, 'on')

    expect(JSON.stringify(sanitized)).not.toContain(secret)
    expect(sanitized.title).toBe('OPENAI_API_KEY=[secret]')
    expect(sanitized.messages[0].content).toBe('OPENAI_API_KEY=[secret]')
    expect(sanitized.messages[1].output).toBe('token [secret]')
    expect(sanitized.messages[1].reasoningContent).toBe('saw [secret]')
  })
})
