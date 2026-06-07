// SPDX-License-Identifier: MPL-2.0
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const TMP_DIR = join(__dirname, '__tmp_config_store__')

vi.mock('electron', () => ({
  app: {
    getPath: () => TMP_DIR
  }
}))

import { ConfigStore } from '@main/services/configStore'

async function cleanTmp(): Promise<void> {
  if (existsSync(TMP_DIR)) {
    await rm(TMP_DIR, { recursive: true })
  }
}

describe('ConfigStore secret masking settings', () => {
  afterEach(() => cleanTmp())

  it('merges partial secret masking updates without resetting existing fields', async () => {
    const store = new ConfigStore()
    await store.updateSecretMaskingSettings({
      mode: 'on',
      applyToChatDisplay: false,
      applyToProviderPayloads: true,
      strictTerminalContext: true,
      customPatterns: [{
        id: 'internal',
        name: 'Internal token',
        pattern: 'INTERNAL_TOKEN=([A-Z0-9-]{12,})',
        enabled: false,
        createdAt: '2026-05-17T00:00:00.000Z'
      }]
    })

    const config = await store.updateSecretMaskingSettings({
      applyToProviderPayloads: false
    })

    expect(config.secretMasking?.applyToChatDisplay).toBe(false)
    expect(config.secretMasking?.applyToProviderPayloads).toBe(false)
    expect(config.secretMasking?.strictTerminalContext).toBe(true)
    expect(config.secretMasking?.customPatterns).toEqual([{
      id: 'internal',
      name: 'Internal token',
      pattern: 'INTERNAL_TOKEN=([A-Z0-9-]{12,})',
      enabled: false,
      createdAt: '2026-05-17T00:00:00.000Z'
    }])
  })

  it('drops renderer-supplied custom patterns without explicit enabled state', async () => {
    const store = new ConfigStore()
    const config = await store.updateSecretMaskingSettings({
      customPatterns: [{
        id: 'bad',
        name: 'Bad pattern',
        pattern: 'INTERNAL_TOKEN=([A-Z0-9-]{12,})',
        createdAt: '2026-05-17T00:00:00.000Z'
      }]
    })

    expect(config.secretMasking?.customPatterns).toEqual([])
  })
})

describe('ConfigStore chat tools settings', () => {
  afterEach(() => cleanTmp())

  it('defaults task list planning to off when never set', async () => {
    const store = new ConfigStore()
    const config = await store.load()
    expect(config.chatTools?.taskListPlanning).toBe(false)
  })

  it('persists the task list planning toggle across loads', async () => {
    const store = new ConfigStore()
    await store.updateChatToolsSettings({ taskListPlanning: true })

    const reloaded = await new ConfigStore().load()
    expect(reloaded.chatTools?.taskListPlanning).toBe(true)
  })

  it('coerces an untrusted toggle value to a boolean', async () => {
    const store = new ConfigStore()
    const config = await store.updateChatToolsSettings({ taskListPlanning: 'on' })
    expect(config.chatTools?.taskListPlanning).toBe(false)
  })
})

describe('ConfigStore telemetry settings', () => {
  afterEach(() => cleanTmp())

  it('defaults telemetry to off and pending with a generated install id', async () => {
    const store = new ConfigStore()
    const config = await store.load()
    expect(config.telemetry?.enabled).toBe(false)
    expect(config.telemetry?.consentDecision).toBe('pending')
    expect(config.telemetry?.installId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('keeps a stable install id across loads and reports first run only once', async () => {
    const store = new ConfigStore()
    const first = await store.initTelemetry()
    expect(first.isFirstRun).toBe(true)

    const second = await new ConfigStore().initTelemetry()
    expect(second.isFirstRun).toBe(false)
    expect(second.settings.installId).toBe(first.settings.installId)
  })

  it('enables telemetry only when consent is granted and stamps consentedAt', async () => {
    const store = new ConfigStore()
    const config = await store.updateTelemetrySettings({ enabled: true, consentDecision: 'granted' })
    expect(config.telemetry?.enabled).toBe(true)
    expect(config.telemetry?.consentDecision).toBe('granted')
    expect(config.telemetry?.consentedAt).toBeTruthy()
  })

  it('never enables telemetry without a granted decision', async () => {
    const store = new ConfigStore()
    const config = await store.updateTelemetrySettings({ enabled: true, consentDecision: 'denied' })
    expect(config.telemetry?.enabled).toBe(false)
  })

  it('preserves the install id when consent is later revoked', async () => {
    const store = new ConfigStore()
    const granted = await store.updateTelemetrySettings({ enabled: true, consentDecision: 'granted' })
    const revoked = await store.updateTelemetrySettings({ enabled: false, consentDecision: 'denied' })
    expect(revoked.telemetry?.enabled).toBe(false)
    expect(revoked.telemetry?.installId).toBe(granted.telemetry?.installId)
  })
})
