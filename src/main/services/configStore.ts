import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import type { AppConfig, LLMProviderConfig, SSHProfileConfig } from '@shared/types'

const CONFIG_FILE = 'config.json'

const defaultConfig: AppConfig = {
  providers: [
    {
      name: 'OpenAI Compatible',
      providerType: 'openai',
      baseUrl: 'https://api.openai.com',
      apiKeyRef: 'openai-compatible-default',
      selectedModel: '',
      commandRiskModel: ''
    }
  ],
  activeProviderRef: 'openai-compatible-default',
  hideShortcut: 'CommandOrControl+Shift+Space',
  windowBounds: {
    width: 1440,
    height: 920
  }
}

export class ConfigStore {
  private readonly path = join(app.getPath('userData'), CONFIG_FILE)
  private writeQueue: Promise<void> = Promise.resolve()

  async load(): Promise<AppConfig> {
    try {
      const raw = await readFile(this.path, 'utf8')
      return { ...defaultConfig, ...JSON.parse(raw) as AppConfig }
    } catch {
      return defaultConfig
    }
  }

  async save(config: AppConfig): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const tmpPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf8')
    await rename(tmpPath, this.path)
  }

  async update(mutator: (config: AppConfig) => AppConfig): Promise<AppConfig> {
    let nextConfig: AppConfig | undefined
    const write = this.writeQueue.then(async () => {
      const config = await this.load()
      nextConfig = mutator(config)
      await this.save(nextConfig)
    })
    this.writeQueue = write.catch(() => undefined)
    await write
    return nextConfig ?? defaultConfig
  }

  async deleteProvider(apiKeyRef: string): Promise<AppConfig> {
    return this.update((config) => {
      const providers = config.providers.filter((p) => p.apiKeyRef !== apiKeyRef)
      const activeRef = config.activeProviderRef === apiKeyRef
        ? providers[0]?.apiKeyRef
        : config.activeProviderRef
      return { ...config, providers, activeProviderRef: activeRef }
    })
  }

  async upsertProvider(provider: LLMProviderConfig): Promise<AppConfig> {
    return this.update((config) => {
      const existingIndex = config.providers.findIndex((candidate) => candidate.apiKeyRef === provider.apiKeyRef)
      const providers = existingIndex === -1
        ? [...config.providers, provider]
        : config.providers.map((candidate, index) => index === existingIndex ? provider : candidate)

      return {
        ...config,
        providers,
        activeProviderRef: provider.apiKeyRef
      }
    })
  }

  listSshProfiles(config: AppConfig): SSHProfileConfig[] {
    return config.sshProfiles ?? []
  }

  async upsertSshProfile(profile: SSHProfileConfig): Promise<AppConfig> {
    return this.update((config) => {
      const profiles = config.sshProfiles ?? []
      const existingIndex = profiles.findIndex((candidate) => candidate.id === profile.id)
      const nextProfiles = existingIndex === -1
        ? [...profiles, profile]
        : profiles.map((candidate, index) => index === existingIndex ? profile : candidate)

      return { ...config, sshProfiles: nextProfiles }
    })
  }

  async deleteSshProfile(id: string): Promise<AppConfig> {
    return this.update((config) => {
      const nextProfiles = (config.sshProfiles ?? []).filter((p) => p.id !== id)
      return { ...config, sshProfiles: nextProfiles }
    })
  }
}
