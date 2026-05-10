import type { CommandRiskAssessmentRequest } from '@shared/types'

vi.mock('@main/services/secretStore', () => ({
  getApiKey: vi.fn().mockResolvedValue(undefined)
}))

describe('llmService', () => {
  afterEach(() => {
    vi.useRealTimers()
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
})
