import type * as Keytar from 'keytar'

const SERVICE_NAME = 'taviraq'
const LEGACY_SERVICE_NAME = 'ai-terminal'
const PROXY_PASSWORD_PREFIX = 'proxy-password:'

// In-memory cache of secrets read during this app session. The OS keychain can
// prompt for the login password on every individual access (especially for
// items whose ACL still trusts a previous app signature), so without a cache a
// single LLM request — which reads an API key and a proxy password, often
// repeatedly — produces a burst of password dialogs. The cache collapses those
// repeats to at most one read per ref per session. Keys are the keychain refs,
// which are already namespaced (proxy refs carry the PROXY_PASSWORD_PREFIX).
const secretCache = new Map<string, string>()

export async function saveApiKey(apiKeyRef: string, apiKey: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.setPassword(SERVICE_NAME, apiKeyRef, apiKey)
  secretCache.set(apiKeyRef, apiKey)
}

export async function getApiKey(apiKeyRef: string): Promise<string | undefined> {
  return readSecret(apiKeyRef)
}

export async function deleteApiKey(apiKeyRef: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.deletePassword(SERVICE_NAME, apiKeyRef)
  await keytar.deletePassword(LEGACY_SERVICE_NAME, apiKeyRef)
  secretCache.delete(apiKeyRef)
}

export function buildProxyPasswordRef(apiKeyRef: string): string {
  return `${PROXY_PASSWORD_PREFIX}${apiKeyRef}`
}

export async function saveProxyPassword(proxyPasswordRef: string, password: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.setPassword(SERVICE_NAME, proxyPasswordRef, password)
  secretCache.set(proxyPasswordRef, password)
}

export async function getProxyPassword(proxyPasswordRef: string): Promise<string | undefined> {
  return readSecret(proxyPasswordRef)
}

export async function deleteProxyPassword(proxyPasswordRef: string): Promise<void> {
  const keytar = await importKeytar()
  await keytar.deletePassword(SERVICE_NAME, proxyPasswordRef)
  await keytar.deletePassword(LEGACY_SERVICE_NAME, proxyPasswordRef)
  secretCache.delete(proxyPasswordRef)
}

/**
 * Read a secret by ref, transparently migrating legacy entries.
 *
 * Secrets created by older builds live under LEGACY_SERVICE_NAME and their
 * keychain ACL only trusts the old app signature, so the current signed binary
 * is re-prompted for the login password on every access. When we find a secret
 * only under the legacy service we promote it: re-save it under SERVICE_NAME
 * (which recreates the item owned by — and trusting — the current binary) and
 * remove the legacy entry, so subsequent reads no longer prompt.
 */
async function readSecret(ref: string): Promise<string | undefined> {
  const cached = secretCache.get(ref)
  if (cached !== undefined) return cached

  const keytar = await importKeytar()

  const current = await keytar.getPassword(SERVICE_NAME, ref)
  if (current) {
    secretCache.set(ref, current)
    return current
  }

  const legacy = await keytar.getPassword(LEGACY_SERVICE_NAME, ref)
  if (legacy) {
    await migrateLegacySecret(keytar, ref, legacy)
    secretCache.set(ref, legacy)
    return legacy
  }

  return undefined
}

async function migrateLegacySecret(keytar: typeof Keytar, ref: string, value: string): Promise<void> {
  try {
    await keytar.setPassword(SERVICE_NAME, ref, value)
    await keytar.deletePassword(LEGACY_SERVICE_NAME, ref)
  } catch {
    // Best-effort migration: if writing the promoted entry or deleting the
    // legacy one fails, keep the legacy secret intact and try again next read.
  }
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
