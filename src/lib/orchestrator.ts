/**
 * Agent 编排器
 * 提供三类触发入口：
 *  1. event  — 事件触发（执行完成、信号绑定等，由业务代码调用）
 *  2. cron   — 定时触发（由 /api/cron 路由调用，接 Vercel Cron Job）
 *  3. rule   — 规则触发（满足条件时自动触发，由 cron 扫描执行）
 */
import { db } from '@/db'
import { opportunityWorkspaces, agentThreads, agentRuns, agentActions, feedbackSamples, agentRules, ruleSuggestions } from '@/db/schema'
import { eq, and, lt, isNull, inArray, notInArray } from 'drizzle-orm'
import { runAgent, createOrGetThread } from '@/lib/agent-runtime'
import { getAgentsForStage } from '@/lib/stage-engine'
import { minimaxChat } from '@/lib/minimax'
import { generateId } from '@/lib/utils'

// ─── 类型 ────────────────────────────────────────────────────────────────────

export type OrchestratorTrigger =
  | { type: 'cron_daily_review' }           // 每日巡检：对活跃商机运行 coordinator
  | { type: 'cron_stale_check'; staleDays: number } // 超 N 天无动作的商机告警
  | { type: 'cron_failed_retry' }           // 重试失败的动作（retryCount < 3）

// ─── Cron 触发入口（由 /api/cron 调用）────────────────────────────────────────

/**
 * 每日巡检：扫描所有 active 商机，对超过 staleDays 天没有 completed 动作的商机触发 coordinator
 */
export async function runDailyReview(staleDays = 2): Promise<{ triggered: number; skipped: number }> {
  const workspaces = await db.query.opportunityWorkspaces.findMany({
    where: eq(opportunityWorkspaces.workspaceStatus, 'active'),
  })

  let triggered = 0
  let skipped = 0
  const staleThreshold = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)

  for (const ws of workspaces) {
    try {
      // 检查最近是否有 completed 动作
      const recentAction = await db.query.agentActions.findFirst({
        where: and(
          eq(agentActions.workspaceId, ws.id),
          eq(agentActions.actionStatus, 'completed')
        ),
        orderBy: (a, { desc }) => [desc(a.updatedAt)],
      })

      const lastActivity = recentAction?.updatedAt ?? ws.createdAt ?? new Date(0)
      const isStale = new Date(lastActivity) < staleThreshold

      if (!isStale) {
        skipped++
        continue
      }

      // 触发 coordinator 巡检
      const threadId = await createOrGetThread(ws.id, 'coordinator')
      await runAgent({
        threadId,
        workspaceId: ws.id,
        agentType: 'coordinator',
        triggerType: 'scheduled',
        context: {
          additionalContext: `定时巡检：此商机已超过 ${staleDays} 天没有新的执行动作，请重新评估当前状态并给出下一步行动建议。`,
          currentStage: ws.currentStage ?? undefined,
          healthScore: ws.healthScore,
          riskScore: ws.riskScore,
        },
      })
      triggered++
    } catch (err) {
      console.error(`[orchestrator] daily review failed for workspace ${ws.id}:`, err)
      skipped++
    }
  }

  return { triggered, skipped }
}

/**
 * 失败动作重试：找出 retryCount < 3 且 failedAt 超过 5 分钟的动作，重新标记为 approved 并触发执行
 */
export async function retryFailedActions(): Promise<{ retried: number }> {
  const { executeAction } = await import('@/lib/executor')
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const failedActions = await db.query.agentActions.findMany({
    where: and(
      eq(agentActions.actionStatus, 'failed'),
      lt(agentActions.retryCount, 3)
    ),
  })

  // 过滤出 failedAt 超过 5 分钟的（避免刚失败就重试）
  const retryable = failedActions.filter(
    (a) => a.failedAt && new Date(a.failedAt) < fiveMinutesAgo
  )

  let retried = 0
  for (const action of retryable) {
    try {
      await db
        .update(agentActions)
        .set({ actionStatus: 'approved', updatedAt: new Date() })
        .where(eq(agentActions.id, action.id))
      void executeAction(action.id)
      retried++
    } catch (err) {
      console.error(`[orchestrator] retry failed for action ${action.id}:`, err)
    }
  }

  return { retried }
}

