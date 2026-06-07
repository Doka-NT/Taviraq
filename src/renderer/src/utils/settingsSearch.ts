// SPDX-License-Identifier: MPL-2.0
export interface SettingsSearchItem<T extends string = string> {
  id: T
  label: string
  terms: string[]
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function splitSearchTokens(value: string): string[] {
  return normalizeSearchText(value)
    .split(/[^a-zа-яё0-9\u4e00-\u9fff]+/iu)
    .filter(Boolean)
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  const current = Array.from({ length: b.length + 1 }, () => 0)

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[b.length]
}

function fuzzyDistanceLimit(token: string): number {
  if (token.length < 4) return 0
  if (token.length <= 5) return 2
  return 3
}

function scoreFuzzyToken(queryToken: string, candidateToken: string): number | undefined {
  if (queryToken.length < 3 || candidateToken.length < 3) return undefined
  if (candidateToken.startsWith(queryToken)) return 0
  if (candidateToken.includes(queryToken)) return 1

  const distance = levenshteinDistance(queryToken, candidateToken)
  const limit = fuzzyDistanceLimit(queryToken)
  if (limit > 0 && distance <= limit) return 2 + distance

  return undefined
}

export function matchesSearchQuery(query: string, terms: Array<string | undefined>): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return false
  return terms.some((term) => term?.toLocaleLowerCase().includes(normalizedQuery))
}

export function findFuzzySettingsSuggestions<T extends string>(
  query: string,
  items: Array<SettingsSearchItem<T>>,
  limit = 3
): Array<SettingsSearchItem<T>> {
  const queryTokens = splitSearchTokens(query).filter((token) => token.length >= 3)
  if (queryTokens.length === 0) return []

  return items
    .map((item) => {
      const candidateTokens = splitSearchTokens([item.label, ...item.terms].join(' '))
      const totalScore = queryTokens.reduce<number | undefined>((total, queryToken) => {
        const tokenScore = candidateTokens.reduce<number | undefined>((candidateBest, candidateToken) => {
          const score = scoreFuzzyToken(queryToken, candidateToken)
          return score === undefined || (candidateBest !== undefined && candidateBest <= score)
            ? candidateBest
            : score
        }, undefined)

        if (tokenScore === undefined || total === undefined) return undefined
        return total + tokenScore
      }, 0)

      return totalScore === undefined ? undefined : { item, score: totalScore }
    })
    .filter((result): result is { item: SettingsSearchItem<T>; score: number } => result !== undefined)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      return a.item.label.localeCompare(b.item.label)
    })
    .slice(0, limit)
    .map((result) => result.item)
}
