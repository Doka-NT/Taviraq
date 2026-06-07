// SPDX-License-Identifier: MPL-2.0
export type {
  AnyCapability,
  AuditSink,
  CapabilityAuditEvent,
  CapabilityByKind,
  CapabilityKind,
  CapabilityModule,
  MaskingRuleProvider,
  SafetyPolicyContribution,
  SafetyPolicyProvider,
  SyncProvider
} from './types'
export { CapabilityRegistry } from './registry'
export type { CapabilityManifest, CapabilityManifestEntry } from './manifest'
export { parseCapabilityManifest } from './manifest'
export type { LoadCapabilitiesOptions, ModuleVerifier } from './loader'
export { loadCapabilities, resolveCapabilityEntry } from './loader'
export { emitCapabilityAuditEvent } from './audit'
