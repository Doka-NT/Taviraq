import type {
  ChatMessage,
  ChatStreamEvent,
  ChatStreamRequest,
  CommandRiskAssessment,
  CommandRiskAssessmentRequest,
  GeneratedPrompt,
  LLMModel,
  LLMProviderConfig,
  SummarizeConversationRequest
} from '@shared/types'
import { Agent } from 'undici'
import {
  buildLmStudioNativeUrl,
  buildOllamaNativeUrl,
  buildProviderUrl,
  getProviderType,
  parseLmStudioNativeModelList,
  parseModelList,
  parseOllamaNativeModelList,
  PROVIDER_DEFAULTS
} from '@main/utils/provider'
import { parseChatCompletionChunk, parseSseEvents, parseSseLines } from '@main/utils/llmProtocol'
import { getApiKey } from './secretStore'

const COMMAND_RISK_TIMEOUT_MS = 15_000
const insecureTlsAgent = new Agent({ connect: { rejectUnauthorized: false } })

type ProviderRequestInit = RequestInit & {
  dispatcher?: Agent
}

const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Russian',
  cn: 'Chinese'
}

export async function listModels(provider: LLMProviderConfig): Promise<LLMModel[]> {
  const providerType = getProviderType(provider)
  const url = providerType === 'lmstudio'
    ? buildLmStudioNativeUrl(provider.baseUrl || PROVIDER_DEFAULTS.lmstudio.baseUrl, 'models')
    : providerType === 'ollama'
      ? buildOllamaNativeUrl(provider.baseUrl || PROVIDER_DEFAULTS.ollama.baseUrl, 'tags')
      : buildProviderUrl(provider, 'models')
  const response = await fetchProvider(url, withProviderTls(provider, {
    headers: await buildHeaders(provider)
  }), 'Model')

  if (!response.ok) {
    throw new Error(`Model request failed with ${response.status} ${response.statusText}`)
  }

  const payload = await response.json() as unknown
  if (providerType === 'lmstudio') return parseLmStudioNativeModelList(payload)
  if (providerType === 'ollama') return parseOllamaNativeModelList(payload)
  return parseModelList(payload)
}

type ChatStreamUpdate = Pick<ChatStreamEvent, 'type'> & {
  content?: string
  reasoningContent?: string
  stage?: 'model_load' | 'prompt_processing'
  progress?: number
}

export async function streamChatCompletion(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamUpdate) => void,
  signal?: AbortSignal
): Promise<void> {
  const model = request.provider.selectedModel?.trim()
  if (!model) {
    throw new Error('Select a model before sending a message.')
  }

  if (getProviderType(request.provider) === 'lmstudio') {
    return streamLmStudioNativeChatCompletion(request, model, onChunk, signal)
  }

  if (getProviderType(request.provider) === 'ollama') {
    return streamOllamaNativeChatCompletion(request, model, onChunk, signal)
  }

  const url = buildProviderUrl(request.provider, 'chat/completions')
  const response = await fetchProvider(url, withProviderTls(request.provider, {
    method: 'POST',
    headers: {
      ...await buildHeaders(request.provider),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: buildMessages(request.messages, request.context)
    }),
    signal
  }))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Chat request failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`)
  }

  if (!response.body) {
    throw new Error('Chat response did not include a readable stream.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseLines(buffer)
    buffer = parsed.remainder

    for (const event of parsed.events) {
      if (event === '[DONE]') {
        return
      }

      const chunk = parseChatCompletionChunk(JSON.parse(event) as unknown)
      if (chunk?.content || chunk?.reasoningContent) {
        onChunk({ type: chunk.content ? 'chunk' : 'reasoning', ...chunk })
      }
    }
  }
}

async function streamOllamaNativeChatCompletion(
  request: ChatStreamRequest,
  model: string,
  onChunk: (chunk: ChatStreamUpdate) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = buildOllamaNativeUrl(request.provider.baseUrl || PROVIDER_DEFAULTS.ollama.baseUrl, 'chat')
  const response = await fetchProvider(url, withProviderTls(request.provider, {
    method: 'POST',
    headers: {
      ...await buildHeaders(request.provider),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: buildMessages(request.messages, request.context)
    }),
    signal
  }))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Ollama chat request failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`)
  }

  if (!response.body) {
    throw new Error('Ollama chat response did not include a readable stream.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const payload = safeParseJson(line.trim())
      if (!payload) continue

      const content = readOllamaMessageText(payload, 'content')
      const reasoningContent = readOllamaMessageText(payload, 'thinking')
      if (reasoningContent) onChunk({ type: 'reasoning', reasoningContent })
      if (content) onChunk({ type: 'chunk', content })
    }
  }

  const payload = safeParseJson(buffer.trim())
  if (payload) {
    const content = readOllamaMessageText(payload, 'content')
    const reasoningContent = readOllamaMessageText(payload, 'thinking')
    if (reasoningContent) onChunk({ type: 'reasoning', reasoningContent })
    if (content) onChunk({ type: 'chunk', content })
  }
}

