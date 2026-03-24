/**
 * MiniMax API client (OpenAI-compatible interface)
 * Docs: https://platform.minimaxi.com/document/ChatCompletion
 *
 * API key priority: kv_settings db llmApiKey > MINIMAX_API_KEY env var
 */

import { getAISettings } from '@/lib/ai-settings'

const DEFAULT_MINIMAX_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const DEFAULT_MINIMAX_MODEL = 'MiniMax-Text-01'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function getLLMConfig(): Promise<{ apiKey: string; baseUrl: string; model: string }> {
  const settings = await getAISettings()
  const apiKey = settings.llmApiKey || process.env.MINIMAX_API_KEY || ''
  const baseUrl = settings.llmBaseUrl || DEFAULT_MINIMAX_URL
  const model = settings.llmModel || DEFAULT_MINIMAX_MODEL
  return { apiKey, baseUrl, model }
}

export async function minimaxChat(params: {
  system: string
  user: string
  maxTokens?: number
}): Promise<string> {
  const { apiKey, baseUrl, model } = await getLLMConfig()

  const messages: Message[] = [
    { role: 'system', content: params.system },
    { role: 'user', content: params.user },
  ]

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: params.maxTokens ?? 2048,
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM API error ${res.status}: ${err}`)
  }

  const data = await res.json()

  // OpenAI-compatible response
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error(`LLM 返回格式异常: ${JSON.stringify(data)}`)
  return content
}

/**
 * 多轮对话版本，用于需要保持上下文的场景（如技能沙盘训练）
 */
export async function minimaxChatMultiTurn(params: {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
}): Promise<string> {
  const { apiKey, baseUrl, model } = await getLLMConfig()

  const messages: Message[] = [
    { role: 'system', content: params.system },
    ...params.messages,
  ]

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.5,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error(`LLM 返回格式异常: ${JSON.stringify(data)}`)
  return content
}
