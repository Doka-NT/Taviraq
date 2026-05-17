import type { ChatStreamRequest, CommandRiskAssessmentRequest } from '@shared/types'
import { getApiKey, getProxyPassword } from '@main/services/secretStore'

vi.mock('@main/services/secretStore', () => ({
  getApiKey: vi.fn().mockResolvedValue(undefined),
  getProxyPassword: vi.fn().mockResolvedValue(undefined)
}))

describe('llmService', () => {
  beforeEach(() => {
    vi.mocked(getApiKey).mockReset()
    vi.mocked(getProxyPassword).mockReset()
    vi.mocked(getApiKey).mockResolvedValue(undefined)
    vi.mocked(getProxyPassword).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('times out command safety checks so the renderer can ask for confirmation', async () => {
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

  it('lists Anthropic models with native headers', async () => {
    vi.mocked(getApiKey).mockResolvedValue('sk-ant-test')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [
          { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4' }
        ],
        has_more: true,
        last_id: 'claude-sonnet-4-20250514'
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [
          { id: 'claude-haiku-4-20250514', display_name: 'Claude Haiku 4' }
        ],
        has_more: false,
        last_id: 'claude-haiku-4-20250514'
      })))
    vi.stubGlobal('fetch', fetchMock)

    const { listModels } = await import('@main/services/llmService')
    const models = await listModels({
      name: 'Anthropic',
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKeyRef: 'anthropic'
    })

    expect(models).toEqual([
      { id: 'claude-haiku-4-20250514', ownedBy: 'Claude Haiku 4' },
      { id: 'claude-sonnet-4-20250514', ownedBy: 'Claude Sonnet 4' }
    ])
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/models?limit=1000')
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.anthropic.com/v1/models?limit=1000&after_id=claude-sonnet-4-20250514')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers.Authorization).toBeUndefined()
  })

  it('attaches an HTTP proxy dispatcher to provider requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    vi.stubGlobal('fetch', fetchMock)

    const { listModels } = await import('@main/services/llmService')
    await listModels({
      name: 'OpenAI Compatible',
      baseUrl: 'https://example.test',
      apiKeyRef: 'openai',
      proxyUrl: 'http://proxy.local:8080'
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit & { dispatcher?: { constructor?: { name?: string } } }
    expect(init.dispatcher?.constructor?.name).toBe('ProxyAgent')
  })

  it('loads proxy passwords from the keychain when proxy auth is configured', async () => {
    vi.mocked(getProxyPassword).mockResolvedValue('secret-proxy-password')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    vi.stubGlobal('fetch', fetchMock)

    const { listModels } = await import('@main/services/llmService')
    await listModels({
      name: 'OpenAI Compatible',
      baseUrl: 'https://example.test',
      apiKeyRef: 'openai',
      proxyUrl: 'https://proxy.local:8443',
      proxyUsername: 'proxy-user',
      proxyPasswordRef: 'proxy-password:openai'
    })

    expect(getProxyPassword).toHaveBeenCalledWith('proxy-password:openai')
  })

  it('rejects SOCKS proxy URLs for provider requests', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { listModels } = await import('@main/services/llmService')
    await expect(listModels({
      name: 'OpenAI Compatible',
      baseUrl: 'https://example.test',
      apiKeyRef: 'openai',
      proxyUrl: 'socks5://127.0.0.1:1080'
    })).rejects.toThrow('Proxy URL must start with http:// or https://')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('streams Anthropic message text deltas', async () => {
    vi.mocked(getApiKey).mockResolvedValue('sk-ant-test')
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}\n\n'))
        controller.enqueue(encoder.encode('event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}\n\n'))
        controller.enqueue(encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'))
        controller.close()
      }
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(stream))
    vi.stubGlobal('fetch', fetchMock)

    const { streamChatCompletion } = await import('@main/services/llmService')
    const chunks: Array<{ type: string; content?: string }> = []
    const request: ChatStreamRequest = {
      requestId: 'request-1',
      provider: {
        name: 'Anthropic',
        providerType: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKeyRef: 'anthropic',
        selectedModel: 'claude-sonnet-4-20250514'
      },
      messages: [{ role: 'user', content: 'Hello' }],
      context: {
        selectedText: '',
        assistMode: 'read'
      }
    }

    await streamChatCompletion(request, (chunk) => chunks.push(chunk))

    expect(chunks).toEqual([
      { type: 'chunk', content: 'Hel' },
      { type: 'chunk', content: 'lo' }
    ])
    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(readStringBody(init)) as {
      max_tokens?: number
      stream?: boolean
      system?: string
      messages?: Array<{ role: string; content: string }>
    }
    expect(body.max_tokens).toBe(4096)
    expect(body.stream).toBe(true)
    expect(body.system).toContain('desktop terminal')
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }])
  })

  it('assesses command risk through Anthropic messages', async () => {
    vi.mocked(getApiKey).mockResolvedValue('sk-ant-test')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [
        { type: 'text', text: '{"dangerous":false,"reason":"Read-only inspection."}' }
      ]
    })))
    vi.stubGlobal('fetch', fetchMock)

    const { assessCommandRisk } = await import('@main/services/llmService')
    const result = await assessCommandRisk({
      provider: {
        name: 'Anthropic',
        providerType: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKeyRef: 'anthropic',
        commandRiskModel: 'claude-sonnet-4-20250514'
      },
      command: 'printf hello',
      context: {
        selectedText: '',
        assistMode: 'agent'
      }
    })

    expect(result).toEqual({
      dangerous: false,
      reason: 'Read-only inspection.'
    })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toEqual(expect.objectContaining({
      'anthropic-version': '2023-06-01',
      'x-api-key': 'sk-ant-test',
      'Content-Type': 'application/json'
    }))
    const body = JSON.parse(readStringBody(init)) as {
      temperature?: number
      stream?: boolean
      system?: string
      messages?: Array<{ role: string; content: string }>
    }
    expect(body.temperature).toBe(0)
    expect(body.stream).toBe(false)
    expect(body.system).toContain('shell command safety classifier')
    expect(body.messages?.[0]?.role).toBe('user')
  })
})

function readStringBody(init: RequestInit): string {
  if (typeof init.body === 'string') return init.body
  throw new Error('Expected request body to be a string.')
}
