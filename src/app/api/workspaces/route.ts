import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { opportunityWorkspaces, opportunities, customers, agentThreads } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '20')

  const workspaces = await db
    .select({
      workspace: opportunityWorkspaces,
      opportunity: opportunities,
      customer: customers,
    })
    .from(opportunityWorkspaces)
    .leftJoin(opportunities, eq(opportunities.id, opportunityWorkspaces.opportunityId))
    .leftJoin(customers, eq(customers.id, opportunities.customerId))
    .orderBy(desc(opportunityWorkspaces.updatedAt))
    .limit(limit)

  // Enrich with pending action count and running agent count
  const wsIds = workspaces.map((w) => w.workspace.id)
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

  const enriched = workspaces.map((w) => ({
    ...w,
    pendingActionCount: allActions.filter((a) => a.workspaceId === w.workspace.id).length,
    runningAgentCount: allThreads.filter((t) => t.workspaceId === w.workspace.id).length,
  }))

  return NextResponse.json({ workspaces: enriched })
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

  // Auto-create sales_copilot thread
  await db.insert(agentThreads).values({
    id: generateId(),
    workspaceId,
    agentType: 'sales_copilot',
    threadStatus: 'idle',
  })

  return NextResponse.json({ workspaceId }, { status: 201 })
}
