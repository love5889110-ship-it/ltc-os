import { minimaxChat } from '@/lib/minimax'
import { db } from '@/db'
import { signalEvents, signalBindings, customers, contacts, opportunities, opportunityWorkspaces } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import type { SignalType, BindingCandidate } from '@/types'
import { getAISettings } from '@/lib/ai-settings'
import { triggerSignalAgent } from '@/lib/stage-engine'


interface NormalizeResult {
  signalType: SignalType
  summary: string
  keyPoints: string[]
  riskFlags: string[]
  priority: number
  confidence: number
  entities: {
    customerNames?: string[]
    personNames?: string[]
    projectNames?: string[]
    keywords?: string[]
  }
}

export async function normalizeSignal(rawContent: string): Promise<NormalizeResult> {
  const settings = await getAISettings()

  let summaryInstruction: string
  let extraFields: string

  if (settings.signalSummaryStyle === 'structured') {
    summaryInstruction = '"summary": "核心摘要（≤40字）"'
    extraFields = `  "keyPoints": ["关键信息点1（竞品/报价/时间节点）", "关键信息点2", "关键信息点3"],
  "riskFlags": ["风险点（如有）"],
  "competitorMentions": ["提到的竞品名"],
  "amounts": ["提到的金额或预算"],
  "deadlines": ["时间节点或截止日期"],`
  } else if (settings.signalSummaryStyle === 'detailed') {
    summaryInstruction = '"summary": "核心摘要（≤40字）"'
    extraFields = `  "keyPoints": ["关键要点1", "关键要点2", "关键要点3（最多5条）"],
  "riskFlags": ["风险信号（如有）"],`
  } else {
    // brief (default)
    summaryInstruction = `"summary": "一句话摘要（不超过${settings.signalMaxLength}字）"`
    extraFields = `  "keyPoints": [],
  "riskFlags": [],`
  }

  const text = await minimaxChat({
    system: `你是信号标准化助手。分析输入内容并输出 JSON：
{
  "signalType": "demand|risk|opportunity|blocker|escalation|info",
  ${summaryInstruction},
${extraFields}
  "priority": 1-5,
  "confidence": 0.0-1.0,
  "entities": {
    "customerNames": ["提到的客户/公司名"],
    "personNames": ["提到的人名"],
    "projectNames": ["项目名"],
    "keywords": ["关键词"]
  }
}
只输出 JSON，不要任何解释。`,
    user: rawContent,
    maxTokens: settings.signalSummaryStyle === 'brief' ? 512 : 1024,
  })
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, text]
    const parsed = JSON.parse(jsonMatch[1] || text)
    return {
      signalType: parsed.signalType ?? 'info',
      summary: parsed.summary ?? rawContent.slice(0, settings.signalMaxLength),
      keyPoints: parsed.keyPoints ?? [],
      riskFlags: parsed.riskFlags ?? [],
      priority: parsed.priority ?? 3,
      confidence: parsed.confidence ?? 0.5,
      entities: {
        ...parsed.entities,
        ...(parsed.competitorMentions?.length ? { competitorMentions: parsed.competitorMentions } : {}),
        ...(parsed.amounts?.length ? { amounts: parsed.amounts } : {}),
        ...(parsed.deadlines?.length ? { deadlines: parsed.deadlines } : {}),
      },
    }
  } catch {
    return {
      signalType: 'info',
      summary: rawContent.slice(0, settings.signalMaxLength),
      keyPoints: [],
      riskFlags: [],
      priority: 3,
      confidence: 0.5,
      entities: {},
    }
  }
}

