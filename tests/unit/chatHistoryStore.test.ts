// SPDX-License-Identifier: MPL-2.0
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const TMP_DIR = join(__dirname, '__tmp_chat_history_store__')

vi.mock('electron', () => ({
  app: {
    getPath: () => TMP_DIR
  }
}))

import { ChatHistoryStore } from '@main/services/chatHistoryStore'
import type { SavedChat } from '@shared/types'

async function cleanTmp(): Promise<void> {
  if (existsSync(TMP_DIR)) {
    await rm(TMP_DIR, { recursive: true })
  }
}

describe('ChatHistoryStore', () => {
  afterEach(() => cleanTmp())

  it('preserves privacy masking metadata when saving and reopening chats', async () => {
    const store = new ChatHistoryStore()
    const chat: SavedChat = {
      id: 'chat-privacy',
      title: 'Privacy notice',
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:00:00.000Z',
      messages: [{
        role: 'assistant',
        content: '2 secret(s) masked before sending to LLM.',
        display: 'privacy-status',
        output: '2',
        privacy: {
          maskedSecretCount: 2,
          categories: ['GENERIC_API_KEY', 'password'],
          source: 'chat-stream',
          scope: 'provider-payload',
          sessionLabel: 'Local'
        }
      }]
    }

    await store.save(chat)

    const restored = await store.get(chat.id)
    expect(restored?.messages[0].privacy).toEqual(chat.messages[0].privacy)
  })
})
