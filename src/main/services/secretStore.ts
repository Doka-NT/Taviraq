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

// Deduplicates concurrent reads for the same ref. Without this, two simultaneous
// callers (e.g. two React effects both calling hasApiKey for the same provider on
// mount) each miss the empty cache and independently hit the keychain, producing
// two password dialogs for a single secret.
const pendingReads = new Map<string, Promise<string | undefined>>()

// Mutation version per ref. Bumped before AND after every save/delete so that
// an in-flight resolveSecret that started during a mutation sees a version
// mismatch and does not overwrite the cache with a stale or deleted value.
const secretVersions = new Map<string, number>()

function ver(ref: string): number {
  return secretVersions.get(ref) ?? 0
}

function bumpVer(ref: string): void {
  secretVersions.set(ref, ver(ref) + 1)
}

export async function saveApiKey(apiKeyRef: string, apiKey: string): Promise<void> {
  bumpVer(apiKeyRef)
  const keytar = await importKeytar()
  await keytar.setPassword(SERVICE_NAME, apiKeyRef, apiKey)
  secretCache.set(apiKeyRef, apiKey)
  bumpVer(apiKeyRef)
  pendingReads.delete(apiKeyRef)
}

export async function getApiKey(apiKeyRef: string): Promise<string | undefined> {
  return readSecret(apiKeyRef)
}

export async function deleteApiKey(apiKeyRef: string): Promise<void> {
  bumpVer(apiKeyRef)
  const keytar = await importKeytar()
  await keytar.deletePassword(SERVICE_NAME, apiKeyRef)
  await keytar.deletePassword(LEGACY_SERVICE_NAME, apiKeyRef)
  secretCache.delete(apiKeyRef)
  bumpVer(apiKeyRef)
  pendingReads.delete(apiKeyRef)
}

export function buildProxyPasswordRef(apiKeyRef: string): string {
  return `${PROXY_PASSWORD_PREFIX}${apiKeyRef}`
}

export async function saveProxyPassword(proxyPasswordRef: string, password: string): Promise<void> {
  bumpVer(proxyPasswordRef)
  const keytar = await importKeytar()
  await keytar.setPassword(SERVICE_NAME, proxyPasswordRef, password)
  secretCache.set(proxyPasswordRef, password)
  bumpVer(proxyPasswordRef)
  pendingReads.delete(proxyPasswordRef)
}

export async function getProxyPassword(proxyPasswordRef: string): Promise<string | undefined> {
  return readSecret(proxyPasswordRef)
}

export async function deleteProxyPassword(proxyPasswordRef: string): Promise<void> {
  bumpVer(proxyPasswordRef)
  const keytar = await importKeytar()
  await keytar.deletePassword(SERVICE_NAME, proxyPasswordRef)
  await keytar.deletePassword(LEGACY_SERVICE_NAME, proxyPasswordRef)
  secretCache.delete(proxyPasswordRef)
  bumpVer(proxyPasswordRef)
  pendingReads.delete(proxyPasswordRef)
}

/**
 * Pre-warm the cache for a set of keychain refs. Call this at app startup with
 * all configured provider API key refs and proxy password refs so that all
 * prompts appear at launch rather than scattered across LLM requests. Errors
 * are swallowed — the cache is best-effort; missing secrets are retried on the
 * next actual access.
 */
export async function warmSecretCache(refs: string[]): Promise<void> {
  await Promise.all(refs.map((ref) => readSecret(ref).catch(() => undefined)))
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

  const pending = pendingReads.get(ref)
  if (pending !== undefined) return pending

  const promise = resolveSecret(ref)
  pendingReads.set(ref, promise)
  // Use identity check so a mutation that cleared pendingReads and started a
  // fresh read does not get its entry removed when this older promise settles.
  // Catch swallows the rejection on the cleanup chain — the caller who awaits
  // `promise` directly handles errors; without this a rejected promise would
  // produce an unhandled-rejection warning from the detached finally chain.
  promise.finally(() => {
    if (pendingReads.get(ref) === promise) pendingReads.delete(ref)
  }).catch(() => undefined)
  return promise
}

async function resolveSecret(ref: string): Promise<string | undefined> {
  // Snapshot the mutation version before the first async hop so we can detect
  // any save/delete that races this read and skip the stale cache write.
  const v = ver(ref)
  const keytar = await importKeytar()

  const current = await keytar.getPassword(SERVICE_NAME, ref)
  if (current) {
    if (ver(ref) === v) secretCache.set(ref, current)
    return secretCache.get(ref) ?? current
  }

  const legacy = await keytar.getPassword(LEGACY_SERVICE_NAME, ref)
  if (legacy) {
    await migrateLegacySecret(keytar, ref, legacy)
    if (ver(ref) === v) secretCache.set(ref, legacy)
    return secretCache.get(ref) ?? legacy
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

// Cache the import so concurrent callers share one Promise and the mock
// intercept in tests is not called twice (which can race in Vitest on Linux).
let _keytarPromise: Promise<typeof Keytar> | undefined

function importKeytar(): Promise<typeof Keytar> {
  _keytarPromise ??= import('keytar')
    .then((mod) => mod.default ?? mod)
    .catch((error) => {
      _keytarPromise = undefined
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`OS keychain is unavailable through keytar: ${message}`)
    })
  return _keytarPromise
}
