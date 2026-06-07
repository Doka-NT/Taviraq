// SPDX-License-Identifier: MPL-2.0
import type { DesktopApi } from '../../preload'

declare global {
  interface Window {
    api: DesktopApi
  }
}

export {}
