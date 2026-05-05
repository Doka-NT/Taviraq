import type { AppTheme } from './types'

const CAMEL_TO_KEBAB = /[A-Z]/g

function camelToKebab(str: string): string {
  return str.replace(CAMEL_TO_KEBAB, (match) => `-${match.toLowerCase()}`)
}

export function applyThemeToDom(theme: AppTheme): void {
  const root = document.documentElement
  const colors = theme.colors as unknown as Record<string, string>

  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${camelToKebab(key)}`, value)
  }
}
