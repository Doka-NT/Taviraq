import type * as Keytar from 'keytar'

const SERVICE_NAME = 'taviraq'
const LEGACY_SERVICE_NAME = 'ai-terminal'
const PROXY_PASSWORD_PREFIX = 'proxy-password:'

export async function saveApiKey(apiKeyRef: string, apiKey: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.setPassword(SERVICE_NAME, apiKeyRef, apiKey)
}

export async function getApiKey(apiKeyRef: string): Promise<string | undefined> {
  const keytar = await importKeytar()
  const apiKey = await keytar.getPassword(SERVICE_NAME, apiKeyRef)
  if (apiKey) return apiKey

  return (await keytar.getPassword(LEGACY_SERVICE_NAME, apiKeyRef)) ?? undefined
}

export async function deleteApiKey(apiKeyRef: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.deletePassword(SERVICE_NAME, apiKeyRef)
  await keytar.deletePassword(LEGACY_SERVICE_NAME, apiKeyRef)
}

export function buildProxyPasswordRef(apiKeyRef: string): string {
  return `${PROXY_PASSWORD_PREFIX}${apiKeyRef}`
}

export async function saveProxyPassword(proxyPasswordRef: string, password: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.setPassword(SERVICE_NAME, proxyPasswordRef, password)
}

export async function getProxyPassword(proxyPasswordRef: string): Promise<string | undefined> {
  const keytar = await importKeytar()
  return (await keytar.getPassword(SERVICE_NAME, proxyPasswordRef)) ?? undefined
}

export async function deleteProxyPassword(proxyPasswordRef: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.deletePassword(SERVICE_NAME, proxyPasswordRef)
}

async function importKeytar(): Promise<typeof Keytar> {
  try {
    const mod = await import('keytar')
    return mod.default ?? mod
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`OS keychain is unavailable through keytar: ${message}`)
  }
}
