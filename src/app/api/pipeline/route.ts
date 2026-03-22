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

  const result = await Promise.all(
    workspaces.map(async (ws) => {
      const opp = await db.query.opportunities.findFirst({
        where: eq(opportunities.id, ws.opportunityId),
      })
      const customer = opp
        ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) })
        : null

      const threads = await db.query.agentThreads.findMany({
        where: eq(agentThreads.workspaceId, ws.id),
      })

      const pendingCount = await db.query.agentActions.findMany({
        where: (a, { and, eq, inArray }) =>
          and(
            eq(a.workspaceId, ws.id),
            inArray(a.actionStatus, ['pending', 'pending_approval'])
          ),
      })

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
  )

  return NextResponse.json({ items: result, stages: STAGES })
}
