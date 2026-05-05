import type { ReactNode } from 'react'
import { LanguageContext } from './language'
import { TRANSLATIONS } from './translations'
import type { Language, Translations } from './translations'

interface LanguageProviderProps {
  language: Language
  children: ReactNode
}

export function LanguageProvider({ language, children }: LanguageProviderProps): JSX.Element {
  const translations = TRANSLATIONS[language]

  const t = (key: keyof Translations, vars?: Record<string, string | number>): string => {
    let result = translations[key]
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        result = result.replace(`{${k}}`, String(v))
      }
    }
    return result
  }

  return (
    <LanguageContext.Provider value={{ language, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
