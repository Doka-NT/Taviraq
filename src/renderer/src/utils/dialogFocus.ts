// SPDX-License-Identifier: MPL-2.0

// A modal owns focus when the focused element sits inside any dialog. Callers
// use this to avoid stealing focus (e.g. auto-focusing the terminal) while a
// dialog the user is interacting with sits in front.
const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"], dialog'

export function dialogOwnsFocus(focused: Element | null): boolean {
  return focused instanceof HTMLElement && focused.closest(DIALOG_SELECTOR) !== null
}
