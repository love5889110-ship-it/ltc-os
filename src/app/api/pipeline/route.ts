import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  opportunityWorkspaces,
  opportunities,
  customers,
  agentThreads,
  agentActions,
} from '@/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'

const STAGES = ['需求挖掘', '方案设计', '招投标', '商务谈判', '合同签订', '交付', '售后']

export async function GET(req: NextRequest) {
  const workspaces = await db.query.opportunityWorkspaces.findMany({
    where: (w, { eq }) => eq(w.workspaceStatus, 'active'),
    orderBy: (w, { desc }) => [desc(w.updatedAt)],
    limit: 50,
  })

  if (workspaces.length === 0) {
    return NextResponse.json({ items: [], stages: STAGES })
  }

  // [P1-2] Batch load all related data in 4 queries total instead of N*4
  const wsIds = workspaces.map((w) => w.id)
  const oppIds = workspaces.map((w) => w.opportunityId).filter(Boolean) as string[]

  const [allOpps, allThreads, allActions] = await Promise.all([
    oppIds.length > 0
      ? db.query.opportunities.findMany({ where: (o, { inArray }) => inArray(o.id, oppIds) })
      : Promise.resolve([]),
    db.query.agentThreads.findMany({
      where: (t, { inArray }) => inArray(t.workspaceId, wsIds),
    }),
    db.query.agentActions.findMany({
      where: (a, { and, inArray }) => and(
        inArray(a.workspaceId, wsIds),
        inArray(a.actionStatus, ['pending', 'pending_approval'])
      ),
    }),
  ])

  const customerIds = allOpps.map((o) => o.customerId).filter(Boolean) as string[]
  const allCustomers = customerIds.length > 0
    ? await db.query.customers.findMany({ where: (c, { inArray }) => inArray(c.id, customerIds) })
    : []

  const result = workspaces.map((ws) => {
    const opp = allOpps.find((o) => o.id === ws.opportunityId) ?? null
    const customer = opp ? allCustomers.find((c) => c.id === opp.customerId) ?? null : null
    const threads = allThreads.filter((t) => t.workspaceId === ws.id)
    const pendingCount = allActions.filter((a) => a.workspaceId === ws.id)
    const runningAgents = threads.filter((t) => t.threadStatus === 'running')

    return {
      workspaceId: ws.id,
      currentStage: ws.currentStage,
      healthScore: ws.healthScore,
      riskScore: ws.riskScore,
      opportunity: opp ? { id: opp.id, name: opp.name, amount: opp.amount, stage: opp.stage } : null,
      customer: customer ? { id: customer.id, name: customer.name } : null,
      pendingActionCount: pendingCount.length,
      runningAgentCount: runningAgents.length,
      agentStatuses: threads.map((t) => ({
        agentType: t.agentType,
        status: t.threadStatus,
        lastActiveAt: t.lastActiveAt,
      })),
      stages: STAGES,
    }
  })

  return NextResponse.json({ items: result, stages: STAGES })
}
