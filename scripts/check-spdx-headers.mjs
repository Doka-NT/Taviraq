// SPDX-License-Identifier: MPL-2.0
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

const LICENSE_ID = 'SPDX-License-Identifier: MPL-2.0'
const CODE_COMMENT = `// ${LICENSE_ID}`
const CSS_COMMENT = `/* ${LICENSE_ID} */`
const HTML_COMMENT = `<!-- ${LICENSE_ID} -->`

const FILE_PATTERNS = [
  'src/**',
  'tests/**',
  'scripts/**',
  'electron.vite.config.ts',
  'vitest.config.ts'
]
const CHECKED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html'])

const trackedFiles = execFileSync('git', ['ls-files', ...FILE_PATTERNS], {
  encoding: 'utf8'
})
  .split('\n')
  .filter(Boolean)
  .filter((file) => CHECKED_EXTENSIONS.has(extname(file)))

const failures = []

for (const file of trackedFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split(/\r?\n/)
  const expected = expectedHeaderFor(file)
  const headerLine = headerLineIndex(file, lines)

  if (lines[headerLine]?.trim() !== expected) {
    failures.push(`${file}: expected "${expected}" on line ${headerLine + 1}`)
  }
}

if (failures.length > 0) {
  console.error('Missing or misplaced MPL-2.0 SPDX headers:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log(`SPDX headers verified for ${trackedFiles.length} files.`)

function expectedHeaderFor(file) {
  const extension = extname(file)
  if (extension === '.css') return CSS_COMMENT
  if (extension === '.html') return HTML_COMMENT
  return CODE_COMMENT
}

function headerLineIndex(file, lines) {
  if (lines[0]?.startsWith('#!')) return 1
  if (extname(file) === '.html' && /^<!doctype html>$/i.test(lines[0]?.trim() ?? '')) return 1
  return 0
}
