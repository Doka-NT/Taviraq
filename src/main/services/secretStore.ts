import type * as Keytar from 'keytar'

const SERVICE_NAME = 'ai-terminal'

export async function saveApiKey(apiKeyRef: string, apiKey: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.setPassword(SERVICE_NAME, apiKeyRef, apiKey)
}

export async function getApiKey(apiKeyRef: string): Promise<string | undefined> {
  const keytar = await importKeytar()
  return (await keytar.getPassword(SERVICE_NAME, apiKeyRef)) ?? undefined
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
