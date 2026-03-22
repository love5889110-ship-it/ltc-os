import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  opportunities, customers, signalEvents,
  signalBindings, agentRuns, agentDecisions, stateSnapshots,
} from '@/db/schema'
import { runAgent, createOrGetThread } from '@/lib/agent-runtime'
import { eq, desc } from 'drizzle-orm'
import type { AgentType } from '@/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params
  const body = await req.json()
  const { agentType, triggerType = 'manual', triggerSignalId } = body as {
    agentType: AgentType
    triggerType?: string
    triggerSignalId?: string
  }

  const workspace = await db.query.opportunityWorkspaces.findFirst({
    where: (w, { eq }) => eq(w.id, workspaceId),
  })
  if (!workspace) return NextResponse.json({ error: '工作空间不存在' }, { status: 404 })

  const opp = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, workspace.opportunityId),
  })
  const customer = opp
    ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) })
    : null

  // ── P3: 增强上下文：最近10条归属信号 ──────────────────────────────────────
  const boundSignalIds = await db
    .select({ signalEventId: signalBindings.signalEventId })
    .from(signalBindings)
    .where(eq(signalBindings.opportunityId, workspace.opportunityId))
    .limit(10)

  const recentSignals = boundSignalIds.length > 0
    ? await db.query.signalEvents.findMany({
        where: (s, { inArray }) =>
          inArray(s.id, boundSignalIds.map((b) => b.signalEventId)),
        orderBy: (s, { desc }) => [desc(s.eventTime)],
        limit: 10,
      })
    : triggerSignalId
      ? [await db.query.signalEvents.findFirst({ where: eq(signalEvents.id, triggerSignalId) })]
      : []

  // ── P3: 增强上下文：该 Agent 最近3次决策摘要 ─────────────────────────────
  const thread = await db.query.agentThreads.findFirst({
    where: (t, { and, eq }) => and(eq(t.workspaceId, workspaceId), eq(t.agentType, agentType)),
  })
  const recentDecisions: unknown[] = []
  if (thread) {
    const recentRuns = await db.query.agentRuns.findMany({
      where: eq(agentRuns.threadId, thread.id),
      orderBy: [desc(agentRuns.startedAt)],
      limit: 3,
    })
    for (const run of recentRuns) {
      const decisions = await db.query.agentDecisions.findMany({
        where: eq(agentDecisions.runId, run.id),
      })
      if (run.outputSummary) {
        recentDecisions.push({
          runAt: run.startedAt,
          summary: run.outputSummary,
          decisions: decisions.map((d) => ({ label: d.decisionLabel, rationale: d.rationaleSummary })),
        })
      }
    }
  }

  // ── P3: 最新快照完整内容 ─────────────────────────────────────────────────
  const lastSnapshot = workspace.lastSnapshotId
    ? await db.query.stateSnapshots.findFirst({
        where: eq(stateSnapshots.id, workspace.lastSnapshotId),
      })
    : null

  const threadId = await createOrGetThread(workspaceId, agentType)

  const result = await runAgent({
    threadId,
    workspaceId,
    agentType,
    triggerType: triggerType as any,
    triggerSignalId,
    context: {
      opportunity: opp
        ? { id: opp.id, name: opp.name, stage: opp.stage, amount: opp.amount, status: opp.status }
        : undefined,
      customer: customer
        ? { id: customer.id, name: customer.name, industry: customer.industry, region: customer.region }
        : undefined,
      currentStage: workspace.currentStage ?? undefined,
      healthScore: workspace.healthScore,
      riskScore: workspace.riskScore,
      recentSignals: recentSignals.filter(Boolean).map((s: any) => ({
        type: s.signalType,
        summary: s.contentSummary,
        priority: s.priority,
        time: s.eventTime,
      })),
      recentDecisions,
      lastSnapshot: lastSnapshot
        ? {
            stage: lastSnapshot.stage,
            healthScore: lastSnapshot.healthScore,
            riskSummary: lastSnapshot.riskSummary,
            nextActions: lastSnapshot.nextActionsJson,
            blockers: lastSnapshot.blockersJson,
          }
        : undefined,
    },
  })

  return NextResponse.json(result, { status: 201 })
}
