import type {
  ChatMessage,
  ChatStreamEvent,
  ChatStreamRequest,
  CommandRiskAssessment,
  CommandRiskAssessmentRequest,
  CommandRiskLevel,
  GeneratedPrompt,
  LLMModel,
  LLMProviderConfig,
  SummarizeConversationRequest
} from '@shared/types'
import { Agent, ProxyAgent, type Dispatcher } from 'undici'
import {
  buildAnthropicUrl,
  buildLmStudioNativeUrl,
  buildOllamaNativeUrl,
  buildProviderUrl,
  getProviderType,
  parseAnthropicModelList,
  parseLmStudioNativeModelList,
  parseModelList,
  parseOllamaNativeModelList,
  PROVIDER_DEFAULTS
} from '@main/utils/provider'
import { assessProtectedCommandRisk } from '@main/utils/commandRisk'
import { buildAssistantPromptMessages, LANGUAGE_NAMES } from '@shared/promptBuilder'
import { parseAnthropicStreamEvent, parseChatCompletionChunk, parseSseEvents, parseSseLines } from '@main/utils/llmProtocol'
import { normalizeHttpProxyUrl } from '@main/utils/proxy'
import {
  createStreamingPlaceholderRedactor,
  maskChatStreamRequest,
  maskCommandRiskAssessmentRequest,
  maskSummarizeConversationRequest,
  type SecretMaskContext,
  type SecretMaskingInput
} from '@main/utils/secretMasking'
import { getApiKey, getProxyPassword } from './secretStore'

const COMMAND_RISK_TIMEOUT_MS = 15_000
const ANTHROPIC_API_VERSION = '2023-06-01'
const ANTHROPIC_MAX_TOKENS = 4096
const ANTHROPIC_MODEL_PAGE_LIMIT = 1000
const MAX_PROXY_AGENTS = 16
const insecureTlsAgent = new Agent({ connect: { rejectUnauthorized: false } })
const proxyAgents = new Map<string, ProxyAgent>()

type ProviderRequestInit = RequestInit & {
  dispatcher?: Dispatcher
}

export interface ProviderCredentialOverrides {
  apiKey?: string
  proxyPassword?: string
}

export async function listModels(provider: LLMProviderConfig, credentialOverrides?: ProviderCredentialOverrides): Promise<LLMModel[]> {
  const providerType = getProviderType(provider)
  if (providerType === 'anthropic') {
    return listAnthropicModels(provider, credentialOverrides)
  }

  const url = providerType === 'lmstudio'
    ? buildLmStudioNativeUrl(provider.baseUrl || PROVIDER_DEFAULTS.lmstudio.baseUrl, 'models')
    : providerType === 'ollama'
      ? buildOllamaNativeUrl(provider.baseUrl || PROVIDER_DEFAULTS.ollama.baseUrl, 'tags')
      : buildProviderUrl(provider, 'models')
  const response = await fetchProvider(url, await withProviderTransport(provider, {
    headers: await buildHeaders(provider, credentialOverrides?.apiKey)
  }, credentialOverrides), 'Model')

  if (!response.ok) {
    throw new Error(`Model request failed with ${response.status} ${response.statusText}`)
  }

  const payload = await response.json() as unknown
  if (providerType === 'lmstudio') return parseLmStudioNativeModelList(payload)
  if (providerType === 'ollama') return parseOllamaNativeModelList(payload)
  return parseModelList(payload)
}

async function listAnthropicModels(provider: LLMProviderConfig, credentialOverrides?: ProviderCredentialOverrides): Promise<LLMModel[]> {
  const modelsById = new Map<string, LLMModel>()
  let afterId: string | undefined

  while (true) {
    const url = buildAnthropicModelsPageUrl(provider, afterId)
    const response = await fetchProvider(url, await withProviderTransport(provider, {
      headers: await buildHeaders(provider, credentialOverrides?.apiKey)
    }, credentialOverrides), 'Model')

    if (!response.ok) {
      throw new Error(`Model request failed with ${response.status} ${response.statusText}`)
    }

    const payload = await response.json() as unknown
    for (const model of parseAnthropicModelList(payload)) {
      modelsById.set(model.id, model)
    }

    if (!readAnthropicHasMore(payload)) {
      return [...modelsById.values()].sort((a, b) => a.id.localeCompare(b.id))
    }

    afterId = readAnthropicLastId(payload)
    if (!afterId) {
      throw new Error('Anthropic model list response did not include last_id for the next page.')
    }
  }
}