async function streamLmStudioNativeChatCompletion(
  request: ChatStreamRequest,
  model: string,
  onChunk: (chunk: ChatStreamUpdate) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = buildLmStudioNativeUrl(request.provider.baseUrl || PROVIDER_DEFAULTS.lmstudio.baseUrl, 'chat')
  const response = await fetchProvider(url, withProviderTls(request.provider, {
    method: 'POST',
    headers: {
      ...await buildHeaders(request.provider),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      stream: true,
      store: false,
      ...buildLmStudioNativeInput(request.messages, request.context)
    }),
    signal
  }))

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`LM Studio chat request failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`)
  }

  if (!response.body) {
    throw new Error('LM Studio chat response did not include a readable stream.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseEvents(buffer)
    buffer = parsed.remainder

    for (const event of parsed.events) {
      const payload = safeParseJson(event.data)
      const eventType = typeof payload?.type === 'string' ? payload.type : event.event

      if (eventType === 'message.delta') {
        const content = readString(payload, 'content')
        if (content) onChunk({ type: 'chunk', content })
      } else if (eventType === 'reasoning.delta') {
        const reasoningContent = readString(payload, 'content')
        if (reasoningContent) onChunk({ type: 'reasoning', reasoningContent })
      } else if (eventType === 'prompt_processing.start') {
        onChunk({ type: 'progress', stage: 'prompt_processing', progress: 0 })
      } else if (eventType === 'prompt_processing.progress') {
        onChunk({ type: 'progress', stage: 'prompt_processing', progress: readProgress(payload) })
      } else if (eventType === 'prompt_processing.end') {
        onChunk({ type: 'progress', stage: 'prompt_processing', progress: 1 })
      } else if (eventType === 'model_load.start') {
        onChunk({ type: 'progress', stage: 'model_load', progress: 0 })
      } else if (eventType === 'model_load.progress') {
        onChunk({ type: 'progress', stage: 'model_load', progress: readProgress(payload) })
      } else if (eventType === 'model_load.end') {
        onChunk({ type: 'progress', stage: 'model_load', progress: 1 })
      } else if (eventType === 'error') {
        throw new Error(readLmStudioError(payload))
      }
    }
  }
}

