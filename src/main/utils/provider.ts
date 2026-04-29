import type { LLMModel } from '@shared/types'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}
