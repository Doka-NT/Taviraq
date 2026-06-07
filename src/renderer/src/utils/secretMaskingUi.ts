// SPDX-License-Identifier: MPL-2.0
import type { SecretMaskingSettings } from '@shared/types'

export function hasSelectedSecretProtectionScope(settings: SecretMaskingSettings): boolean {
  return settings.applyToProviderPayloads || settings.applyToChatDisplay || settings.strictTerminalContext
}

export function hasActiveSecretProtection(settings: SecretMaskingSettings): boolean {
  return settings.mode === 'on' && hasSelectedSecretProtectionScope(settings)
}

export function activateSecretProtectionDefaults(settings: SecretMaskingSettings): SecretMaskingSettings {
  if (hasSelectedSecretProtectionScope(settings)) {
    return {
      ...settings,
      mode: 'on'
    }
  }

  return {
    ...settings,
    mode: 'on',
    applyToProviderPayloads: true,
    applyToChatDisplay: true
  }
}

export function updateSecretProtectionScope(
  settings: SecretMaskingSettings,
  patch: Partial<Pick<SecretMaskingSettings, 'applyToChatDisplay' | 'applyToProviderPayloads' | 'strictTerminalContext'>>
): SecretMaskingSettings {
  const next = {
    ...settings,
    ...patch
  }

  return {
    ...next,
    mode: Object.values(patch).some(Boolean) ? 'on' : next.mode
  }
}