type ChatStreamUpdate = Pick<ChatStreamEvent, 'type'> & {
  content?: string
  reasoningContent?: string
  maskedSecrets?: number
  categories?: string[]
  stage?: 'model_load' | 'prompt_processing'
  progress?: number
}

export interface ChatStreamCompletionResult {
  maskedContent: string
  maskedSecretCount: number
  secretContext: SecretMaskContext
}

export async function streamChatCompletion(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamUpdate) => void,
  signal?: AbortSignal,
  secretMaskingMode: SecretMaskingInput = 'on',
  existingSecretContext?: SecretMaskContext
): Promise<ChatStreamCompletionResult> {
  const masked = await maskChatStreamRequest(request, secretMaskingMode, signal, existingSecretContext)
  const contentRedactor = createStreamingPlaceholderRedactor()
  const reasoningRedactor = createStreamingPlaceholderRedactor()
  let maskedContent = ''

  if (masked.context.bindings.length > 0) {
    onChunk({
      type: 'privacy',
      maskedSecrets: masked.context.bindings.length,
      categories: [...new Set(masked.context.bindings.map((binding) => binding.kind))]
    })
  }

  await streamChatCompletionUnsafe(masked.request, (chunk) => {
    if (chunk.type === 'progress') {
      onChunk(chunk)
      return
    }

    if (chunk.reasoningContent) {
      const content = reasoningRedactor.push(chunk.reasoningContent)
      if (content) onChunk({ type: 'reasoning', reasoningContent: content })
    }

    if (chunk.content) {
      maskedContent += chunk.content
      const content = contentRedactor.push(chunk.content)
      if (content) onChunk({ type: 'chunk', content })
    }
  }, signal)

  const finalReasoning = reasoningRedactor.flush()
  if (finalReasoning) onChunk({ type: 'reasoning', reasoningContent: finalReasoning })

  const finalContent = contentRedactor.flush()
  if (finalContent) onChunk({ type: 'chunk', content: finalContent })

  return {
    maskedContent,
    maskedSecretCount: masked.context.bindings.length,
    secretContext: masked.context
  }
}

