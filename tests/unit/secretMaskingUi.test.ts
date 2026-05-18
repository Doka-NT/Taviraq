import { createDefaultSecretMaskingSettings } from '@shared/secretMaskingConfig'
import {
  activateSecretProtectionDefaults,
  hasActiveSecretProtection,
  updateSecretProtectionScope
} from '@renderer/utils/secretMaskingUi'

describe('secret masking UI state', () => {
  it('does not report active protection when every protection area is disabled', () => {
    const settings = {
      ...createDefaultSecretMaskingSettings(),
      applyToChatDisplay: false,
      applyToProviderPayloads: false,
      strictTerminalContext: false
    }

    expect(hasActiveSecretProtection(settings)).toBe(false)
  })

  it('keeps a no-scope state when the last protection area is disabled', () => {
    const settings = {
      ...createDefaultSecretMaskingSettings(),
      applyToChatDisplay: false,
      strictTerminalContext: false
    }

    expect(updateSecretProtectionScope(settings, { applyToProviderPayloads: false })).toMatchObject({
      mode: 'on',
      applyToChatDisplay: false,
      applyToProviderPayloads: false,
      strictTerminalContext: false
    })
  })

  it('restores safe defaults when activation has no selected area', () => {
    const settings = {
      ...createDefaultSecretMaskingSettings(),
      mode: 'off' as const,
      applyToChatDisplay: false,
      applyToProviderPayloads: false,
      strictTerminalContext: false
    }

    expect(activateSecretProtectionDefaults(settings)).toMatchObject({
      mode: 'on',
      applyToChatDisplay: true,
      applyToProviderPayloads: true,
      strictTerminalContext: false
    })
  })
})
