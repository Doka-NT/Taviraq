export function commandLineCandidates(command: string): string[] {
  const candidates = new Set<string>()
  const normalized = command.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return []

  candidates.add(normalized)

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    candidates.add(trimmed)

    const withoutContinuation = trimmed.replace(/\\\s*$/, '').trim()
    if (withoutContinuation) {
      candidates.add(withoutContinuation)
    }
  }

  return [...candidates].sort((a, b) => b.length - a.length)
}

export function lineMatchesCommand(line: string, command: string): boolean {
  return commandLineCandidates(command).some((candidate) => line.includes(candidate))
}
