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