export async function findBindingCandidates(
  signalId: string,
  entities: NormalizeResult['entities']
): Promise<BindingCandidate[]> {
  const candidates: BindingCandidate[] = []

  if (entities.customerNames?.length) {
    const allCustomers = await db.select().from(customers)
    for (const name of entities.customerNames) {
      for (const c of allCustomers) {
        const similarity = nameSimilarity(name, c.name)
        if (similarity > 0.4) {
          candidates.push({ type: 'customer', id: c.id, name: c.name, confidence: similarity })
        }
      }
    }
  }

  if (entities.personNames?.length) {
    const allContacts = await db.select().from(contacts)
    for (const name of entities.personNames) {
      for (const c of allContacts) {
        const similarity = nameSimilarity(name, c.name)
        if (similarity > 0.5) {
          candidates.push({ type: 'contact', id: c.id, name: c.name, confidence: similarity })
        }
      }
    }
  }

  // Match opportunities by keywords
  if (entities.keywords?.length || entities.projectNames?.length) {
    const allOpps = await db.select().from(opportunities)
    const searchTerms = [...(entities.keywords ?? []), ...(entities.projectNames ?? [])]
    for (const opp of allOpps) {
      const score = searchTerms.reduce((acc, term) => {
        return acc + (opp.name.includes(term) ? 0.3 : 0)
      }, 0)
      if (score > 0) {
        candidates.push({
          type: 'opportunity',
          id: opp.id,
          name: opp.name,
          confidence: Math.min(score, 0.9),
        })
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
}

function nameSimilarity(a: string, b: string): number {
  a = a.toLowerCase()
  b = b.toLowerCase()
  if (a === b) return 1.0
  if (b.includes(a) || a.includes(b)) return 0.8
  // Simple character overlap
  const setA = new Set(a.split(''))
  const setB = new Set(b.split(''))
  const intersection = new Set([...setA].filter((x) => setB.has(x)))
  return intersection.size / Math.max(setA.size, setB.size)
}

export async function ingestSignal(params: {
  sourceType: string
  sourceInstanceId?: string
  externalEventId?: string
  rawContent: string
  eventTime?: Date
}): Promise<{ signalId: string; candidates: BindingCandidate[]; normalized: NormalizeResult }> {
  const normalized = await normalizeSignal(params.rawContent)
  const signalId = generateId()

  await db.insert(signalEvents).values({
    id: signalId,
    sourceType: params.sourceType as any,
    sourceInstanceId: params.sourceInstanceId ?? null,
    externalEventId: params.externalEventId ?? null,
    rawContent: params.rawContent,
    normalizedContent: params.rawContent,
    contentSummary: normalized.summary,
    eventTime: params.eventTime ?? new Date(),
    signalType: normalized.signalType,
    priority: normalized.priority,
    confidenceScore: normalized.confidence,
    parsedEntitiesJson: {
      ...normalized.entities,
      keyPoints: normalized.keyPoints,
      riskFlags: normalized.riskFlags,
    },
    status: 'unbound',
  })

  const candidates = await findBindingCandidates(signalId, normalized.entities)

  // Auto-bind if high confidence single candidate
  const topCandidate = candidates[0]
  if (topCandidate && topCandidate.confidence >= 0.85) {
    await db.insert(signalBindings).values({
      id: generateId(),
      signalEventId: signalId,
      opportunityId: topCandidate.type === 'opportunity' ? topCandidate.id : null,
      customerId: topCandidate.type === 'customer' ? topCandidate.id : null,
      contactId: topCandidate.type === 'contact' ? topCandidate.id : null,
      bindingStatus: 'auto_bound',
      bindingConfidence: topCandidate.confidence,
      bindingCandidatesJson: candidates,
    })
    await db.update(signalEvents).set({ status: 'bound' }).where(eq(signalEvents.id, signalId))

    // S1 fix: 高优先级信号自动绑定后，立即触发 sales_copilot 分析
    if (normalized.priority >= 4 && topCandidate.type === 'opportunity') {
      const workspace = await db.query.opportunityWorkspaces.findFirst({
        where: eq(opportunityWorkspaces.opportunityId, topCandidate.id),
      })
      if (workspace) {
        const opp = await db.query.opportunities.findFirst({ where: eq(opportunities.id, topCandidate.id) })
        triggerSignalAgent(workspace.id, signalId, {
          currentStage: workspace.currentStage ?? undefined,
          healthScore: workspace.healthScore,
          riskScore: workspace.riskScore,
          opportunity: opp ? { id: opp.id, name: opp.name, stage: opp.stage, amount: opp.amount } : undefined,
        })
      }
    }
  } else if (candidates.length > 0) {
    await db.insert(signalBindings).values({
      id: generateId(),
      signalEventId: signalId,
      bindingStatus: 'candidate',
      bindingConfidence: topCandidate?.confidence ?? 0,
      bindingCandidatesJson: candidates,
    })
    await db.update(signalEvents).set({ status: 'pending_confirm' }).where(eq(signalEvents.id, signalId))
  }

  return { signalId, candidates, normalized }
}
