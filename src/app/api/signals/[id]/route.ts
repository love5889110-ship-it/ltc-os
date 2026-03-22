import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { signalEvents, signalBindings, opportunityWorkspaces, opportunities, customers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { triggerSignalAgent } from '@/lib/stage-engine'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const signal = await db.query.signalEvents.findFirst({
    where: eq(signalEvents.id, id),
  })
  if (!signal) return NextResponse.json({ error: '不存在' }, { status: 404 })
  return NextResponse.json({
    rawContent: signal.rawContent,
    normalizedContent: signal.normalizedContent,
    parsedEntitiesJson: signal.parsedEntitiesJson ?? {},
    signalType: signal.signalType,
    confidenceScore: signal.confidenceScore,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { action, opportunityId, customerId, contactId, reason } = body

  if (action === 'confirm') {
    // Update existing binding or create new
    const existing = await db.query.signalBindings.findFirst({
      where: eq(signalBindings.signalEventId, id),
    })

    const finalOpportunityId = opportunityId ?? existing?.opportunityId ?? null

    if (existing) {
      await db
        .update(signalBindings)
        .set({
          opportunityId: finalOpportunityId,
          customerId: customerId ?? existing.customerId,
          contactId: contactId ?? existing.contactId,
          bindingStatus: 'confirmed',
          confirmedAt: new Date(),
          confirmedBy: 'user',
        })
        .where(eq(signalBindings.signalEventId, id))
    } else {
      await db.insert(signalBindings).values({
        id: generateId(),
        signalEventId: id,
        opportunityId: finalOpportunityId,
        customerId: customerId ?? null,
        contactId: contactId ?? null,
        bindingStatus: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: 'user',
      })
    }

    await db
      .update(signalEvents)
      .set({ status: 'bound' })
      .where(eq(signalEvents.id, id))

    // C3: 高优先级信号绑定后自动触发 sales_copilot
    if (finalOpportunityId) {
      const signal = await db.query.signalEvents.findFirst({ where: eq(signalEvents.id, id) })
      if (signal && (signal.priority ?? 3) >= 4) {
        const workspace = await db.query.opportunityWorkspaces.findFirst({
          where: (w, { eq }) => eq(w.opportunityId, finalOpportunityId),
        })
        if (workspace) {
          const opp = await db.query.opportunities.findFirst({
            where: eq(opportunities.id, finalOpportunityId),
          })
          const customer = opp
            ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) })
            : null

          triggerSignalAgent(workspace.id, id, {
            opportunity: opp ? { id: opp.id, name: opp.name, stage: opp.stage, amount: opp.amount } : undefined,
            customer: customer ? { id: customer.id, name: customer.name, industry: customer.industry } : undefined,
            currentStage: workspace.currentStage ?? undefined,
            healthScore: workspace.healthScore,
            riskScore: workspace.riskScore,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  }

  if (action === 'ignore') {
    await db
      .update(signalEvents)
      .set({ status: 'closed' })
      .where(eq(signalEvents.id, id))
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: '未知 action' }, { status: 400 })
}

