import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { signalEvents, signalBindings, opportunityWorkspaces, opportunities, customers, feedbackSamples } from '@/db/schema'
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
    // [P0-4] Read existing binding for AI candidate info before deleting
    const existing = await db.query.signalBindings.findFirst({
      where: eq(signalBindings.signalEventId, id),
    })
    const aiCandidateId = existing?.opportunityId ?? null
    const aiConfidence = existing?.bindingConfidence ?? null

    const finalOpportunityId = opportunityId ?? existing?.opportunityId ?? null

    // [P0-4] Clear all existing bindings for this signal to avoid orphaned records
    await db.delete(signalBindings).where(eq(signalBindings.signalEventId, id))

    // Insert clean confirmed binding
    await db.insert(signalBindings).values({
      id: generateId(),
      signalEventId: id,
      opportunityId: finalOpportunityId,
      customerId: customerId ?? existing?.customerId ?? null,
      contactId: contactId ?? existing?.contactId ?? null,
      bindingStatus: 'confirmed',
      confirmedAt: new Date(),
      confirmedBy: 'user',
    })

    await db
      .update(signalEvents)
      .set({ status: 'bound' })
      .where(eq(signalEvents.id, id))

    // [P0-1] Write feedbackSample — confirm is a high-value training signal
    const signal = await db.query.signalEvents.findFirst({ where: eq(signalEvents.id, id) })
    const isCorrected = finalOpportunityId && aiCandidateId && finalOpportunityId !== aiCandidateId
    if (signal) {
      let wsId: string | null = null
      if (finalOpportunityId) {
        const ws = await db.query.opportunityWorkspaces.findFirst({
          where: eq(opportunityWorkspaces.opportunityId, finalOpportunityId),
        })
        wsId = ws?.id ?? null
      }
      await db.insert(feedbackSamples).values({
        id: generateId(),
        sourceType: 'signal_binding',
        sourceObjectId: id,
        workspaceId: wsId,
        feedbackLabel: isCorrected ? 'modified' : 'accepted',
        feedbackReasonCode: isCorrected ? 'binding_corrected' : 'binding_confirmed',
        originalOutputJson: { aiCandidateId, aiConfidence, userSelectedId: finalOpportunityId, signalType: signal.signalType },
        reusableFlag: true,
      })
    }

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
    const { ignoreReason } = body
    const signal = await db.query.signalEvents.findFirst({ where: eq(signalEvents.id, id) })
    await db
      .update(signalEvents)
      .set({ status: 'closed' })
      .where(eq(signalEvents.id, id))

    // 沉淀训练样本
    if (ignoreReason && signal) {
      const binding = await db.query.signalBindings.findFirst({ where: eq(signalBindings.signalEventId, id) })
      let wsId: string | null = null
      if (binding?.opportunityId) {
        const ws = await db.query.opportunityWorkspaces.findFirst({
          where: eq(opportunityWorkspaces.opportunityId, binding.opportunityId),
        })
        wsId = ws?.id ?? null
      }
      await db.insert(feedbackSamples).values({
        id: generateId(),
        sourceType: 'signal_ignore',
        sourceObjectId: id,
        workspaceId: wsId,
        feedbackLabel: 'rejected' as const,
        feedbackReasonCode: `ignore_${ignoreReason}`,
        originalOutputJson: { signalType: signal.signalType, summary: signal.contentSummary },
        reusableFlag: true,
      })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: '未知 action' }, { status: 400 })
}

