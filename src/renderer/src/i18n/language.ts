import { createContext, useContext } from 'react'
import { TRANSLATIONS } from './translations'
import type { Language, Translations } from './translations'

export interface LanguageContextValue {
  language: Language
  t: (key: keyof Translations, vars?: Record<string, string | number>) => string
}

const defaultT = (key: keyof Translations, vars?: Record<string, string | number>): string => {
  let result = TRANSLATIONS.en[key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(`{${k}}`, String(v))
    }
  }
  return result
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  t: defaultT
})

export function useT(): LanguageContextValue {
  return useContext(LanguageContext)
}
