function normalizeCommand(command: string): string {
  return command.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function candidatesForLine(line: string): string[] {
  const candidates = new Set<string>()
  const trimmed = line.trim()
  if (!trimmed) return []

  candidates.add(trimmed)

  const withoutContinuation = trimmed.replace(/\\\s*$/, '').trim()
  if (withoutContinuation) {
    candidates.add(withoutContinuation)
  }

  return [...candidates].sort((a, b) => b.length - a.length)
}

type CommandStartPreference = 'first' | 'last'

function candidateIndex(value: string, candidate: string, preference: CommandStartPreference): number {
  return preference === 'first' ? value.indexOf(candidate) : value.lastIndexOf(candidate)
}

export function commandLineCandidates(command: string): string[] {
  const candidates = new Set<string>()
  const normalized = normalizeCommand(command)
  if (!normalized) return []

  candidates.add(normalized)

  for (const line of normalized.split('\n')) {
    for (const candidate of candidatesForLine(line)) {
      candidates.add(candidate)
    }
  }

  return [...candidates].sort((a, b) => b.length - a.length)
}

export function commandStartLineCandidates(command: string): string[] {
  const firstLine = normalizeCommand(command)
    .split('\n')
    .find((line) => line.trim())

  return firstLine ? candidatesForLine(firstLine) : []
}

export function commandVisibleLineCount(command: string): number {
  return normalizeCommand(command).split('\n').filter((line) => line.trim()).length
}

export function lineMatchesCommand(line: string, command: string): boolean {
  return commandLineCandidates(command).some((candidate) => line.includes(candidate))
}

export function lineMatchesCommandStart(line: string, command: string): boolean {
  return commandStartLineCandidates(command).some((candidate) => line.includes(candidate))
}

export function terminalTailStartOffset(output: string, lineLimit: number): number {
  let start = output.length

  for (let count = 0; count < lineLimit; count += 1) {
    const previousNewline = output.lastIndexOf('\n', start - 1)
    if (previousNewline === -1) return 0
    start = previousNewline
  }

  return start + 1
}

export function findCommandStartOffset(
  output: string,
  command: string,
  options: {
    searchStart?: number
    searchEnd?: number
    preference?: CommandStartPreference
  } = {}
): number {
  const normalized = normalizeCommand(command)
  if (!normalized) return output.length

  const searchStart = Math.max(0, Math.min(output.length, options.searchStart ?? 0))
  const searchEnd = Math.max(searchStart, Math.min(output.length, options.searchEnd ?? output.length))
  const preference = options.preference ?? 'last'
  const searchableOutput = output.slice(searchStart, searchEnd)
  const candidates = [normalized, ...commandStartLineCandidates(command)]
  let matchedIndex: number | undefined

  for (const candidate of candidates) {
    const index = candidateIndex(searchableOutput, candidate, preference)
    if (index === -1) continue

    matchedIndex = matchedIndex === undefined
      ? index
      : preference === 'first'
        ? Math.min(matchedIndex, index)
        : Math.max(matchedIndex, index)
  }

  if (matchedIndex === undefined) return output.length

  const absoluteIndex = searchStart + matchedIndex
  const previousNewline = output.lastIndexOf('\n', absoluteIndex)
  return previousNewline === -1 ? 0 : previousNewline + 1
}

export function stripCommandEcho(command: string, text: string): string {
  const commandLines = normalizeCommand(command).split('\n').filter((line) => line.trim())
  if (commandLines.length === 0) return text

  const lines = text.split('\n')
  let index = 0

  for (const commandLine of commandLines) {
    const line = lines[index]
    if (line === undefined) return text

    const matches = candidatesForLine(commandLine).some((candidate) => line.includes(candidate))
    if (!matches) return text

    index += 1
  }

  return lines.slice(index).join('\n').trim()
}
