import { existsSync } from 'node:fs'

export function resolveExistingCwd(requested: string | undefined, fallback: string): string {
  return requested && existsSync(requested) ? requested : fallback
}
