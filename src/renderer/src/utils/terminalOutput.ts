// SPDX-License-Identifier: MPL-2.0
const SHOW_CURSOR_SEQUENCE = '\x1b[?25h'

export function outputWithVisibleCursor(output: string): string {
  return output ? `${output}${SHOW_CURSOR_SEQUENCE}` : output
}
