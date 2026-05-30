import type { Language } from '@renderer/i18n/translations'

export function formatDataBytes(bytes: number, language: Language): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const maximumFractionDigits = unitIndex === 0 || value >= 10 ? 0 : 1
  return `${new Intl.NumberFormat(language, { maximumFractionDigits }).format(value)} ${units[unitIndex]}`
}
