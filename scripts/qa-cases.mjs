#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const casesDir = path.join(repoRoot, 'docs', 'qa', 'test-cases')

function usage() {
  console.log(`Usage:
  node scripts/qa-cases.mjs list [--group slug] [--priority P0] [--type UI] [--ids TC-A,TC-B]
  node scripts/qa-cases.mjs json [--group slug] [--priority P0] [--type UI] [--ids TC-A,TC-B]
  node scripts/qa-cases.mjs report [--group slug] [--priority P0] [--type UI] [--ids TC-A,TC-B] [--output path]

Examples:
  node scripts/qa-cases.mjs list --priority P0
  node scripts/qa-cases.mjs report --group terminal-core --output /tmp/taviraq-terminal-qa.md`)
}

function parseArgs(argv) {
  const args = { command: argv[2] ?? 'list', groups: [], priorities: [], types: [], ids: [], output: undefined }
  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--help' || arg === '-h') {
      args.command = 'help'
    } else if (arg === '--group' && next) {
      args.groups.push(next)
      i += 1
    } else if (arg === '--priority' && next) {
      args.priorities.push(next.toUpperCase())
      i += 1
    } else if (arg === '--type' && next) {
      args.types.push(next.toLowerCase())
      i += 1
    } else if (arg === '--ids' && next) {
      args.ids.push(...next.split(',').map((id) => id.trim()).filter(Boolean))
      i += 1
    } else if (arg === '--output' && next) {
      args.output = next
      i += 1
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`)
    }
  }
  return args
}

function titleToSlug(title) {
  return title
    .toLowerCase()
    .replace(/and/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseMetadata(block) {
  const metadata = {}
  for (const line of block.split('\n')) {
    const match = line.match(/^- ([A-Za-z ]+):\s*(.*)$/)
    if (match) {
      metadata[match[1].trim().toLowerCase()] = match[2].trim()
    }
  }
  return metadata
}

function parseCases() {
  if (!existsSync(casesDir)) {
    throw new Error(`Test cases directory does not exist: ${casesDir}`)
  }

  const files = readdirSync(casesDir)
    .filter((name) => name.endsWith('.md'))
    .sort()

  const cases = []
  for (const file of files) {
    const fullPath = path.join(casesDir, file)
    const content = readFileSync(fullPath, 'utf8')
    const groupTitle = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file.replace(/\.md$/, '')
    const groupSlug = file.replace(/\.md$/, '')
    const headings = [...content.matchAll(/^##\s+(TC-[A-Z]+-[0-9]{3}):\s+(.+)$/gm)]

    for (let index = 0; index < headings.length; index += 1) {
      const heading = headings[index]
      const next = headings[index + 1]
      const start = heading.index ?? 0
      const end = next?.index ?? content.length
      const block = content.slice(start, end)
      const metadata = parseMetadata(block)
      cases.push({
        id: heading[1],
        title: heading[2].trim(),
        group: groupTitle,
        groupSlug,
        file: path.relative(repoRoot, fullPath),
        priority: metadata.priority ?? '',
        type: metadata.type ?? '',
        sources: metadata.sources ?? '',
        coverage: metadata.coverage ?? '',
        screenshot: metadata.screenshot ?? '',
        groupKey: titleToSlug(groupTitle)
      })
    }
  }
  return cases
}

function filterCases(cases, args) {
  return cases.filter((testCase) => {
    if (args.ids.length > 0 && !args.ids.includes(testCase.id)) return false
    if (args.groups.length > 0) {
      const groups = args.groups.map((group) => group.toLowerCase())
      if (!groups.includes(testCase.groupSlug.toLowerCase()) && !groups.includes(testCase.groupKey)) return false
    }
    if (args.priorities.length > 0 && !args.priorities.includes(testCase.priority.toUpperCase())) return false
    if (args.types.length > 0) {
      const normalizedType = testCase.type.toLowerCase()
      if (!args.types.some((type) => normalizedType.includes(type))) return false
    }
    return true
  })
}

function groupCases(cases) {
  const grouped = new Map()
  for (const testCase of cases) {
    const key = `${testCase.groupSlug}\0${testCase.group}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(testCase)
  }
  return [...grouped.entries()].map(([key, items]) => {
    const [, group] = key.split('\0')
    return { group, items }
  })
}

function renderList(cases) {
  return cases
    .map((testCase) => `${testCase.id}\t${testCase.priority}\t${testCase.type}\t${testCase.group}\t${testCase.title}`)
    .join('\n')
}

function renderReport(cases) {
  const lines = [
    '# Taviraq QA Run Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Status legend: `✅` passed, `❌` failed, `⚠️` blocked or skipped.',
    '',
    'For each `❌` or `⚠️` case, fill in `Reason`, `Expected`, `Actual`, `Evidence`, and `Next` both in its group and in `Not Passed`.',
    ''
  ]

  for (const { group, items } of groupCases(cases)) {
    lines.push(`## ${group}`, '')
    for (const testCase of items) {
      lines.push(`- ⬜ ${testCase.id}: ${testCase.title}`)
    }
    lines.push('')
  }

  lines.push('## Not Passed', '')
  lines.push('Copy every `❌` and `⚠️` case here with details:')
  lines.push('')
  lines.push('- ❌ Group TC-EXAMPLE-001: Example failed case')
  lines.push('  - Reason: ')
  lines.push('  - Expected: ')
  lines.push('  - Actual: ')
  lines.push('  - Evidence: ')
  lines.push('  - Next: ')
  lines.push('')

  return `${lines.join('\n')}\n`
}

function main() {
  const args = parseArgs(process.argv)
  if (args.command === 'help') {
    usage()
    return
  }

  const cases = filterCases(parseCases(), args)
  if (args.command === 'list') {
    console.log(renderList(cases))
  } else if (args.command === 'json') {
    console.log(JSON.stringify(cases, null, 2))
  } else if (args.command === 'report') {
    const report = renderReport(cases)
    if (args.output) {
      writeFileSync(path.resolve(repoRoot, args.output), report)
      console.log(`Wrote ${cases.length} cases to ${args.output}`)
    } else {
      console.log(report)
    }
  } else {
    usage()
    process.exitCode = 1
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

