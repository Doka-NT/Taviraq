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
