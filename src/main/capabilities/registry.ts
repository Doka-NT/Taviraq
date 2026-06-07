// SPDX-License-Identifier: MPL-2.0
import type { AnyCapability, CapabilityByKind, CapabilityKind } from './types'

export class CapabilityRegistry {
  private modules = new Map<string, AnyCapability>()

  register(module: AnyCapability): void {
    if (this.modules.has(module.id)) {
      console.warn(`[capabilities] replacing already registered capability "${module.id}"`)
    }
    this.modules.set(module.id, module)
  }

  unregister(id: string): boolean {
    return this.modules.delete(id)
  }

  get<K extends CapabilityKind>(kind: K): readonly CapabilityByKind[K][] {
    return [...this.modules.values()].filter(
      (module): module is CapabilityByKind[K] => module.kind === kind
    )
  }

  discover(): readonly AnyCapability[] {
    return [...this.modules.values()]
  }

  has(id: string): boolean {
    return this.modules.has(id)
  }

  clear(): void {
    this.modules.clear()
  }
}
