// SPDX-License-Identifier: MPL-2.0
import { CapabilityRegistry } from '@main/capabilities'
import type { MaskingRuleProvider, SafetyPolicyProvider } from '@main/capabilities'

function createSafetyProvider(id: string): SafetyPolicyProvider {
  return {
    id,
    kind: 'safety-policy',
    version: '1.0.0',
    evaluate: () => undefined
  }
}

function createMaskingProvider(id: string): MaskingRuleProvider {
  return {
    id,
    kind: 'masking-rule',
    version: '1.0.0',
    findSecrets: () => []
  }
}

describe('CapabilityRegistry', () => {
  it('registers, discovers, filters, unregisters, and clears capabilities', () => {
    const registry = new CapabilityRegistry()
    const safety = createSafetyProvider('test.safety')
    const masking = createMaskingProvider('test.masking')

    registry.register(safety)
    registry.register(masking)

    expect(registry.has('test.safety')).toBe(true)
    expect(registry.discover()).toEqual([safety, masking])
    expect(registry.get('safety-policy')).toEqual([safety])
    expect(registry.get('masking-rule')).toEqual([masking])
    expect(registry.unregister('test.safety')).toBe(true)
    expect(registry.unregister('missing')).toBe(false)
    expect(registry.discover()).toEqual([masking])

    registry.clear()
    expect(registry.discover()).toEqual([])
  })

  it('replaces duplicate ids while preserving registration order', () => {
    const registry = new CapabilityRegistry()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const original = createSafetyProvider('test.duplicate')
    const replacement = createMaskingProvider('test.duplicate')
    const tail = createSafetyProvider('test.tail')

    registry.register(original)
    registry.register(tail)
    registry.register(replacement)

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('test.duplicate'))
    expect(registry.discover()).toEqual([replacement, tail])
    expect(registry.get('masking-rule')).toEqual([replacement])
    expect(registry.get('safety-policy')).toEqual([tail])
  })
})
