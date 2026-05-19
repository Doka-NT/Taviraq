import { findFuzzySettingsSuggestions, matchesSearchQuery, type SettingsSearchItem } from '@renderer/utils/settingsSearch'

type SettingsTab = 'appearance' | 'providers' | 'connections' | 'security'

const items: Array<SettingsSearchItem<SettingsTab>> = [
  {
    id: 'appearance',
    label: 'Appearance',
    terms: ['Terminal font size', 'Theme', 'Language', 'appearance terminal']
  },
  {
    id: 'providers',
    label: 'Providers',
    terms: ['API key', 'Model', 'Base URL', 'provider connection status']
  },
  {
    id: 'connections',
    label: 'Connections',
    terms: ['SSH host', 'User', 'Identity file', 'connection']
  },
  {
    id: 'security',
    label: 'Security',
    terms: ['Secret masking', 'Audit', 'Token', 'Password']
  }
]

describe('settings search helpers', () => {
  it('matches exact section labels and searchable terms', () => {
    expect(matchesSearchQuery('font', [items[0].label, ...items[0].terms])).toBe(true)
    expect(matchesSearchQuery('ssh', [items[2].label, ...items[2].terms])).toBe(true)
  })

  it('does not match unrelated search terms', () => {
    expect(matchesSearchQuery('billing', items.flatMap((item) => [item.label, ...item.terms]))).toBe(false)
  })

  it('suggests sections for fuzzy misspellings', () => {
    expect(findFuzzySettingsSuggestions('apprnce', items).map((item) => item.id)).toContain('appearance')
    expect(findFuzzySettingsSuggestions('securrty', items).map((item) => item.id)).toContain('security')
  })

  it('returns no fuzzy suggestions for empty or unrelated queries', () => {
    expect(findFuzzySettingsSuggestions('', items)).toEqual([])
    expect(findFuzzySettingsSuggestions('billing', items)).toEqual([])
  })
})
