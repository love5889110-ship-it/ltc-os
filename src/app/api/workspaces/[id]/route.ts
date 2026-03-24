import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  opportunityWorkspaces,
  opportunities,
  customers,
  channelPartners,
  agentThreads,
  agentRuns,
  agentDecisions,
  agentActions,
  executionLogs,
  stateSnapshots,
  signalBindings,
  signalEvents,
} from '@/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { triggerStageAgents } from '@/lib/stage-engine'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const workspace = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, id),
  })
  if (!workspace) return NextResponse.json({ error: '不存在' }, { status: 404 })

  const opp = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, workspace.opportunityId),
  })
  const customer = opp
    ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) })
    : null
  const channelPartner = opp?.channelPartnerId
    ? await db.query.channelPartners.findFirst({ where: eq(channelPartners.id, opp.channelPartnerId) })
    : null

  const threads = await db.query.agentThreads.findMany({
    where: eq(agentThreads.workspaceId, id),
  })

  // Get latest run for each thread, including execution details
  const threadDetails = await Promise.all(
    threads.map(async (thread) => {
      const latestRun = thread.latestRunId
        ? await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, thread.latestRunId) })
        : null
      const latestDecisions = latestRun
        ? await db.query.agentDecisions.findMany({ where: eq(agentDecisions.runId, latestRun.id) })
        : []

      // Execution steps: actions from this run → their execution logs
      let executionSteps: Array<{
        actionId: string
        executorType: string
        executionStatus: string
        responsePayloadJson: unknown
        executedAt: string | null
      }> = []
      if (latestRun) {
        const runActions = await db.query.agentActions.findMany({
          where: eq(agentActions.runId, latestRun.id),
        })
        if (runActions.length > 0) {
          const logs = await db.query.executionLogs.findMany({
            where: (l, { inArray }) => inArray(l.actionId, runActions.map(a => a.id)),
            orderBy: (l, { asc }) => [asc(l.executedAt)],
          })
          executionSteps = logs.map(l => ({
            actionId: l.actionId ?? '',
            executorType: l.executorType ?? '',
            executionStatus: l.executionStatus ?? '',
            responsePayloadJson: l.responsePayloadJson,
            executedAt: l.executedAt?.toISOString() ?? null,
          }))
        }
      }

      // Input context summary: extract from inputContextJson
      const ctx = latestRun?.inputContextJson as Record<string, unknown> | null
      const inputContextSummary = ctx ? {
        signalCount: Array.isArray(ctx.recentSignals) ? ctx.recentSignals.length : 0,
        assetCount: Array.isArray(ctx.relevantAssets) ? ctx.relevantAssets.length : 0,
        hasMemory: !!(ctx.agentMemory),
        crossAgentSummary: ctx.crossAgentOutputs && typeof ctx.crossAgentOutputs === 'object'
          ? Object.keys(ctx.crossAgentOutputs).join('、') + ' Agent 的输出'
          : null,
      } : null

      return {
        thread,
        latestRun: latestRun ? {
          id: latestRun.id,
          reasoningSummary: latestRun.reasoningSummary,
          outputSummary: latestRun.outputSummary,
          runStatus: latestRun.runStatus,
          startedAt: latestRun.startedAt?.toISOString() ?? null,
          inputContextSummary,
          executionSteps,
        } : null,
        decisions: latestDecisions,
      }
    })
  )

  const pendingActions = await db.query.agentActions.findMany({
    where: (a, { and, eq, inArray }) =>
      and(
        eq(a.workspaceId, id),
        inArray(a.actionStatus, ['pending', 'pending_approval'])
      ),
    orderBy: (a, { desc }) => [desc(a.actionPriority)],
    limit: 10,
  })

  // [P1-3] Batch-resolve agentType for pending actions — 1 query each for runs+threads instead of N*2
  const runIds = pendingActions.map((a) => a.runId).filter(Boolean) as string[]
  const pendingRuns = runIds.length > 0
    ? await db.query.agentRuns.findMany({ where: (r, { inArray }) => inArray(r.id, runIds) })
    : []
  const threadIds = pendingRuns.map((r) => r.threadId).filter(Boolean) as string[]
  const pendingThreads = threadIds.length > 0
    ? await db.query.agentThreads.findMany({ where: (t, { inArray }) => inArray(t.id, threadIds) })
    : []

  const pendingActionsWithAgent = pendingActions.map((action) => {
    const run = pendingRuns.find((r) => r.id === action.runId)
    const thread = run ? pendingThreads.find((t) => t.id === run.threadId) : null
    return { ...action, agentType: thread?.agentType ?? null }
  })

  const lastSnapshot = workspace.lastSnapshotId
    ? await db.query.stateSnapshots.findFirst({
        where: eq(stateSnapshots.id, workspace.lastSnapshotId),
      })
    : null

  // Bound signals for this opportunity
  const boundBindings = await db
    .select({ signalEventId: signalBindings.signalEventId })
    .from(signalBindings)
    .where(eq(signalBindings.opportunityId, workspace.opportunityId))
    .limit(8)

  const recentSignals = boundBindings.length > 0
    ? await db.query.signalEvents.findMany({
        where: (s, { inArray }) => inArray(s.id, boundBindings.map((b) => b.signalEventId)),
        orderBy: [desc(signalEvents.eventTime)],
        limit: 8,
      })
    : []

  const completedActionsRaw = await db.query.agentActions.findMany({
    where: (a, { and, eq, inArray }) =>
      and(
        eq(a.workspaceId, id),
        inArray(a.actionStatus, ['completed', 'rejected', 'approved'])
      ),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
    limit: 10,
  })

  // [P1-3] Same batch approach for completed actions
  const compRunIds = completedActionsRaw.map((a) => a.runId).filter(Boolean) as string[]
  const compRuns = compRunIds.length > 0
    ? await db.query.agentRuns.findMany({ where: (r, { inArray }) => inArray(r.id, compRunIds) })
    : []
  const compThreadIds = compRuns.map((r) => r.threadId).filter(Boolean) as string[]
  const compThreads = compThreadIds.length > 0
    ? await db.query.agentThreads.findMany({ where: (t, { inArray }) => inArray(t.id, compThreadIds) })
    : []

  const completedActions = completedActionsRaw.map((action) => {
    const run = compRuns.find((r) => r.id === action.runId)
    const thread = run ? compThreads.find((t) => t.id === run.threadId) : null
    return { ...action, agentType: thread?.agentType ?? null }
  })

  return NextResponse.json({
    workspace,
    opportunity: opp,
    customer,
    channelPartner,
    threads: threadDetails,
    pendingActions: pendingActionsWithAgent,
    lastSnapshot,
    recentSignals,
    completedActions,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { currentStage, healthScore, riskScore, workspaceStatus, closeOutcome, lostReason, lostNote } = body

  const workspace = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, id),
  })
  if (!workspace) return NextResponse.json({ error: '不存在' }, { status: 404 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (currentStage !== undefined) updates.currentStage = currentStage
  if (healthScore !== undefined) updates.healthScore = healthScore
  if (riskScore !== undefined) updates.riskScore = riskScore
  if (workspaceStatus !== undefined) updates.workspaceStatus = workspaceStatus

  // When closing, update opportunity status to won/lost and store loss reason
  if (workspaceStatus === 'closed' && closeOutcome) {
    await db.update(opportunities)
      .set({
        status: closeOutcome,  // 'won' or 'lost'
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, workspace.opportunityId))

    // Store loss reason in currentStage field as "lost:{reason}" for dashboard analytics
    if (closeOutcome === 'lost' && lostReason) {
      updates.currentStage = `lost:${lostReason}`
    } else if (closeOutcome === 'won') {
      updates.currentStage = 'won'
    }
  }

  await db.update(opportunityWorkspaces).set(updates as any).where(eq(opportunityWorkspaces.id, id))

  // C2: 阶段变更时自动触发对应 Agent
  if (currentStage && currentStage !== workspace.currentStage) {
    const opp = await db.query.opportunities.findFirst({
      where: eq(opportunities.id, workspace.opportunityId),
    })
    const customer = opp
      ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) })
      : null

    triggerStageAgents(id, currentStage, {
      opportunity: opp ? { id: opp.id, name: opp.name, stage: opp.stage, amount: opp.amount } : undefined,
      customer: customer ? { id: customer.id, name: customer.name, industry: customer.industry } : undefined,
      currentStage,
      healthScore: healthScore ?? workspace.healthScore,
      riskScore: riskScore ?? workspace.riskScore,
    })
  }

  return NextResponse.json({ success: true })
}
