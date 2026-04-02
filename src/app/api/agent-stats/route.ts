import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { feedbackSamples, executionLogs, agentActions } from '@/db/schema'
import { sql, and, eq, gte } from 'drizzle-orm'
import { AGENT_LABELS } from '@/lib/utils'
import type { AgentType } from '@/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentTypeFilter = searchParams.get('agentType') as AgentType | null

  const agentTypes = agentTypeFilter
    ? [agentTypeFilter]
    : (Object.keys(AGENT_LABELS) as AgentType[])

  const since28days = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)

  const stats = await Promise.all(
    agentTypes.map(async (agentType) => {
      // Overall counts
      const totals = await db
        .select({
          total: sql<number>`count(*)::int`,
          accepted: sql<number>`count(*) filter (where feedback_label = 'accepted')::int`,
          corrected: sql<number>`count(*) filter (where feedback_label in ('rejected', 'modified'))::int`,
        })
        .from(feedbackSamples)
        .where(eq(feedbackSamples.agentType, agentType as any))

      const { total, accepted, corrected } = totals[0] ?? { total: 0, accepted: 0, corrected: 0 }
      const acceptRate = total > 0 ? Math.round((accepted / total) * 100) : 0

      // Scenario breakdown (top 5 corrected scenarios)
      const scenarioRows = await db
        .select({
          scenarioType: feedbackSamples.scenarioType,
          count: sql<number>`count(*)::int`,
        })
        .from(feedbackSamples)
        .where(
          and(
            eq(feedbackSamples.agentType, agentType as any),
            sql`feedback_label in ('rejected', 'modified')`,
            sql`scenario_type is not null`,
          )
        )
        .groupBy(feedbackSamples.scenarioType)
        .orderBy(sql`count(*) desc`)
        .limit(5)

      // Weekly trend (last 4 weeks)
      const weeklyRows = await db
        .select({
          week: sql<string>`date_trunc('week', created_at)::text`,
          accepted: sql<number>`count(*) filter (where feedback_label = 'accepted')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(feedbackSamples)
        .where(
          and(
            eq(feedbackSamples.agentType, agentType as any),
            gte(feedbackSamples.createdAt, since28days),
          )
        )
        .groupBy(sql`date_trunc('week', created_at)`)
        .orderBy(sql`date_trunc('week', created_at)`)

      // Recent few-shot samples (reusable corrections)
      const fewShotRows = await db.query.feedbackSamples.findMany({
        where: (s, { and, eq }) => and(
          eq(s.agentType, agentType as any),
          eq(s.reusableFlag, true),
        ),
        orderBy: (s, { desc }) => [desc(s.createdAt)],
        limit: 3,
      })

      // Execution success rate from executionLogs (via agentActions → agentRuns → agentThreads)
      const execRows = await db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${executionLogs.executionStatus} = 'completed')::int`,
          failed: sql<number>`count(*) filter (where ${executionLogs.executionStatus} = 'failed')::int`,
        })
        .from(executionLogs)
        .innerJoin(agentActions, eq(executionLogs.actionId, agentActions.id))
        .where(
          and(
            sql`exists (
              select 1 from agent_runs ar
              inner join agent_threads at2 on at2.id = ar.thread_id
              where ar.id = ${agentActions.runId}
              and at2.agent_type = ${agentType}
            )`,
            gte(executionLogs.executedAt, since28days),
          )
        )

      const execTotal = execRows[0]?.total ?? 0
      const execCompleted = execRows[0]?.completed ?? 0
      const execFailed = execRows[0]?.failed ?? 0
      const executionSuccessRate = execTotal > 0 ? Math.round((execCompleted / execTotal) * 100) : null

      return {
        agentType,
        agentLabel: (AGENT_LABELS as Record<string, string>)[agentType] ?? agentType,
        totalRuns: total,
        acceptedCount: accepted,
        correctedCount: corrected,
        acceptRate,
        scenarioBreakdown: scenarioRows.map((r) => ({
          scenarioType: r.scenarioType ?? '未知',
          count: r.count,
        })),
        weeklyTrend: weeklyRows.map((r) => ({
          week: r.week?.slice(0, 10) ?? '',
          acceptRate: r.total > 0 ? Math.round((r.accepted / r.total) * 100) : 0,
          accepted: r.accepted,
          total: r.total,
        })),
        recentFewShots: fewShotRows.map((s) => ({
          scenarioType: s.scenarioType ?? '',
          createdAt: s.createdAt?.toISOString() ?? null,
          original: JSON.stringify(s.originalOutputJson ?? {}).slice(0, 200),
          corrected: JSON.stringify(s.correctedOutputJson ?? {}).slice(0, 200),
        })),
        executionSuccessRate,
        executionTotal: execTotal,
        executionCompleted: execCompleted,
        executionFailed: execFailed,
      }
    })
  )

  return NextResponse.json({ stats })
}
