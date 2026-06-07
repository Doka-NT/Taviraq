// SPDX-License-Identifier: MPL-2.0
import type { CapabilityKind } from './types'

const CAPABILITY_KINDS = new Set<CapabilityKind>([
  'safety-policy',
  'masking-rule',
  'sync',
  'audit-sink'
])

export interface CapabilityManifestEntry {
  id: string
  kind: CapabilityKind
  version: string
  entry: string
  signature?: string
}

export interface CapabilityManifest {
  schemaVersion: 1
  modules: CapabilityManifestEntry[]
}

export function parseCapabilityManifest(raw: unknown): CapabilityManifest {
  const root = readObject(raw, 'Capability manifest')
  if (root.schemaVersion !== 1) {
    throw new Error('Capability manifest schemaVersion must be 1.')
  }
  if (!Array.isArray(root.modules)) {
    throw new Error('Capability manifest modules must be an array.')
  }

  return {
    schemaVersion: 1,
    modules: root.modules.map((entry, index) => parseManifestEntry(entry, index))
  }
}

function parseManifestEntry(raw: unknown, index: number): CapabilityManifestEntry {
  const entry = readObject(raw, `Capability manifest module ${index}`)
  const id = readRequiredString(entry, 'id', index)
  const kind = readKind(entry.kind, index)
  const version = readRequiredString(entry, 'version', index)
  const moduleEntry = readRequiredString(entry, 'entry', index)
  const signature = entry.signature

  if (signature !== undefined && typeof signature !== 'string') {
    throw new Error(`Capability manifest module ${index} signature must be a string when present.`)
  }

  return {
    id,
    kind,
    version,
    entry: moduleEntry,
    ...(signature ? { signature } : {})
  }
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function readRequiredString(record: Record<string, unknown>, key: string, index: number): string {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Capability manifest module ${index} ${key} must be a non-empty string.`)
  }
  return value
}

function readKind(value: unknown, index: number): CapabilityKind {
  if (typeof value === 'string' && CAPABILITY_KINDS.has(value as CapabilityKind)) {
    return value as CapabilityKind
  }
  throw new Error(`Capability manifest module ${index} kind is not supported.`)
}