export async function assessCommandRisk(request: CommandRiskAssessmentRequest): Promise<CommandRiskAssessment> {
  const model = request.provider.commandRiskModel?.trim()
  if (!model) {
    throw new Error('Select a command safety model before checking command safety.')
  }

  if (getProviderType(request.provider) === 'ollama') {
    const response = await postOllamaNativeChat(
      request.provider,
      model,
      buildCommandRiskMessages(request),
      { options: { temperature: 0 }, timeoutMs: COMMAND_RISK_TIMEOUT_MS }
    )

    return parseCommandRiskAssessment(extractOllamaMessageContent(response))
  }

  const response = await fetchWithTimeout(
    buildProviderUrl(request.provider, 'chat/completions'),
    {
      method: 'POST',
      headers: {
        ...await buildHeaders(request.provider),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0,
        messages: buildCommandRiskMessages(request)
      })
    },
    COMMAND_RISK_TIMEOUT_MS,
    'Command safety check timed out, so the command is treated as risky.'
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Command safety request failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`)
  }

  return parseCommandRiskAssessment(extractMessageContent(await response.json()))
}

export async function summarizeConversation(
  request: SummarizeConversationRequest,
  signal?: AbortSignal
): Promise<GeneratedPrompt> {
  const model = request.provider.selectedModel?.trim()
  if (!model) {
    throw new Error('No model selected.')
  }

  const languageName = request.language ? LANGUAGE_NAMES[request.language] : undefined
  const langInstruction = languageName ? ` Write the prompt in ${languageName}.` : ''

  const conversation = request.messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        'You are a prompt engineer.',
        'Given a conversation, create a concise reusable user prompt and a short descriptive title for it.',
        'The generated prompt will be inserted into the chat input and sent as a normal user message, not as a system/developer instruction.',
        'Write the prompt so it asks the assistant to do the task now: start with a clear action verb, preserve the user intent, include only the necessary constraints, and avoid persona/setup language such as "You are...".',
        'For terminal assistant workflows, prefer prompts that ask the assistant to inspect, diagnose, explain, fix, or propose commands/results instead of merely acknowledging instructions.',
        `${langInstruction} Return only valid JSON with exactly this shape: {"name":"Prompt title","content":"Prompt text"}. Do not include explanations, headings, quotes around the JSON, or Markdown fences.`
      ].join(' ')
    },
    {
      role: 'user',
      content: `Conversation:\n\n${conversation}`
    }
  ]

  let response: Response
  try {
    if (getProviderType(request.provider) === 'ollama') {
      const payload = await postOllamaNativeChat(
        request.provider,
        model,
        messages,
        { options: { temperature: 0.3 }, signal }
      )
      const content = extractOllamaMessageContent(payload)
      if (!content.trim()) throw new Error('Empty response from model.')
      return parseGeneratedPrompt(content)
    }

    response = await postOpenAICompatibleChatCompletion(
      request.provider,
      { model, stream: false, temperature: 0.3, messages },
      signal
    )
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Prompt generation cancelled.')
    }
    throw error
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Summarization request failed with ${response.status}${body ? `: ${body}` : ''}`)
  }

  const content = extractMessageContent(await response.json())
  if (!content.trim()) throw new Error('Empty response from model.')
  return parseGeneratedPrompt(content)
}

async function postOpenAICompatibleChatCompletion(
  provider: LLMProviderConfig,
  body: {
    model: string
    stream: false
    temperature?: number
    messages: ChatMessage[]
  },
  signal?: AbortSignal
): Promise<Response> {
  const url = buildProviderUrl(provider, 'chat/completions')
  const headers = {
    ...await buildHeaders(provider),
    'Content-Type': 'application/json'
  }

  const response = await fetchProvider(url, withProviderTls(provider, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  }))

  if (body.temperature === undefined || response.ok) return response

  const errorBody = await response.text().catch(() => '')
  if (!isUnsupportedTemperatureError(errorBody)) {
    throw new Error(`Summarization request failed with ${response.status}${errorBody ? `: ${errorBody}` : ''}`)
  }

  const { temperature: _temperature, ...defaultTemperatureBody } = body
  return fetchProvider(url, withProviderTls(provider, {
    method: 'POST',
    headers,
    body: JSON.stringify(defaultTemperatureBody),
    signal
  }))
}

function isUnsupportedTemperatureError(body: string): boolean {
  return /temperature/i.test(body) && /unsupported|not support|does not support|only the default/i.test(body)
}

function parseGeneratedPrompt(content: string): GeneratedPrompt {
  const trimmed = content.trim()
  const jsonText = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(jsonText) as Partial<GeneratedPrompt>
    const promptContent = typeof parsed.content === 'string' ? parsed.content.trim() : ''
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : ''

    if (promptContent) {
      return {
        name: name || fallbackPromptName(promptContent),
        content: promptContent
      }
    }
  } catch {
    // Fall through to preserve the generated prompt text if the model ignored JSON.
  }

  return {
    name: fallbackPromptName(trimmed),
    content: trimmed
  }
}

function fallbackPromptName(content: string): string {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return 'Generated prompt'

  return firstLine
    .replace(/^#+\s*/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .slice(0, 80)
}

async function fetchWithTimeout(
  url: string,
  init: ProviderRequestInit,
  timeoutMs: number,
  timeoutMessage: string
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(timeoutMessage)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchProvider(url: string, init: RequestInit, label = 'Provider'): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    throw new Error(`${label} request to ${url} failed: ${formatFetchError(error)}`)
  }
}

