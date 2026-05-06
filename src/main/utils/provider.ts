import type { LLMModel, LLMProviderConfig, LLMProviderType } from '@shared/types'

export const PROVIDER_DEFAULTS: Record<LLMProviderType, { name: string; baseUrl: string }> = {
  openai: {
    name: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com'
  },
  ollama: {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434'
  },
  lmstudio: {
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234'
  }
}

export function getProviderType(provider: Pick<LLMProviderConfig, 'providerType'>): LLMProviderType {
  return provider.providerType ?? 'openai'
}

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')

  if (!trimmed) {
    throw new Error('Base URL is required.')
  }

  const url = new URL(trimmed)
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\/v1$/, '')
  url.search = ''
  url.hash = ''

  return url.toString().replace(/\/+$/, '')
}

export function buildOpenAICompatibleUrl(baseUrl: string, path: 'models' | 'chat/completions'): string {
  return `${normalizeBaseUrl(baseUrl)}/v1/${path}`
}

export function buildProviderUrl(provider: LLMProviderConfig, path: 'models' | 'chat/completions'): string {
  return buildOpenAICompatibleUrl(provider.baseUrl || PROVIDER_DEFAULTS[getProviderType(provider)].baseUrl, path)
}

export function buildOllamaNativeUrl(baseUrl: string, path: 'tags' | 'chat'): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')

  if (!trimmed) {
    throw new Error('Base URL is required.')
  }

  const url = new URL(trimmed)
  url.pathname = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/api\/(?:tags|chat)$/, '')
    .replace(/\/api$/, '')
    .replace(/\/v1$/, '')
  url.search = ''
  url.hash = ''

  return `${url.toString().replace(/\/+$/, '')}/api/${path}`
}

export function buildLmStudioNativeUrl(baseUrl: string, path: 'models' | 'chat'): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')

  if (!trimmed) {
    throw new Error('Base URL is required.')
  }

  const url = new URL(trimmed)
  url.pathname = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/api\/v1\/(?:models|chat)$/, '')
    .replace(/\/api\/v1$/, '')
    .replace(/\/v1$/, '')
  url.search = ''
  url.hash = ''

  return `${url.toString().replace(/\/+$/, '')}/api/v1/${path}`
}

export function parseModelList(payload: unknown): LLMModel[] {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('Model list response did not include a data array.')
  }

  const data = payload.data
  if (!Array.isArray(data)) {
    throw new Error('Model list data is not an array.')
  }

  const models: LLMModel[] = []
  const entries: unknown[] = data

  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      continue
    }

    models.push({
      id: entry.id,
      ownedBy: typeof entry.owned_by === 'string' ? entry.owned_by : undefined
    })
  }

  return models.sort((a, b) => a.id.localeCompare(b.id))
}

export function parseOllamaNativeModelList(payload: unknown): LLMModel[] {
  if (!payload || typeof payload !== 'object' || !('models' in payload)) {
    throw new Error('Ollama model list response did not include a models array.')
  }

  const data = payload.models
  if (!Array.isArray(data)) {
    throw new Error('Ollama model list data is not an array.')
  }

  const models: LLMModel[] = []
  const entries: unknown[] = data

  for (const entry of entries) {
    if (!isRecord(entry)) continue

    const id = typeof entry.model === 'string'
      ? entry.model
      : typeof entry.name === 'string'
        ? entry.name
        : undefined

    if (!id) continue
    models.push({ id, ownedBy: 'ollama' })
  }

  return models.sort((a, b) => a.id.localeCompare(b.id))
}

export function parseLmStudioNativeModelList(payload: unknown): LLMModel[] {
  if (!payload || typeof payload !== 'object' || !('models' in payload)) {
    throw new Error('LM Studio model list response did not include a models array.')
  }

  const data = payload.models
  if (!Array.isArray(data)) {
    throw new Error('LM Studio model list data is not an array.')
  }

  const models: LLMModel[] = []
  const entries: unknown[] = data

  for (const entry of entries) {
    if (!isRecord(entry) || entry.type !== 'llm' || typeof entry.key !== 'string') {
      continue
    }

    models.push({
      id: entry.key,
      ownedBy: typeof entry.publisher === 'string' ? entry.publisher : undefined
    })
  }

  return models.sort((a, b) => a.id.localeCompare(b.id))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}
