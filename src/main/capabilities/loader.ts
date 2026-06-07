// SPDX-License-Identifier: MPL-2.0
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import type { AnyCapability } from './types'
import type { CapabilityManifestEntry } from './manifest'
import { parseCapabilityManifest } from './manifest'
import type { CapabilityRegistry } from './registry'

export type ModuleVerifier = (entry: CapabilityManifestEntry, fileBytes: Buffer) => boolean

export interface LoadCapabilitiesOptions {
  capabilitiesDir?: string
  allowUnsigned?: boolean
  verifyModule?: ModuleVerifier
  onError?: (error: Error, entry?: CapabilityManifestEntry) => void
}

export async function loadCapabilities(
  registry: CapabilityRegistry,
  options: LoadCapabilitiesOptions = {}
): Promise<void> {
  const capabilitiesDir = options.capabilitiesDir ?? process.env.TAVIRAQ_CAPABILITIES_DIR
  if (!capabilitiesDir) return

  const root = resolve(capabilitiesDir)
  let manifest
  try {
    manifest = parseCapabilityManifest(JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8')))
  } catch (error) {
    reportLoadError(options, error)
    return
  }

  for (const entry of manifest.modules) {
    try {
      const entryPath = resolveCapabilityEntry(root, entry.entry)
      const fileBytes = await readFile(entryPath)
      if (!shouldLoadModule(entry, fileBytes, options)) {
        throw new Error(`Capability module "${entry.id}" did not pass verification.`)
      }

      const capability = await importCapability(entryPath)
      validateCapability(entry, capability)
      registry.register(capability)
    } catch (error) {
      reportLoadError(options, error, entry)
    }
  }
}

export function resolveCapabilityEntry(rootDir: string, entry: string): string {
  if (isAbsolute(entry)) {
    throw new Error(`Capability entry "${entry}" must be relative to the capabilities directory.`)
  }
  const root = resolve(rootDir)
  const resolved = resolve(root, entry)
  const rel = relative(root, resolved)
  if (rel.startsWith('..') || rel === '..' || rel === '' || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) {
    throw new Error(`Capability entry "${entry}" must stay inside the capabilities directory.`)
  }
  return resolved
}

function shouldLoadModule(
  entry: CapabilityManifestEntry,
  fileBytes: Buffer,
  options: LoadCapabilitiesOptions
): boolean {
  if (options.verifyModule) return options.verifyModule(entry, fileBytes)
  if (options.allowUnsigned) return true
  // TODO(#157): replace this strict placeholder with Ed25519 detached signature verification.
  return false
}

async function importCapability(entryPath: string): Promise<AnyCapability> {
  const imported = await import(pathToFileURL(entryPath).href) as Record<string, unknown>
  const exported = imported.default ?? imported
  const candidate = typeof exported === 'function'
    ? (exported as () => unknown)()
    : exported
  return candidate as AnyCapability
}

function validateCapability(entry: CapabilityManifestEntry, capability: AnyCapability): void {
  if (!capability || typeof capability !== 'object') {
    throw new Error(`Capability module "${entry.id}" did not export an object.`)
  }
  if (capability.id !== entry.id) {
    throw new Error(`Capability module "${entry.id}" exported mismatched id "${capability.id}".`)
  }
  if (capability.kind !== entry.kind) {
    throw new Error(`Capability module "${entry.id}" exported mismatched kind "${capability.kind}".`)
  }
  if (capability.version !== entry.version) {
    throw new Error(`Capability module "${entry.id}" exported mismatched version "${capability.version}".`)
  }
}

function reportLoadError(
  options: LoadCapabilitiesOptions,
  error: unknown,
  entry?: CapabilityManifestEntry
): void {
  const normalized = error instanceof Error ? error : new Error(String(error))
  if (options.onError) {
    options.onError(normalized, entry)
    return
  }
  console.warn('[capabilities] load failed', normalized.message)
}
