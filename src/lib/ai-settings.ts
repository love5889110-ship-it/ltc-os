import { db } from '@/db'
import { kvSettings } from '@/db/schema'

export interface AISettings {
  signalSummaryStyle: 'brief' | 'detailed' | 'structured'
  signalMaxLength: number
  agentOutputDepth: 'standard' | 'deep'
  agentMaxTokens: number
  feishuWebhookUrl?: string
  llmProvider?: 'minimax' | 'openai_compatible'
  llmApiKey?: string
  llmBaseUrl?: string
  llmModel?: string
  // Get笔记自动同步
  getNoteAutoSync?: boolean
  getNoteAutoSyncInterval?: number  // 分钟，15 / 30 / 60
}

const DEFAULTS: AISettings = {
  signalSummaryStyle: 'detailed',
  signalMaxLength: 60,
  agentOutputDepth: 'standard',
  agentMaxTokens: 2048,
}

function parseSettingsMap(map: Record<string, string>): Partial<AISettings> {
  const out: Partial<AISettings> = {}
  if (map.signalSummaryStyle) out.signalSummaryStyle = map.signalSummaryStyle as AISettings['signalSummaryStyle']
  if (map.signalMaxLength) out.signalMaxLength = Number(map.signalMaxLength)
  if (map.agentOutputDepth) out.agentOutputDepth = map.agentOutputDepth as AISettings['agentOutputDepth']
  if (map.agentMaxTokens) out.agentMaxTokens = Number(map.agentMaxTokens)
  if (map.feishuWebhookUrl) out.feishuWebhookUrl = map.feishuWebhookUrl
  if (map.llmProvider) out.llmProvider = map.llmProvider as AISettings['llmProvider']
  if (map.llmApiKey) out.llmApiKey = map.llmApiKey
  if (map.llmBaseUrl) out.llmBaseUrl = map.llmBaseUrl
  if (map.llmModel) out.llmModel = map.llmModel
  if (map.getNoteAutoSync) out.getNoteAutoSync = map.getNoteAutoSync === 'true'
  if (map.getNoteAutoSyncInterval) out.getNoteAutoSyncInterval = Number(map.getNoteAutoSyncInterval)
  return out
}

export async function getAISettings(): Promise<AISettings> {
  try {
    const rows = await db.select().from(kvSettings)
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return { ...DEFAULTS, ...parseSettingsMap(map) }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveAISettings(settings: Partial<AISettings>): Promise<AISettings> {
  const current = await getAISettings()
  const updated = { ...current, ...settings }
  for (const [key, val] of Object.entries(settings)) {
    if (val !== undefined && val !== null) {
      await db
        .insert(kvSettings)
        .values({ key, value: String(val) })
        .onConflictDoUpdate({ target: kvSettings.key, set: { value: String(val) } })
    }
  }
  return updated
}
