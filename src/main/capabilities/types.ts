// SPDX-License-Identifier: MPL-2.0
import type {
  CommandRiskAssessment,
  CommandRiskAssessmentRequest,
  CommandRiskLevel
} from '@shared/types'
import type { SecretFinding, SecretMaskingInput } from '@main/utils/secretMasking'

export type CapabilityKind = 'safety-policy' | 'masking-rule' | 'sync' | 'audit-sink'

export interface CapabilityModule {
  readonly id: string
  readonly kind: CapabilityKind
  readonly version: string
}

export interface SafetyPolicyContribution {
  reason: string
  riskLevel?: CommandRiskLevel
  reasonCode?: CommandRiskAssessment['reasonCode']
}

export interface SafetyPolicyProvider extends CapabilityModule {
  readonly kind: 'safety-policy'
  evaluate(
    request: Pick<CommandRiskAssessmentRequest, 'command' | 'context'>
  ): SafetyPolicyContribution | undefined
}

export interface MaskingRuleProvider extends CapabilityModule {
  readonly kind: 'masking-rule'
  findSecrets(text: string, mode: SecretMaskingInput): SecretFinding[]
}

export interface SyncProvider extends CapabilityModule {
  readonly kind: 'sync'
  // Reserved for #15; #156 only defines the contract.
  readonly displayName: string
}

export interface CapabilityAuditEvent {
  readonly type: string
  readonly at: number
  readonly payload?: Record<string, unknown>
}

export interface AuditSink extends CapabilityModule {
  readonly kind: 'audit-sink'
  record(event: CapabilityAuditEvent): void
}

export type AnyCapability =
  | SafetyPolicyProvider
  | MaskingRuleProvider
  | SyncProvider
  | AuditSink

export interface CapabilityByKind {
  'safety-policy': SafetyPolicyProvider
  'masking-rule': MaskingRuleProvider
  'sync': SyncProvider
  'audit-sink': AuditSink
}
