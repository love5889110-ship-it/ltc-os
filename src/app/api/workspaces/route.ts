import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { opportunityWorkspaces, opportunities, agentThreads } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '20')

  const wsRows = await db.query.opportunityWorkspaces.findMany({
    orderBy: (w, { desc }) => [desc(w.updatedAt)],
    limit,
  })

  // [P1-1] Batch-load opportunities and customers in 2 queries instead of N*2
  const oppIds = wsRows.map((w) => w.opportunityId).filter(Boolean) as string[]
  const allOpps = oppIds.length > 0
    ? await db.query.opportunities.findMany({ where: (o, { inArray }) => inArray(o.id, oppIds) })
    : []
  const customerIds = allOpps.map((o) => o.customerId).filter(Boolean) as string[]
  const allCustomers = customerIds.length > 0
    ? await db.query.customers.findMany({ where: (c, { inArray }) => inArray(c.id, customerIds) })
    : []

  const wsIds = wsRows.map((w) => w.id)
  const allActions = wsIds.length > 0
    ? await db.query.agentActions.findMany({
        where: (a, { and, inArray }) => and(
          inArray(a.workspaceId, wsIds),
          inArray(a.actionStatus, ['pending', 'pending_approval'])
        ),
      })
    : []

  // Load all threads for all workspaces (not just running)
  const allThreads = wsIds.length > 0
    ? await db.query.agentThreads.findMany({
        where: (t, { inArray }) => inArray(t.workspaceId, wsIds),
      })
    : []

  // Load the most recent agentRun per workspace (for AI summary)
  const recentRunsMap: Record<string, { outputSummary: string | null; agentType: string; startedAt: string | null }> = {}
  if (wsIds.length > 0) {
    const threadIds = allThreads.map(t => t.id)
    if (threadIds.length > 0) {
      const recentRuns = await db.query.agentRuns.findMany({
        where: (r, { and, inArray, eq }) => and(
          inArray(r.threadId, threadIds),
          eq(r.runStatus, 'completed'),
        ),
        orderBy: (r, { desc }) => [desc(r.startedAt)],
        limit: wsIds.length * 7, // at most 7 agents per workspace
      })
      for (const run of recentRuns) {
        const thread = allThreads.find(t => t.id === run.threadId)
        if (!thread) continue
        const wid = thread.workspaceId
        if (!recentRunsMap[wid]) {
          recentRunsMap[wid] = {
            outputSummary: run.outputSummary,
            agentType: thread.agentType,
            startedAt: run.startedAt ? String(run.startedAt) : null,
          }
        }
      }
    }
  }

  const result = wsRows.map((w) => {
    const opp = allOpps.find((o) => o.id === w.opportunityId) ?? null
    const customer = opp ? allCustomers.find((c) => c.id === opp.customerId) ?? null : null
    const wsThreads = allThreads.filter(t => t.workspaceId === w.id)
    return {
      workspace: w,
      opportunity: opp,
      customer,
      pendingActionCount: allActions.filter((a) => a.workspaceId === w.id).length,
      runningAgentCount: wsThreads.filter(t => t.threadStatus === 'running').length,
      agentStatuses: wsThreads.map(t => ({
        agentType: t.agentType,
        status: t.threadStatus,
        lastActiveAt: t.lastActiveAt ? String(t.lastActiveAt) : null,
      })),
      aiSummary: recentRunsMap[w.id] ?? null,
    }
  })

  return NextResponse.json({ workspaces: result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[workspaces GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { opportunityId, ownerUserId } = body

  if (!opportunityId) {
    return NextResponse.json({ error: '缺少 opportunityId' }, { status: 400 })
  }

  const opp = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, opportunityId),
  })
  if (!opp) {
    return NextResponse.json({ error: '商机不存在' }, { status: 404 })
  }

  const workspaceId = generateId()
  await db.insert(opportunityWorkspaces).values({
    id: workspaceId,
    opportunityId,
    workspaceStatus: 'active',
    currentStage: opp.stage,
    healthScore: 100,
    riskScore: 0,
    blockScore: 0,
    ownerUserId: ownerUserId ?? null,
  })

  // Auto-create coordinator thread
  await db.insert(agentThreads).values({
    id: generateId(),
    workspaceId,
    agentType: 'coordinator',
    threadStatus: 'idle',
  })

  return NextResponse.json({ workspaceId }, { status: 201 })
}
