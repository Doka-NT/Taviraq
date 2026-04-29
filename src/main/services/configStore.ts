import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppConfig, LLMProviderConfig } from '@shared/types'

const CONFIG_FILE = 'config.json'

const defaultConfig: AppConfig = {
  providers: [
    {
      name: 'OpenAI Compatible',
      baseUrl: 'https://api.openai.com',
      apiKeyRef: 'openai-compatible-default',
      selectedModel: '',
      commandRiskModel: ''
    }
  ],
  activeProviderRef: 'openai-compatible-default'
}

export class ConfigStore {
  private readonly path = join(app.getPath('userData'), CONFIG_FILE)

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
    await writeFile(this.path, JSON.stringify(config, null, 2), 'utf8')
  }

  async upsertProvider(provider: LLMProviderConfig): Promise<AppConfig> {
    const config = await this.load()
    const providers = config.providers.filter((candidate) => candidate.apiKeyRef !== provider.apiKeyRef)
    providers.push(provider)

    const next = {
      ...config,
      providers,
      activeProviderRef: provider.apiKeyRef
    }

    await this.save(next)
    return next
  }
}