/**
 * 规则候选自动提炼：
 * 扫描近 N 天内被「修改」或「驳回」且尚未提炼的 feedbackSamples，
 * 用 MiniMax 生成规则候选写入 rule_suggestions 表，供人工一键确认。
 */
export async function generateRuleSuggestions(lookbackDays = 7): Promise<{ generated: number; skipped: number }> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)

  // 找出已提炼过的 feedbackSample id（避免重复提炼）
  const existing = await db.query.ruleSuggestions.findMany({
    where: (s, { isNotNull }) => isNotNull(s.sourceFeedbackId),
  })
  const alreadyProcessed = new Set(existing.map((s) => s.sourceFeedbackId).filter(Boolean))

  // 找出近 N 天 modified/rejected 且 reusable 的样本
  const samples = await db.query.feedbackSamples.findMany({
    where: (f, { and, inArray, gte }) =>
      and(
        inArray(f.feedbackLabel, ['modified', 'rejected']),
        gte(f.createdAt, since)
      ),
    orderBy: (f, { desc }) => [desc(f.createdAt)],
    limit: 20,
  })

  const toProcess = samples.filter((s) => !alreadyProcessed.has(s.id))
  let generated = 0
  let skipped = 0

  for (const sample of toProcess) {
    if (!sample.agentType) { skipped++; continue }

    try {
      const originalStr = JSON.stringify(sample.originalOutputJson ?? {}, null, 2).slice(0, 800)
      const correctedStr = JSON.stringify(sample.correctedOutputJson ?? {}, null, 2).slice(0, 800)
      const scenarioHint = sample.scenarioType ? `动作类型：${sample.scenarioType}` : ''
      const labelHint = sample.feedbackLabel === 'modified' ? '人工修改了AI的输出' : '人工驳回了AI的输出'

      const prompt = `你是一个 AI 销售系统的规则提炼专家。
以下是一条人工纠偏记录（${labelHint}）：
${scenarioHint}
原始 AI 输出：
${originalStr}

人工修改后（或驳回原因）：
${correctedStr}

请从中提炼一条可复用的行动规则，用 JSON 格式输出，字段：
- ruleType: "forbid" | "require" | "prefer"
- condition: 触发条件（简洁自然语言，20字以内）
- instruction: 规则指令（AI 下次遇到此情形应该怎么做，50字以内）
- rationale: 提炼理由（一句话，说明为何需要这条规则）

只输出 JSON，不要其他内容。`

      const raw = await minimaxChat({
        system: '你是规则提炼专家，只输出合法 JSON。',
        user: prompt,
        maxTokens: 256,
      })

      let parsed: { ruleType?: string; condition?: string; instruction?: string; rationale?: string }
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
      } catch {
        skipped++
        continue
      }

      if (!parsed.condition || !parsed.instruction) { skipped++; continue }

      const validRuleTypes = ['forbid', 'require', 'prefer']
      const ruleType = validRuleTypes.includes(parsed.ruleType ?? '') ? parsed.ruleType as 'forbid' | 'require' | 'prefer' : 'prefer'

      await db.insert(ruleSuggestions).values({
        id: generateId(),
        sourceFeedbackId: sample.id,
        agentType: sample.agentType,
        ruleType,
        condition: parsed.condition.slice(0, 200),
        instruction: parsed.instruction.slice(0, 500),
        rationale: parsed.rationale?.slice(0, 300) ?? null,
        status: 'pending',
      })
      generated++
    } catch (err) {
      console.error(`[orchestrator] rule suggestion failed for sample ${sample.id}:`, err)
      skipped++
    }
  }

  return { generated, skipped }
}
