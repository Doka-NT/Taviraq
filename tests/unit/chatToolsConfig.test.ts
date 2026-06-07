// SPDX-License-Identifier: MPL-2.0
import { describe, expect, it } from 'vitest'

import {
  createDefaultChatToolsSettings,
  normalizeChatToolsSettings
} from '@shared/chatToolsConfig'

describe('chat tools settings', () => {
  it('defaults task list planning to off', () => {
    expect(createDefaultChatToolsSettings()).toEqual({ taskListPlanning: false })
  })

  it('keeps an explicit enabled flag', () => {
    expect(normalizeChatToolsSettings({ taskListPlanning: true })).toEqual({
      taskListPlanning: true
    })
  })

  it('only treats a literal true as enabled', () => {
    expect(normalizeChatToolsSettings({ taskListPlanning: 'yes' })).toEqual({
      taskListPlanning: false
    })
    expect(normalizeChatToolsSettings({ taskListPlanning: 1 })).toEqual({
      taskListPlanning: false
    })
  })

  it('falls back to defaults for non-object or empty input', () => {
    expect(normalizeChatToolsSettings(undefined)).toEqual({ taskListPlanning: false })
    expect(normalizeChatToolsSettings(null)).toEqual({ taskListPlanning: false })
    expect(normalizeChatToolsSettings('on')).toEqual({ taskListPlanning: false })
    expect(normalizeChatToolsSettings({})).toEqual({ taskListPlanning: false })
  })
})
