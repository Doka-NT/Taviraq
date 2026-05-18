export function formatComposerContextChars(count: number): string {
  if (count >= 1000) {
    const rounded = Math.round(count / 100) / 10
    return `${Number.isInteger(rounded) ? Math.trunc(rounded) : rounded}k`
  }

  return String(Math.max(0, count))
}
