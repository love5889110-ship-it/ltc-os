import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  opportunityWorkspaces,
  opportunities,
  customers,
  agentThreads,
  agentRuns,
  agentDecisions,
  agentActions,
  stateSnapshots,
  signalBindings,
  signalEvents,
} from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
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

  const threads = await db.query.agentThreads.findMany({
    where: eq(agentThreads.workspaceId, id),
  })

  // Get latest run for each thread
  const threadDetails = await Promise.all(
    threads.map(async (thread) => {
      const latestRun = thread.latestRunId
        ? await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, thread.latestRunId) })
        : null
      const latestDecisions = latestRun
        ? await db.query.agentDecisions.findMany({ where: eq(agentDecisions.runId, latestRun.id) })
        : []
      return { thread, latestRun, decisions: latestDecisions }
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

  return NextResponse.json({
    workspace,
    opportunity: opp,
    customer,
    threads: threadDetails,
    pendingActions,
    lastSnapshot,
    recentSignals,
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
