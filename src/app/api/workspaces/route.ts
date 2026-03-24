import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { opportunityWorkspaces, opportunities, customers, agentThreads } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
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
  const allThreads = wsIds.length > 0
    ? await db.query.agentThreads.findMany({
        where: (t, { and, inArray, eq }) => and(
          inArray(t.workspaceId, wsIds),
          eq(t.threadStatus, 'running')
        ),
      })
    : []

  const result = wsRows.map((w) => {
    const opp = allOpps.find((o) => o.id === w.opportunityId) ?? null
    const customer = opp ? allCustomers.find((c) => c.id === opp.customerId) ?? null : null
    return {
      workspace: w,
      opportunity: opp,
      customer,
      pendingActionCount: allActions.filter((a) => a.workspaceId === w.id).length,
      runningAgentCount: allThreads.filter((t) => t.workspaceId === w.id).length,
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
