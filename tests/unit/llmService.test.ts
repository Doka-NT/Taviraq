import type { CommandRiskAssessmentRequest } from '@shared/types'
import type * as SecretMaskingModule from '@main/utils/secretMasking'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('@main/services/secretStore', () => ({
  getApiKey: vi.fn().mockResolvedValue(undefined)
}))

describe('llmService', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.doUnmock('@main/utils/secretMasking')
    vi.resetModules()
  })

  it('times out command safety checks so the renderer can ask for confirmation', async () => {
    vi.doMock('@main/utils/secretMasking', async () => {
      const actual = await vi.importActual<typeof SecretMaskingModule>('@main/utils/secretMasking')
      return {
        ...actual,
        maskCommandRiskAssessmentRequest: vi.fn((request: CommandRiskAssessmentRequest) => Promise.resolve({
          request,
          context: actual.createSecretMaskContext()
        }))
      }
    })
    vi.useFakeTimers()

    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    }))

    const { assessCommandRisk } = await import('@main/services/llmService')
    const request: CommandRiskAssessmentRequest = {
      provider: {
        name: 'test',
        baseUrl: 'https://example.test',
        apiKeyRef: 'test',
        commandRiskModel: 'safety-model'
      },
      command: 'journalctl --vacuum-size=100M',
      context: {
        selectedText: '',
        assistMode: 'agent'
      }
    }

    const result = expect(assessCommandRisk(request)).rejects.toThrow('Command safety check timed out')
    await vi.advanceTimersByTimeAsync(15_000)

    await result
  })

  it('masks outbound chat payloads and redacts streamed assistant chunks locally', async () => {
    const secret = 'secret-value-ABC123_secret-value-ABC123'
    const placeholder = '[[TAVIRAQ_SECRET_1_GENERIC_API_KEY]]'
    const tempDir = await mkdtemp(join(tmpdir(), 'taviraq-gitleaks-test-'))
    const fakeGitleaks = join(tempDir, 'gitleaks')
    await writeFile(fakeGitleaks, [
      '#!/bin/sh',
      'cat >/dev/null',
      `printf '%s' '${JSON.stringify([{ RuleID: 'generic-api-key', Secret: secret, Match: `OPENAI_API_KEY=${secret}` }])}'`
    ].join('\n'), 'utf8')
    await chmod(fakeGitleaks, 0o755)
    vi.stubEnv('TAVIRAQ_GITLEAKS_PATH', fakeGitleaks)

    const encoder = new TextEncoder()
    let requestBody = ''
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit): Promise<Response> => {
      requestBody = typeof init?.body === 'string' ? init.body : ''
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: {"choices":[{"delta":{"content":"Use ${placeholder}"}}]}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }), { status: 200, statusText: 'OK' }))
    }))

    const { streamChatCompletion } = await import('@main/services/llmService')
    const chunks: string[] = []
    const privacy: number[] = []
    const result = await streamChatCompletion({
      requestId: 'request-1',
      provider: {
        name: 'test',
        baseUrl: 'https://example.test',
        apiKeyRef: 'test',
        selectedModel: 'chat-model'
      },
      messages: [
        { role: 'user', content: `OPENAI_API_KEY=${secret}` }
      ],
      context: {
        selectedText: '',
        assistMode: 'read'
      }
    }, (event) => {
      if (event.type === 'privacy' && typeof event.maskedSecrets === 'number') privacy.push(event.maskedSecrets)
      if (event.content) chunks.push(event.content)
    })

    expect(privacy).toEqual([1])
    expect(requestBody).not.toContain(secret)
    expect(requestBody).toContain(placeholder)
    expect(chunks.join('')).toBe('Use [secret]')
    expect(result.maskedContent).toBe(`Use ${placeholder}`)

    await rm(tempDir, { recursive: true, force: true })
  })

  it('does not scan or mask outbound chat payloads when masking is off', async () => {
    const secret = 'secret-value-ABC123_secret-value-ABC123'
    const encoder = new TextEncoder()
    let requestBody = ''
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit): Promise<Response> => {
      requestBody = typeof init?.body === 'string' ? init.body : ''
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        }
      }), { status: 200, statusText: 'OK' }))
    }))

    const { streamChatCompletion } = await import('@main/services/llmService')
    const privacy: number[] = []
    const result = await streamChatCompletion({
      requestId: 'request-off',
      provider: {
        name: 'test',
        baseUrl: 'https://example.test',
        apiKeyRef: 'test',
        selectedModel: 'chat-model'
      },
      messages: [
        { role: 'user', content: `OPENAI_API_KEY=${secret}` }
      ],
      context: {
        selectedText: '',
        assistMode: 'read'
      }
    }, (event) => {
      if (event.type === 'privacy' && typeof event.maskedSecrets === 'number') privacy.push(event.maskedSecrets)
    }, undefined, 'off')

    expect(privacy).toEqual([])
    expect(requestBody).toContain(secret)
    expect(result.maskedSecretCount).toBe(0)
    expect(result.secretContext.bindings).toHaveLength(0)
  })
})
