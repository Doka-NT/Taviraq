import type { CommandProposal } from '@shared/types'

const COMMAND_LANGUAGES = new Set(['bash', 'sh', 'shell', 'zsh', 'fish', 'terminal', 'console'])

export function extractCommandProposals(text: string): CommandProposal[] {
  const proposals: CommandProposal[] = []
  const fencePattern = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(text)) !== null) {
    const language = match[1].toLowerCase()
    if (language && !COMMAND_LANGUAGES.has(language)) {
      continue
    }

    const commands = splitCommandBlock(match[2])
    const explanation = nearestExplanation(text.slice(0, match.index))

    for (const command of commands) {
      proposals.push({
        id: stableCommandId(command, proposals.length),
        command,
        explanation
      })
    }
  }

  return dedupeProposals(proposals)
}

function splitCommandBlock(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#'))
    .map((line) => stripPrompt(line))
}

function stripPrompt(line: string): string {
  return line.replace(/^([$#>])\s+/, '')
}

function nearestExplanation(prefix: string): string {
  const paragraphs = prefix
    .split(/\n{2,}/)
    .map((part) => part.replace(/```[\s\S]*$/, '').trim())
    .filter(Boolean)

  const fallback = 'LLM suggested command'
  const last = paragraphs.at(-1)
  if (!last) {
    return fallback
  }

  return last.replace(/\s+/g, ' ').slice(0, 180)
}

function stableCommandId(command: string, index: number): string {
  let hash = 0
  for (let i = 0; i < command.length; i += 1) {
    hash = (hash * 31 + command.charCodeAt(i)) >>> 0
  }

  return `cmd-${index}-${hash.toString(16)}`
}

function dedupeProposals(proposals: CommandProposal[]): CommandProposal[] {
  const seen = new Set<string>()

  return proposals.filter((proposal) => {
    if (seen.has(proposal.command)) {
      return false
    }
    seen.add(proposal.command)
    return true
  })
}
