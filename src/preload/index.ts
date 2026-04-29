import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppConfig,
  ChatStreamEvent,
  ChatStreamRequest,
  CommandRiskAssessment,
  CommandRiskAssessmentRequest,
  CommandProposal,
  CreateTerminalRequest,
  LLMModel,
  SaveLLMProviderRequest,
  SSHProfile,
  TerminalSessionInfo
} from '@shared/types'

const api = {
  config: {
    load: () => ipcRenderer.invoke('config:load') as Promise<AppConfig>
  },
  terminal: {
    create: (request?: CreateTerminalRequest) =>
      ipcRenderer.invoke('terminal:create', request) as Promise<TerminalSessionInfo>,
    list: () => ipcRenderer.invoke('terminal:list') as Promise<TerminalSessionInfo[]>,
    write: (sessionId: string, data: string) => ipcRenderer.invoke('terminal:write', sessionId, data) as Promise<void>,
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', sessionId, cols, rows) as Promise<void>,
    kill: (sessionId: string) => ipcRenderer.invoke('terminal:kill', sessionId) as Promise<void>,
    onData: (callback: (payload: { sessionId: string; data: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; data: string }) => callback(payload)
      ipcRenderer.on('terminal:data', listener)
      return () => {
        ipcRenderer.removeListener('terminal:data', listener)
      }
    },
    onExit: (callback: (payload: { sessionId: string; exitCode: number }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; exitCode: number }) => callback(payload)
      ipcRenderer.on('terminal:exit', listener)
      return () => {
        ipcRenderer.removeListener('terminal:exit', listener)
      }
    },
    onCwd: (callback: (payload: { sessionId: string; cwd: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string; cwd: string }) => callback(payload)
      ipcRenderer.on('terminal:cwd', listener)
      return () => {
        ipcRenderer.removeListener('terminal:cwd', listener)
      }
    },
    onPrompt: (callback: (payload: { sessionId: string }) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string }) => callback(payload)
      ipcRenderer.on('terminal:prompt', listener)
      return () => {
        ipcRenderer.removeListener('terminal:prompt', listener)
      }
    }
  },
  ssh: {
    connectProfile: (profile: SSHProfile, request?: CreateTerminalRequest) =>
      ipcRenderer.invoke('ssh:connectProfile', profile, request) as Promise<TerminalSessionInfo>
  },
  llm: {
    saveProvider: (request: SaveLLMProviderRequest) =>
      ipcRenderer.invoke('llm:saveProvider', request) as Promise<AppConfig>,
    listModels: (request: SaveLLMProviderRequest) =>
      ipcRenderer.invoke('llm:listModels', request) as Promise<LLMModel[]>,
    assessCommandRisk: (request: CommandRiskAssessmentRequest) =>
      ipcRenderer.invoke('llm:assessCommandRisk', request) as Promise<CommandRiskAssessment>,
    chatStream: (request: ChatStreamRequest) => ipcRenderer.send('llm:chatStream', request),
    onChatStreamEvent: (callback: (event: ChatStreamEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: ChatStreamEvent) => callback(payload)
      ipcRenderer.on('llm:chatStream:event', listener)
      return () => {
        ipcRenderer.removeListener('llm:chatStream:event', listener)
      }
    }
  },
  command: {
    propose: (text: string) => ipcRenderer.invoke('command:propose', text) as Promise<CommandProposal[]>,
    runConfirmed: (sessionId: string, command: string) =>
      ipcRenderer.invoke('command:runConfirmed', sessionId, command) as Promise<void>
  }
}

contextBridge.exposeInMainWorld('api', api)

export type DesktopApi = typeof api
