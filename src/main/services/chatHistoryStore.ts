import { app } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SavedChat, SavedChatSummary } from '@shared/types'

const CHAT_HISTORY_FILE = 'chat-history.json'
const MAX_CHATS = 200

interface ChatHistoryFile {
  version: 1
  chats: SavedChat[]
}

export class ChatHistoryStore {
  private readonly path = join(app.getPath('userData'), CHAT_HISTORY_FILE)

  private async loadFile(): Promise<ChatHistoryFile> {
    try {
      const raw = await readFile(this.path, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed.version !== 1 || !Array.isArray(parsed.chats)) return { version: 1, chats: [] }
      return parsed
    } catch {
      return { version: 1, chats: [] }
    }
  }

  private async saveFile(file: ChatHistoryFile): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    await writeFile(this.path, JSON.stringify(file, null, 2), 'utf8')
  }

  async list(): Promise<SavedChatSummary[]> {
    const file = await this.loadFile()
    return file.chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      messageCount: chat.messages.length,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      providerRef: chat.providerRef,
      modelId: chat.modelId,
      sessionSnapshot: chat.sessionSnapshot
    }))
  }

  async get(id: string): Promise<SavedChat | undefined> {
    const file = await this.loadFile()
    return file.chats.find((chat) => chat.id === id)
  }

  async save(chat: SavedChat): Promise<void> {
    const file = await this.loadFile()
    const index = file.chats.findIndex((c) => c.id === chat.id)
    if (index === -1) {
      file.chats.unshift(chat)
    } else {
      file.chats[index] = chat
    }
    if (file.chats.length > MAX_CHATS) {
      file.chats = file.chats.slice(0, MAX_CHATS)
    }
    await this.saveFile(file)
  }

  async delete(id: string): Promise<void> {
    const file = await this.loadFile()
    file.chats = file.chats.filter((c) => c.id !== id)
    await this.saveFile(file)
  }

  async clear(): Promise<void> {
    await rm(this.path, { force: true })
  }
}
