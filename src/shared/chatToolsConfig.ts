// SPDX-License-Identifier: MPL-2.0
import type { ChatToolsSettings } from './types'

export function createDefaultChatToolsSettings(): ChatToolsSettings {
  return {
    taskListPlanning: false
  }
}

/**
 * Coerce persisted/imported data into a valid {@link ChatToolsSettings}. Unknown
 * shapes fall back to the defaults, and the flag must be explicitly `true` to be
 * enabled, so a corrupt or partial config never silently turns planning on.
 */
export function normalizeChatToolsSettings(settings: unknown): ChatToolsSettings {
  if (!settings || typeof settings !== 'object') {
    return createDefaultChatToolsSettings()
  }

  const record = settings as Partial<ChatToolsSettings>
  return {
    taskListPlanning: record.taskListPlanning === true
  }
}
