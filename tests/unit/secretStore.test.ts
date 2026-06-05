import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as secretStoreModule from '@main/services/secretStore'

interface KeytarEntry {
  service: string
  account: string
  password: string
}

const store: KeytarEntry[] = []
const getPassword = vi.fn((service: string, account: string) => {
  const entry = store.find((e) => e.service === service && e.account === account)
  return Promise.resolve(entry ? entry.password : null)
})
const setPassword = vi.fn((service: string, account: string, password: string) => {
  const entry = store.find((e) => e.service === service && e.account === account)
  if (entry) entry.password = password
  else store.push({ service, account, password })
  return Promise.resolve()
})
const deletePassword = vi.fn((service: string, account: string) => {
  const index = store.findIndex((e) => e.service === service && e.account === account)
  if (index === -1) return Promise.resolve(false)
  store.splice(index, 1)
  return Promise.resolve(true)
})

vi.mock('keytar', () => ({
  default: { getPassword, setPassword, deletePassword }
}))

const SERVICE = 'taviraq'
const LEGACY = 'ai-terminal'

function importSecretStore(): Promise<typeof secretStoreModule> {
  // Re-import per test so the module-level session cache starts empty.
  vi.resetModules()
  return import('@main/services/secretStore')
}

beforeEach(() => {
  store.length = 0
  getPassword.mockClear()
  setPassword.mockClear()
  deletePassword.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('secretStore session cache', () => {
  it('reads the keychain only once per ref within a session', async () => {
    const { saveApiKey, getApiKey } = await importSecretStore()
    await saveApiKey('ref-1', 'secret-1')
    getPassword.mockClear()

    expect(await getApiKey('ref-1')).toBe('secret-1')
    expect(await getApiKey('ref-1')).toBe('secret-1')

    // Served from cache after the first miss-free read; keychain not touched.
    expect(getPassword).not.toHaveBeenCalled()
  })

  it('invalidates the cache when the secret is updated', async () => {
    const { saveApiKey, getApiKey } = await importSecretStore()
    await saveApiKey('ref-1', 'old')
    expect(await getApiKey('ref-1')).toBe('old')

    await saveApiKey('ref-1', 'new')
    expect(await getApiKey('ref-1')).toBe('new')
  })

  it('invalidates the cache when the secret is deleted', async () => {
    const { saveApiKey, getApiKey, deleteApiKey } = await importSecretStore()
    await saveApiKey('ref-1', 'secret-1')
    expect(await getApiKey('ref-1')).toBe('secret-1')

    await deleteApiKey('ref-1')
    expect(await getApiKey('ref-1')).toBeUndefined()
  })
})

describe('secretStore concurrent read deduplication', () => {
  it('issues only one keychain read when the same ref is requested concurrently', async () => {
    const { getApiKey } = await importSecretStore()
    store.push({ service: SERVICE, account: 'ref-1', password: 'secret-1' })

    const [a, b] = await Promise.all([getApiKey('ref-1'), getApiKey('ref-1')])

    expect(a).toBe('secret-1')
    expect(b).toBe('secret-1')
    expect(getPassword).toHaveBeenCalledTimes(1)
  })
})

describe('secretStore mutation races', () => {
  it('does not overwrite cache when a save races an in-flight read', async () => {
    const { saveApiKey, getApiKey } = await importSecretStore()
    store.push({ service: SERVICE, account: 'ref-1', password: 'old-key' })

    let resolveGet!: (val: string | null) => void
    getPassword.mockImplementationOnce(
      () => new Promise<string | null>((res) => { resolveGet = res })
    )

    const readPromise = getApiKey('ref-1')
    // Save a new key while the read is suspended
    await saveApiKey('ref-1', 'new-key')
    // Let the stale read resolve with the old value
    resolveGet('old-key')
    await readPromise

    // The cache must reflect the save, not the stale keychain read
    getPassword.mockClear()
    expect(await getApiKey('ref-1')).toBe('new-key')
    expect(getPassword).not.toHaveBeenCalled()
  })

  it('does not repopulate cache after a delete races an in-flight read', async () => {
    const { saveApiKey, getApiKey, deleteApiKey } = await importSecretStore()
    await saveApiKey('ref-1', 'secret-1')

    let resolveGet!: (val: string | null) => void
    // Use Once so that only the in-flight read is deferred; the final
    // assertion's read falls back to the normal store-based implementation.
    getPassword.mockImplementationOnce(
      () => new Promise<string | null>((res) => { resolveGet = res })
    )

    // Clear the in-memory cache so the next read hits the keychain
    await deleteApiKey('ref-1')
    store.push({ service: SERVICE, account: 'ref-1', password: 'secret-1' })
    const readPromise = getApiKey('ref-1')

    // Delete (and remove from store) while the read is suspended
    store.splice(store.findIndex((e) => e.service === SERVICE && e.account === 'ref-1'), 1)
    await deleteApiKey('ref-1')

    // Let the stale in-flight read resolve with the deleted value
    resolveGet('secret-1')
    await readPromise

    // Cache should be empty — the delete wins over the stale read.
    // The store is also empty so a fresh read returns undefined.
    expect(await getApiKey('ref-1')).toBeUndefined()
  })
})

describe('warmSecretCache', () => {
  it('pre-warms the cache so subsequent reads do not hit the keychain', async () => {
    const { warmSecretCache, getApiKey, buildProxyPasswordRef } = await importSecretStore()
    const proxyRef = buildProxyPasswordRef('ref-1')
    store.push({ service: SERVICE, account: 'ref-1', password: 'api-key' })
    store.push({ service: SERVICE, account: proxyRef, password: 'proxy-pw' })

    await warmSecretCache(['ref-1', proxyRef])
    getPassword.mockClear()

    expect(await getApiKey('ref-1')).toBe('api-key')
    expect(await getApiKey(proxyRef)).toBe('proxy-pw')
    expect(getPassword).not.toHaveBeenCalled()
  })
})

describe('secretStore legacy migration', () => {
  it('promotes a legacy api key to the current service and removes the legacy entry', async () => {
    const { getApiKey } = await importSecretStore()
    store.push({ service: LEGACY, account: 'ref-1', password: 'legacy-secret' })

    expect(await getApiKey('ref-1')).toBe('legacy-secret')

    expect(store.find((e) => e.service === SERVICE && e.account === 'ref-1')?.password).toBe(
      'legacy-secret'
    )
    expect(store.find((e) => e.service === LEGACY && e.account === 'ref-1')).toBeUndefined()
  })

  it('does not prompt the keychain again after a legacy key has been promoted', async () => {
    const { getApiKey } = await importSecretStore()
    store.push({ service: LEGACY, account: 'ref-1', password: 'legacy-secret' })

    await getApiKey('ref-1')
    getPassword.mockClear()

    expect(await getApiKey('ref-1')).toBe('legacy-secret')
    expect(getPassword).not.toHaveBeenCalled()
  })

  it('migrates legacy proxy passwords as well', async () => {
    const { getProxyPassword, buildProxyPasswordRef } = await importSecretStore()
    const ref = buildProxyPasswordRef('ref-1')
    store.push({ service: LEGACY, account: ref, password: 'legacy-proxy' })

    expect(await getProxyPassword(ref)).toBe('legacy-proxy')
    expect(store.find((e) => e.service === SERVICE && e.account === ref)?.password).toBe(
      'legacy-proxy'
    )
    expect(store.find((e) => e.service === LEGACY && e.account === ref)).toBeUndefined()
  })
})