function withProviderTls(provider: LLMProviderConfig, init: RequestInit): ProviderRequestInit {
  if (!provider.allowInsecureTls) return init
  return {
    ...init,
    dispatcher: insecureTlsAgent
  }
}

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)

  const cause = error.cause
  if (cause && typeof cause === 'object') {
    const code = (cause as { code?: unknown }).code
    const message = (cause as { message?: unknown }).message
    if (typeof code === 'string' && typeof message === 'string') {
      return `${error.message} (${code}: ${message})`
    }
    if (typeof message === 'string') {
      return `${error.message} (${message})`
    }
  }

  return error.message
}

async function postOllamaNativeChat(
  provider: LLMProviderConfig,
  model: string,
  messages: ChatMessage[],
  options?: {
    options?: Record<string, unknown>
    signal?: AbortSignal
    timeoutMs?: number
  }
): Promise<unknown> {
  const url = buildOllamaNativeUrl(provider.baseUrl || PROVIDER_DEFAULTS.ollama.baseUrl, 'chat')
  const init = withProviderTls(provider, {
    method: 'POST',
    headers: {
      ...await buildHeaders(provider),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      ...(options?.options ? { options: options.options } : {})
    }),
    signal: options?.signal
  })

  const response = options?.timeoutMs
    ? await fetchWithTimeout(url, init, options.timeoutMs, 'Command safety check timed out, so the command is treated as risky.')
    : await fetchProvider(url, init, 'Ollama chat')

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Ollama chat request failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`)
  }

  return response.json() as Promise<unknown>
}

function buildLmStudioNativeInput(
  messages: ChatMessage[],
  context: ChatStreamRequest['context']
): { system_prompt: string; input: string } {
  const builtMessages = buildMessages(messages, context)
  const systemPrompt = builtMessages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  const transcript = builtMessages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}:\n${message.content}`)
    .join('\n\n')

  return {
    system_prompt: systemPrompt,
    input: transcript || messages.at(-1)?.content || ''
  }
}

function safeParseJson(data: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(data) as unknown
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

function readString(payload: Record<string, unknown> | undefined, key: string): string {
  const value = payload?.[key]
  return typeof value === 'string' ? value : ''
}

function readOllamaMessageText(payload: Record<string, unknown> | undefined, key: 'content' | 'thinking'): string {
  const message = payload?.message
  if (!message || typeof message !== 'object') return ''

  const value = (message as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function extractOllamaMessageContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''

  return readOllamaMessageText(payload as Record<string, unknown>, 'content')
}

function readProgress(payload: Record<string, unknown> | undefined): number {
  const value = payload?.progress
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : 0
}

function readLmStudioError(payload: Record<string, unknown> | undefined): string {
  const error = payload?.error
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }

  const message = payload?.message
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : 'LM Studio returned a streaming error.'
}

async function buildHeaders(provider: LLMProviderConfig): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    ...(provider.defaultHeaders ?? {})
  }

  const apiKey = await getApiKey(provider.apiKeyRef)
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return headers
}

function buildCommandRiskMessages(request: CommandRiskAssessmentRequest): ChatMessage[] {
  const context = request.context
  const contextLines = [
    context.session ? `Active session: ${context.session.label} (${context.session.kind}).` : undefined,
    context.session?.cwd ? `Current directory: ${context.session.cwd}.` : undefined,
    context.session?.shell ? `Shell: ${context.session.shell}.` : undefined,
    context.terminalOutput ? `Recent terminal output:\n${stripAnsi(context.terminalOutput).slice(-3000)}` : undefined
  ].filter(Boolean).join('\n')

  const languageName = context.language ? LANGUAGE_NAMES[context.language] : undefined
  const reasonFormat = languageName
    ? `{"dangerous": boolean, "reason": string (MUST be written in ${languageName})}`
    : `{"dangerous": boolean, "reason": string}`

  return [
    {
      role: 'system',
      content: [
        'You are a shell command safety classifier.',
        'Analyze only the command and terminal context in this request.',
        `Return JSON only, with this exact shape: ${reasonFormat}.`,
        'Mark dangerous true for commands that can delete, overwrite, move, chmod/chown, install/uninstall, change config, expose secrets, modify remote systems, escalate privileges, kill processes, shutdown/reboot, perform destructive git/package operations, or otherwise cause persistent side effects.',
        'Mark dangerous false for read-only inspection commands such as pwd, ls, cat, grep, find, git status, and help/version commands.'
      ].join('\n')
    },
    {
      role: 'user',
      content: `${contextLines ? `${contextLines}\n\n` : ''}Command:\n\`\`\`sh\n${request.command}\n\`\`\``
    }
  ]
}

function extractMessageContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return ''
  const [first] = choices as unknown[]
  if (!first || typeof first !== 'object') return ''
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content : ''
}

function parseCommandRiskAssessment(content: string): CommandRiskAssessment {
  try {
    const json = content.match(/\{[\s\S]*\}/)?.[0]
    if (!json) {
      throw new Error('missing JSON')
    }
    const parsed = JSON.parse(json) as { dangerous?: unknown; reason?: unknown }
    const dangerous = parsed.dangerous === false || parsed.dangerous === 'false' ? false : true
    return {
      dangerous,
      reason: typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim()
        : 'The safety classifier did not provide a reason.'
    }
  } catch {
    return {
      dangerous: true,
      reason: 'The safety classifier returned an unreadable response, so the command is treated as risky.'
    }
  }
}

const ANSI_ESCAPE = String.fromCharCode(27)
const ANSI_RE = new RegExp(
  `${ANSI_ESCAPE}\\[[0-9;]*[mGKHFABCDJMPXZ]|${ANSI_ESCAPE}[@-_]|${ANSI_ESCAPE}\\[[0-9;]*[Rn]`,
  'g'
)

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

function buildMessages(messages: ChatMessage[], context: ChatStreamRequest['context']): ChatMessage[] {
  const mode = context.assistMode ?? 'off'
  const languageName = context.language ? LANGUAGE_NAMES[context.language] : undefined
  const languageInstruction = languageName
    ? `Always respond in ${languageName}.`
    : undefined

  const contextLines = [
    'You are an AI assistant embedded in a desktop terminal.',
    'Prefer concise, actionable terminal help.',
    languageInstruction,
    ...buildModeInstructions(mode),
    context.session ? `Active session: ${context.session.label} (${context.session.kind}).` : undefined,
    context.session?.cwd ? `Current directory: ${context.session.cwd}.` : undefined,
    context.selectedText ? `Selected terminal output:\n${context.selectedText}` : undefined,
    context.terminalOutput ? `Recent terminal output:\n${stripAnsi(context.terminalOutput)}` : undefined
  ].filter(Boolean).join('\n')

  return [
    {
      role: 'system',
      content: contextLines
    },
    ...messages
  ]
}

function buildModeInstructions(mode: ChatStreamRequest['context']['assistMode']): string[] {
  if (mode === 'agent') {
    return [
      'Agent mode is enabled. The app can run one command from your response automatically in the active terminal.',
      'When you need the app to run a command, write a short marker line exactly like "Выполню:" or "I will run:" immediately followed by exactly one fenced shell code block containing only that command.',
      'Example of an auto-runnable command:\nВыполню:\n```bash\npwd\n```',
      'You may include other fenced bash/sh examples for the user to read, but do not put the marker line immediately before examples, alternatives, or explanatory snippets.',
      'If you include examples, clearly introduce them as examples, such as "Например, вручную можно было бы:" before the code block.',
      'The app will send the command output back to you; do not claim success until you see that output.',
      'Avoid destructive commands unless the user explicitly asked for them, and finish with a normal answer when no more commands are needed.'
    ]
  }

  if (mode === 'read') {
    return [
      'Read-only terminal context is enabled.',
      'When suggesting commands, put each command in a fenced bash code block.',
      'Never claim a command was executed unless the user confirmed it.'
    ]
  }

  return [
    'When suggesting commands, put each command in a fenced bash code block.',
    'Never claim a command was executed unless the user confirmed it.'
  ]
}
