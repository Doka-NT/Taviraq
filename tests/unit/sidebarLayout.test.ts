// SPDX-License-Identifier: MPL-2.0
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const styles = readFileSync(resolve(process.cwd(), 'src/renderer/src/styles.css'), 'utf8')

function cssBlocks(selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...styles.matchAll(new RegExp(`(^|\\n)${escapedSelector}\\s*\\{(?<body>[^}]*)\\}`, 'g'))]
    .map((match) => match.groups?.body ?? '')
}

function hasDeclaration(selector: string, declaration: string): boolean {
  return cssBlocks(selector).some((body) => body.includes(declaration))
}

describe('assistant sidebar layout animation', () => {
  it('uses one synchronized transition for the sidebar track and panel', () => {
    expect(styles).toContain('--sidebar-transition: 260ms cubic-bezier(0.4, 0, 0.2, 1);')
    expect(hasDeclaration('.app-shell', 'transition: none;')).toBe(true)
    expect(hasDeclaration('.app-shell.sidebar-transitioning', 'transition: grid-template-columns var(--sidebar-transition);')).toBe(true)
    expect(hasDeclaration('.sidebar-resizer', 'transition: opacity var(--sidebar-transition);')).toBe(true)
    expect(hasDeclaration('.llm-panel', 'transition: transform var(--sidebar-transition);')).toBe(true)
  })

  it('keeps manual sidebar resizing immediate', () => {
    expect(hasDeclaration('.app-shell.sidebar-resizing', 'transition: none;')).toBe(true)
  })
})
