import type { SecretMaskingSettings } from './types'

export const SECRET_MASKING_AUDIT_LIMIT = 80

export function createDefaultSecretMaskingSettings(): SecretMaskingSettings {
  return {
    mode: 'on',
    applyToChatDisplay: true,
    applyToProviderPayloads: true,
    strictTerminalContext: false,
    customPatterns: []
  }
}
