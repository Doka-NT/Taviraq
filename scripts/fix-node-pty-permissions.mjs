import { chmod, readdir } from 'node:fs/promises'
import { join } from 'node:path'

if (process.platform !== 'darwin' && process.platform !== 'linux') {
  process.exit(0)
}

const prebuildsPath = join(process.cwd(), 'node_modules', 'node-pty', 'prebuilds')

try {
  const entries = await readdir(prebuildsPath, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => chmod(join(prebuildsPath, entry.name, 'spawn-helper'), 0o755).catch(() => undefined))
  )
} catch {
  // Source builds and unsupported prebuild layouts may not include prebuilt helpers.
}
