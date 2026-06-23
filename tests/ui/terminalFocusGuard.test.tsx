// SPDX-License-Identifier: MPL-2.0
import { afterEach, describe, expect, it } from 'vitest'
import { dialogOwnsFocus } from '@renderer/utils/dialogFocus'

afterEach(() => {
  document.body.innerHTML = ''
})

function mount(html: string): void {
  document.body.innerHTML = html
}

describe('dialogOwnsFocus', () => {
  it('is false when nothing is focused', () => {
    expect(dialogOwnsFocus(null)).toBe(false)
    expect(dialogOwnsFocus(document.body)).toBe(false)
  })

  it('is false for a tab button outside any dialog', () => {
    mount('<button id="tab" role="tab">tab</button>')
    expect(dialogOwnsFocus(document.getElementById('tab'))).toBe(false)
  })

  it('is true when focus is inside a role="dialog" overlay', () => {
    mount('<div role="dialog"><input id="field" /></div>')
    expect(dialogOwnsFocus(document.getElementById('field'))).toBe(true)
  })

  it('is true when focus is inside a role="alertdialog" (ConfirmDialog)', () => {
    mount('<div role="alertdialog"><button id="confirm">OK</button></div>')
    expect(dialogOwnsFocus(document.getElementById('confirm'))).toBe(true)
  })

  it('is true when focus is inside a native <dialog>', () => {
    mount('<dialog open><input id="native" /></dialog>')
    expect(dialogOwnsFocus(document.getElementById('native'))).toBe(true)
  })
})
