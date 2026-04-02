/**
 * Agent 编排器
 * 提供三类触发入口：
 *  1. event  — 事件触发（执行完成、信号绑定等，由业务代码调用）
 *  2. cron   — 定时触发（由 /api/cron 路由调用，接 Vercel Cron Job）
 *  3. rule   — 规则触发（满足条件时自动触发，由 cron 扫描执行）
 */
import { db } from '@/db'
import { opportunityWorkspaces, agentThreads, agentRuns, agentActions } from '@/db/schema'
import { eq, and, lt, isNull, inArray } from 'drizzle-orm'
import { runAgent, createOrGetThread } from '@/lib/agent-runtime'
import { getAgentsForStage } from '@/lib/stage-engine'

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