async function streamChatCompletionUnsafe(
  request: ChatStreamRequest,
  onChunk: (chunk: ChatStreamUpdate) => void,
  signal?: AbortSignal
): Promise<void> {
  const model = request.provider.selectedModel?.trim()
  if (!model) {
    throw new Error('Select a model before sending a message.')
  }

  const providerType = getProviderType(request.provider)

  if (providerType === 'lmstudio') {
    return streamLmStudioNativeChatCompletion(request, model, onChunk, signal)
  }

  if (providerType === 'ollama') {
    return streamOllamaNativeChatCompletion(request, model, onChunk, signal)
  }

  if (providerType === 'anthropic') {
    return streamAnthropicChatCompletion(request, model, onChunk, signal)
  }

  const url = buildProviderUrl(request.provider, 'chat/completions')
  const response = await fetchProvider(url, await withProviderTransport(request.provider, {
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

  buffer += decoder.decode()
  for (const event of parseFinalSseLines(buffer)) {
    if (event === '[DONE]') {
      return
    }

    const payload = safeParseJson(event)
    if (!payload) continue

    const chunk = parseChatCompletionChunk(payload)
    if (chunk?.content || chunk?.reasoningContent) {
      onChunk({ type: chunk.content ? 'chunk' : 'reasoning', ...chunk })
    }
  }
}

async function streamAnthropicChatCompletion(
  request: ChatStreamRequest,
  model: string,
  onChunk: (chunk: ChatStreamUpdate) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = buildAnthropicUrl(request.provider.baseUrl || PROVIDER_DEFAULTS.anthropic.baseUrl, 'messages')
  const response = await fetchProvider(url, await withProviderTransport(request.provider, {
    method: 'POST',
    headers: {
      ...await buildHeaders(request.provider),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      stream: true,
      ...buildAnthropicMessageInput(buildMessages(request.messages, request.context))
    }),
    signal
  }), 'Anthropic chat')

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Anthropic chat request failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`)
  }

  if (!response.body) {
    throw new Error('Anthropic chat response did not include a readable stream.')
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
      if (event.event === 'message_stop') {
        return
      }

      const chunk = parseAnthropicStreamEvent(event)
      if (chunk?.content) {
        onChunk({ type: 'chunk', content: chunk.content })
      }
    }
  }

  buffer += decoder.decode()
  for (const event of parseFinalSseEvents(buffer)) {
    if (event.event === 'message_stop') {
      return
    }

    const chunk = parseAnthropicStreamEvent(event)
    if (chunk?.content) {
      onChunk({ type: 'chunk', content: chunk.content })
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
  const response = await fetchProvider(url, await withProviderTransport(request.provider, {
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

  buffer += decoder.decode()
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
  const response = await fetchProvider(url, await withProviderTransport(request.provider, {
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
      processLmStudioStreamEvent(event, onChunk)
    }
  }

  buffer += decoder.decode()
  for (const event of parseFinalSseEvents(buffer)) {
    processLmStudioStreamEvent(event, onChunk)
  }
}

function processLmStudioStreamEvent(
  event: { event?: string; data: string },
  onChunk: (chunk: ChatStreamUpdate) => void
): void {
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

function parseFinalSseLines(buffer: string): string[] {
  if (!buffer.trim()) return []
  return parseSseLines(`${buffer}\n\n`).events
}

function parseFinalSseEvents(buffer: string): Array<{ event?: string; data: string }> {
  if (!buffer.trim()) return []
  return parseSseEvents(`${buffer}\n\n`).events
}

export async function assessCommandRisk(
  request: CommandRiskAssessmentRequest,
  secretMaskingMode: SecretMaskingInput = 'on',
  existingSecretContext?: SecretMaskContext,
  onMaskedContext?: (context: SecretMaskContext) => void | Promise<void>
): Promise<CommandRiskAssessment> {
  const masked = await maskCommandRiskAssessmentRequest(request, secretMaskingMode, undefined, existingSecretContext)
  if (masked.context.bindings.length > 0) {
    await onMaskedContext?.(masked.context)
  }
  const safeRequest = masked.request
  const protectedAssessment = assessProtectedCommandRisk(safeRequest)
  if (protectedAssessment) return protectedAssessment

  const model = safeRequest.provider.commandRiskModel?.trim()
  if (!model) {
    throw new Error('Select a command safety model before checking command safety.')
  }

  if (getProviderType(safeRequest.provider) === 'ollama') {
    const response = await postOllamaNativeChat(
      safeRequest.provider,
      model,
      buildCommandRiskMessages(safeRequest),
      { options: { temperature: 0 }, timeoutMs: COMMAND_RISK_TIMEOUT_MS }
    )

    return parseCommandRiskAssessment(extractOllamaMessageContent(response))
  }

  if (getProviderType(safeRequest.provider) === 'anthropic') {
    const response = await postAnthropicMessage(
      safeRequest.provider,
      model,
      buildCommandRiskMessages(safeRequest),
      { temperature: 0, timeoutMs: COMMAND_RISK_TIMEOUT_MS }
    )

    return parseCommandRiskAssessment(extractAnthropicMessageContent(response))
  }

  const response = await fetchWithTimeout(
    buildProviderUrl(safeRequest.provider, 'chat/completions'),
    await withProviderTransport(safeRequest.provider, {
      method: 'POST',
      headers: {
        ...await buildHeaders(safeRequest.provider),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0,
        messages: buildCommandRiskMessages(safeRequest)
      })
    }),
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
  signal?: AbortSignal,
  secretMaskingMode: SecretMaskingInput = 'on',
  onMaskedContext?: (context: SecretMaskContext) => void
): Promise<GeneratedPrompt> {
  const masked = await maskSummarizeConversationRequest(request, secretMaskingMode, signal)
  if (masked.context.bindings.length > 0) {
    onMaskedContext?.(masked.context)
  }
  const safeRequest = masked.request
  const model = safeRequest.provider.selectedModel?.trim()
  if (!model) {
    throw new Error('No model selected.')
  }

  const languageName = safeRequest.language ? LANGUAGE_NAMES[safeRequest.language] : undefined
  const langInstruction = languageName ? ` Write the prompt in ${languageName}.` : ''

  const conversation = safeRequest.messages
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
        masked.context.bindings.length > 0
          ? 'Some values were replaced with opaque local secret placeholders. Do not include those placeholders or their real values in the generated reusable prompt.'
          : undefined,
        `${langInstruction} Return only valid JSON with exactly this shape: {"name":"Prompt title","content":"Prompt text"}. Do not include explanations, headings, quotes around the JSON, or Markdown fences.`
      ].filter(Boolean).join(' ')
    },
    {
      role: 'user',
      content: `Conversation:\n\n${conversation}`
    }
  ]

  let response: Response
  try {
    if (getProviderType(safeRequest.provider) === 'ollama') {
      const payload = await postOllamaNativeChat(
        safeRequest.provider,
        model,
        messages,
        { options: { temperature: 0.3 }, signal }
      )
      const content = extractOllamaMessageContent(payload)
      if (!content.trim()) throw new Error('Empty response from model.')
      return parseGeneratedPrompt(content)
    }

    if (getProviderType(safeRequest.provider) === 'anthropic') {
      const payload = await postAnthropicMessage(
        safeRequest.provider,
        model,
        messages,
        { temperature: 0.3, signal }
      )
      const content = extractAnthropicMessageContent(payload)
      if (!content.trim()) throw new Error('Empty response from model.')
      return parseGeneratedPrompt(content)
    }

    response = await postOpenAICompatibleChatCompletion(
      safeRequest.provider,
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

  const response = await fetchProvider(url, await withProviderTransport(provider, {
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

  const defaultTemperatureBody = { ...body }
  delete defaultTemperatureBody.temperature
  return fetchProvider(url, await withProviderTransport(provider, {
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

async function withProviderTransport(
  provider: LLMProviderConfig,
  init: RequestInit,
  credentialOverrides?: ProviderCredentialOverrides
): Promise<ProviderRequestInit> {
  const proxyUrl = provider.proxyUrl?.trim()
  if (!proxyUrl) {
    if (!provider.allowInsecureTls) return init
    return {
      ...init,
      dispatcher: insecureTlsAgent
    }
  }

  return {
    ...init,
    dispatcher: await getProxyAgent(provider, proxyUrl, credentialOverrides?.proxyPassword)
  }
}

async function getProxyAgent(provider: LLMProviderConfig, proxyUrl: string, proxyPasswordOverride?: string): Promise<ProxyAgent> {
  const proxy = normalizeHttpProxyUrl(proxyUrl)
  const token = await buildProxyAuthToken(provider, proxyPasswordOverride)
  const cacheKey = [
    provider.apiKeyRef,
    proxy,
    provider.allowInsecureTls ? 'insecure-target-tls' : 'default-target-tls',
    token ?? ''
  ].join('\0')

  const cached = proxyAgents.get(cacheKey)
  if (cached) {
    proxyAgents.delete(cacheKey)
    proxyAgents.set(cacheKey, cached)
    return cached
  }

  const agent = new ProxyAgent({
    uri: proxy,
    ...(token ? { token } : {}),
    ...(provider.allowInsecureTls ? { requestTls: { rejectUnauthorized: false } } : {})
  })
  rememberProxyAgent(cacheKey, agent)
  return agent
}

function rememberProxyAgent(cacheKey: string, agent: ProxyAgent): void {
  proxyAgents.set(cacheKey, agent)
  if (proxyAgents.size <= MAX_PROXY_AGENTS) return

  const oldest = proxyAgents.entries().next().value
  if (!oldest) return

  const [oldestKey, oldestAgent] = oldest
  proxyAgents.delete(oldestKey)
  void oldestAgent.close().catch(() => undefined)
}

export function invalidateProviderProxyAgents(apiKeyRef: string): void {
  const cacheKeyPrefix = `${apiKeyRef}\0`
  for (const [cacheKey, agent] of proxyAgents) {
    if (!cacheKey.startsWith(cacheKeyPrefix)) continue
    proxyAgents.delete(cacheKey)
    void agent.close().catch(() => undefined)
  }
}

async function buildProxyAuthToken(provider: LLMProviderConfig, proxyPasswordOverride?: string): Promise<string | undefined> {
  const username = provider.proxyUsername?.trim()
  if (!username) return undefined

  const password = proxyPasswordOverride !== undefined
    ? proxyPasswordOverride
    : provider.proxyPasswordRef
      ? await getProxyPassword(provider.proxyPasswordRef)
      : undefined
  return `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}`
}

function buildAnthropicModelsPageUrl(provider: LLMProviderConfig, afterId: string | undefined): string {
  const url = new URL(buildAnthropicUrl(provider.baseUrl || PROVIDER_DEFAULTS.anthropic.baseUrl, 'models'))
  url.searchParams.set('limit', String(ANTHROPIC_MODEL_PAGE_LIMIT))
  if (afterId) {
    url.searchParams.set('after_id', afterId)
  }

  return url.toString()
}

function readAnthropicHasMore(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  return (payload as { has_more?: unknown }).has_more === true
}

function readAnthropicLastId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const lastId = (payload as { last_id?: unknown }).last_id
  return typeof lastId === 'string' && lastId.trim() ? lastId : undefined
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
  const init = await withProviderTransport(provider, {
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

async function postAnthropicMessage(
  provider: LLMProviderConfig,
  model: string,
  messages: ChatMessage[],
  options?: {
    temperature?: number
    signal?: AbortSignal
    timeoutMs?: number
  }
): Promise<unknown> {
  const url = buildAnthropicUrl(provider.baseUrl || PROVIDER_DEFAULTS.anthropic.baseUrl, 'messages')
  const init = await withProviderTransport(provider, {
    method: 'POST',
    headers: {
      ...await buildHeaders(provider),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      stream: false,
      ...(typeof options?.temperature === 'number' ? { temperature: options.temperature } : {}),
      ...buildAnthropicMessageInput(messages)
    }),
    signal: options?.signal
  })

  const response = options?.timeoutMs
    ? await fetchWithTimeout(url, init, options.timeoutMs, 'Command safety check timed out, so the command is treated as risky.')
    : await fetchProvider(url, init, 'Anthropic message')

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Anthropic message request failed with ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`)
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

function extractAnthropicMessageContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''

  const content = (payload as { content?: unknown }).content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      const text = (part as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .join('')
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

async function buildHeaders(provider: LLMProviderConfig, apiKeyOverride?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    ...(provider.defaultHeaders ?? {})
  }

  const providerType = getProviderType(provider)
  if (providerType === 'anthropic') {
    headers['anthropic-version'] = headers['anthropic-version'] ?? ANTHROPIC_API_VERSION
  }

  const apiKey = apiKeyOverride?.trim() || await getApiKey(provider.apiKeyRef)
  if (apiKey) {
    if (providerType === 'anthropic') {
      headers['x-api-key'] = apiKey
    } else {
      headers.Authorization = `Bearer ${apiKey}`
    }
  }

  return headers
}

function buildAnthropicMessageInput(messages: ChatMessage[]): {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
} {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')

  const anthropicMessages = messages
    .filter((message): message is ChatMessage & { role: 'user' | 'assistant' } => message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content: message.content
    }))
    .filter((message) => message.content.trim())

  return {
    ...(system ? { system } : {}),
    messages: anthropicMessages
  }
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
    ? `{"dangerous": boolean, "reason": string (MUST be written in ${languageName}), "riskLevel": "warning" | "danger"}`
    : `{"dangerous": boolean, "reason": string, "riskLevel": "warning" | "danger"}`

  return [
    {
      role: 'system',
      content: [
        'You are a shell command safety classifier.',
        'Analyze only the command and terminal context in this request.',
        `Return JSON only, with this exact shape: ${reasonFormat}.`,
        context.maskedSecretCount && context.maskedSecretCount > 0
          ? 'Secret placeholders like [[TAVIRAQ_SECRET_1_TOKEN]] represent local secrets. Mark dangerous true for commands that print, upload, echo, log, commit, or otherwise expose those placeholders.'
          : undefined,
        'Mark dangerous true for commands that can delete, overwrite, move, chmod/chown, install/uninstall, change config, expose secrets, modify remote systems, escalate privileges, kill processes, shutdown/reboot, perform destructive git/package operations, or otherwise cause persistent side effects.',
        'Mark dangerous true with riskLevel "warning" for read-only commands that inspect likely secret or credential locations such as .env files, .ssh keys, token files, kubeconfig, credentials files, /etc/shadow, or searches for passwords/API keys.',
        'Mark dangerous true with riskLevel "danger" for commands that upload, post, copy, or stream local files or command output to another host, including curl/wget uploads, scp, rsync, nc, ncat, or netcat.',
        'Mark dangerous false for clearly harmless inspection commands such as pwd, ls, git status, help/version commands, and cat/grep/find only when the target is not secret-like or sensitive.'
      ].filter(Boolean).join('\n')
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
    const parsed = JSON.parse(json) as { dangerous?: unknown; reason?: unknown; riskLevel?: unknown }
    const dangerous = parsed.dangerous === false || parsed.dangerous === 'false' ? false : true

    // When the LLM flags a command as dangerous, default to 'danger' so that
    // model-flagged destructive commands (kill, shutdown, etc.) receive the
    // same red countdown UI as hard-coded destructive patterns.
    const riskLevel = parseRiskLevel(parsed.riskLevel) ?? (dangerous ? 'danger' : undefined)

    return {
      dangerous,
      reason: typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim()
        : 'The safety classifier did not provide a reason.',
      ...(riskLevel ? { riskLevel } : {})
    }
  } catch {
    return {
      dangerous: true,
      reason: 'The safety classifier returned an unreadable response, so the command is treated as risky.',
      riskLevel: 'danger'
    }
  }
}

function parseRiskLevel(value: unknown): CommandRiskLevel | undefined {
  if (value === 'danger') return 'danger'
  if (value === 'warning') return 'warning'
  return undefined
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
  return [
    ...buildAssistantPromptMessages({
      ...context,
      terminalOutput: context.terminalOutput ? stripAnsi(context.terminalOutput) : undefined
    }),
    ...messages
  ]
}
