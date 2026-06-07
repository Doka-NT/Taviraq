// SPDX-License-Identifier: MPL-2.0
import type { SafetyPolicyProvider } from '../types'

export function createExampleSafetyPolicy(): SafetyPolicyProvider {
  return {
    id: 'taviraq.reference.safety',
    kind: 'safety-policy',
    version: '1.0.0',
    evaluate(request) {
      return /\btaviraq:example-danger\b/i.test(request.command)
        ? {
            reason: 'Reference safety policy matched the Taviraq example command.',
            riskLevel: 'warning'
          }
        : undefined
    }
  }
}
