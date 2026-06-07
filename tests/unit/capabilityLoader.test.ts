// SPDX-License-Identifier: MPL-2.0
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  CapabilityRegistry,
  loadCapabilities,
  parseCapabilityManifest,
  resolveCapabilityEntry
} from '@main/capabilities'

describe('capability manifest and loader', () => {
  let tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    tempDirs = []
    vi.unstubAllEnvs()
  })

  it('parses a valid manifest and rejects malformed manifests', () => {
    expect(parseCapabilityManifest({
      schemaVersion: 1,
      modules: [{
        id: 'test.safety',
        kind: 'safety-policy',
        version: '1.0.0',
        entry: './safety.mjs'
      }]
    })).toMatchObject({
      schemaVersion: 1,
      modules: [{ id: 'test.safety' }]
    })

    expect(() => parseCapabilityManifest({ schemaVersion: 2, modules: [] }))
      .toThrow('schemaVersion must be 1')
    expect(() => parseCapabilityManifest({ schemaVersion: 1 }))
      .toThrow('modules must be an array')
    expect(() => parseCapabilityManifest({
      schemaVersion: 1,
      modules: [{ id: '', kind: 'safety-policy', version: '1.0.0', entry: './x.mjs' }]
    })).toThrow('id must be a non-empty string')
  })

  it('is a no-op when no capability directory is configured', async () => {
    const registry = new CapabilityRegistry()

    await loadCapabilities(registry)

    expect(registry.discover()).toEqual([])
  })

  it('loads unsigned modules only when explicitly allowed', async () => {
    const dir = await createCapabilitiesDir()
    await writeManifest(dir, [{
      id: 'test.safety',
      kind: 'safety-policy',
      version: '1.0.0',
      entry: './safety.mjs'
    }])
    await writeSafetyModule(join(dir, 'safety.mjs'), 'test.safety')

    const rejected = new CapabilityRegistry()
    await loadCapabilities(rejected, { capabilitiesDir: dir, allowUnsigned: false })
    expect(rejected.discover()).toEqual([])

    const loaded = new CapabilityRegistry()
    await loadCapabilities(loaded, { capabilitiesDir: dir, allowUnsigned: true })
    expect(loaded.get('safety-policy')).toHaveLength(1)
  })

  it('rejects path traversal entries while loading remaining modules', async () => {
    const dir = await createCapabilitiesDir()
    const outside = await createCapabilitiesDir()
    await writeManifest(dir, [
      {
        id: 'test.bad',
        kind: 'safety-policy',
        version: '1.0.0',
        entry: `../${outside.split('/').at(-1) ?? 'outside'}/bad.mjs`
      },
      {
        id: 'test.good',
        kind: 'safety-policy',
        version: '1.0.0',
        entry: './good.mjs'
      }
    ])
    await writeSafetyModule(join(outside, 'bad.mjs'), 'test.bad')
    await writeSafetyModule(join(dir, 'good.mjs'), 'test.good')
    const errors: string[] = []
    const registry = new CapabilityRegistry()

    await loadCapabilities(registry, {
      capabilitiesDir: dir,
      allowUnsigned: true,
      onError: (error) => errors.push(error.message)
    })

    expect(errors.some((message) => message.includes('must stay inside'))).toBe(true)
    expect(registry.discover().map((module) => module.id)).toEqual(['test.good'])
  })

  it('uses the verifier hook before importing modules', async () => {
    const dir = await createCapabilitiesDir()
    await writeManifest(dir, [{
      id: 'test.safety',
      kind: 'safety-policy',
      version: '1.0.0',
      entry: './safety.mjs'
    }])
    await writeSafetyModule(join(dir, 'safety.mjs'), 'test.safety')
    const registry = new CapabilityRegistry()

    await loadCapabilities(registry, {
      capabilitiesDir: dir,
      verifyModule: () => false
    })

    expect(registry.discover()).toEqual([])
  })

  it('resolves only relative entries inside the capability directory', () => {
    expect(resolveCapabilityEntry('/tmp/root', './module.mjs')).toBe('/tmp/root/module.mjs')
    expect(() => resolveCapabilityEntry('/tmp/root', '/tmp/root/module.mjs')).toThrow('must be relative')
    expect(() => resolveCapabilityEntry('/tmp/root', '../module.mjs')).toThrow('must stay inside')
  })

  async function createCapabilitiesDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'taviraq-capabilities-'))
    tempDirs.push(dir)
    return dir
  }
})

async function writeManifest(dir: string, modules: unknown[]): Promise<void> {
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: 1, modules }), 'utf8')
}

async function writeSafetyModule(path: string, id: string): Promise<void> {
  await writeFile(path, [
    'export default {',
    `  id: ${JSON.stringify(id)},`,
    "  kind: 'safety-policy',",
    "  version: '1.0.0',",
    '  evaluate() { return undefined }',
    '}'
  ].join('\n'), 'utf8')
}
