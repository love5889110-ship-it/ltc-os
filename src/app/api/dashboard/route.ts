import { NextResponse } from 'next/server'
import { db } from '@/db'
import {
  opportunityWorkspaces,
  signalEvents,
  agentActions,
  agentThreads,
  feedbackSamples,
  opportunities,
  agentRules,
} from '@/db/schema'
import { sql, eq } from 'drizzle-orm'
import { AGENT_LABELS } from '@/lib/utils'

export async function GET() {
  const [workspaceCount] = await db.select({ count: sql<number>`count(*)` }).from(opportunityWorkspaces)
  const [signalCount] = await db.select({ count: sql<number>`count(*)` }).from(signalEvents)
  const [feedbackCount] = await db.select({ count: sql<number>`count(*)` }).from(feedbackSamples)
  const [rulesCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentRules)
    .where(eq(agentRules.enabled, true))

  const [pendingActionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentActions)
    .where(sql`action_status IN ('pending', 'pending_approval')`)

  // P4: 运行中 Agent 数量
  const [runningAgentCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentThreads)
    .where(eq(agentThreads.threadStatus, 'running'))

  // P4: 执行失败动作数
  const [failedActionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(agentActions)
    .where(eq(agentActions.actionStatus, 'failed'))

  const [healthRow] = await db
    .select({ avg: sql<number>`coalesce(avg(health_score), 0)` })
    .from(opportunityWorkspaces)

  // Signal type distribution
  const signalTypes = await db
    .select({ type: signalEvents.signalType, count: sql<number>`count(*)` })
    .from(signalEvents)
    .groupBy(signalEvents.signalType)

  // Action status distribution
  const actionStatuses = await db
    .select({ status: agentActions.actionStatus, count: sql<number>`count(*)` })
    .from(agentActions)
    .groupBy(agentActions.actionStatus)

  // Feedback label distribution
  const feedbackLabels = await db
    .select({ label: feedbackSamples.feedbackLabel, count: sql<number>`count(*)` })
    .from(feedbackSamples)
    .groupBy(feedbackSamples.feedbackLabel)

  // High risk workspaces
  const riskWorkspaces = await db
    .select({
      id: opportunityWorkspaces.id,
      healthScore: opportunityWorkspaces.healthScore,
      riskScore: opportunityWorkspaces.riskScore,
      oppName: opportunities.name,
    })
    .from(opportunityWorkspaces)
    .leftJoin(opportunities, eq(opportunities.id, opportunityWorkspaces.opportunityId))
    .where(sql`risk_score > 30`)
    .orderBy(sql`risk_score desc`)
    .limit(5)

  // Win/Loss stats
  const wonCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(opportunities)
    .where(eq(opportunities.status, 'won'))
  const lostCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(opportunities)
    .where(eq(opportunities.status, 'lost'))

  // Loss reason distribution (stored as "lost:{reason}" in currentStage)
  const lostWorkspaces = await db
    .select({ currentStage: opportunityWorkspaces.currentStage })
    .from(opportunityWorkspaces)
    .where(sql`workspace_status = 'closed' AND current_stage LIKE 'lost:%'`)

  const lostReasonLabels: Record<string, string> = {
    price: '价格竞争',
    control: '控标力不足',
    solution: '方案竞争力',
    document: '投标文件失误',
    risk: '风险预判不足',
    relationship: '客户关系不足',
  }
  const lostReasonDist: Record<string, number> = {}
  for (const w of lostWorkspaces) {
    const reason = w.currentStage?.replace('lost:', '') ?? 'unknown'
    lostReasonDist[reason] = (lostReasonDist[reason] ?? 0) + 1
  }

  // Acceptance rate
  const feedbackMap = Object.fromEntries(feedbackLabels.map((r) => [r.label, Number(r.count)]))
  const totalFeedback = Object.values(feedbackMap).reduce((a, b) => a + b, 0)
  const acceptRate = totalFeedback > 0
    ? Math.round(((feedbackMap['accepted'] ?? 0) / totalFeedback) * 100)
    : 0

  // Agent effectiveness summary (all 7 agent types)
  const agentTypes = Object.keys(AGENT_LABELS)
  const agentEffectiveness = await Promise.all(
    agentTypes.map(async (agentType) => {
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          accepted: sql<number>`count(*) filter (where feedback_label = 'accepted')::int`,
        })
        .from(feedbackSamples)
        .where(sql`agent_type = ${agentType}`)
      const total = row?.total ?? 0
      const accepted = row?.accepted ?? 0
      return {
        agentType,
        agentLabel: (AGENT_LABELS as Record<string, string>)[agentType],
        totalRuns: total,
        acceptRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
        correctedCount: total - accepted,
      }
    })
  )

  return NextResponse.json({
    workspaceCount: Number(workspaceCount.count),
    signalCount: Number(signalCount.count),
    pendingActionCount: Number(pendingActionCount.count),
    feedbackCount: Number(feedbackCount.count),
    avgHealthScore: Number(healthRow.avg),
    runningAgentCount: Number(runningAgentCount.count),
    failedActionCount: Number(failedActionCount.count),
    activeRulesCount: Number(rulesCount.count),
    acceptRate,
    wonCount: Number(wonCount[0].count),
    lostCount: Number(lostCount[0].count),
    lostReasonDist,
    lostReasonLabels,
    signalsByType: Object.fromEntries(signalTypes.map((r) => [r.type ?? 'unknown', Number(r.count)])),
    actionsByStatus: Object.fromEntries(actionStatuses.map((r) => [r.status, Number(r.count)])),
    feedbackByLabel: feedbackMap,
    highRiskWorkspaces: riskWorkspaces.map((w) => ({
      id: w.id,
      name: w.oppName ?? '未知',
      healthScore: w.healthScore ?? 0,
      riskScore: w.riskScore ?? 0,
    })),
    agentEffectiveness,
  })
}
