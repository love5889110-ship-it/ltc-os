import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { riskEvents, feedbackSamples } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const status = searchParams.get('status')
  const riskCategory = searchParams.get('riskCategory')

  const rows = await db.query.riskEvents.findMany({
    where: (r, { and, eq }) => {
      const conds: ReturnType<typeof eq>[] = []
      if (workspaceId) conds.push(eq(r.workspaceId, workspaceId))
      if (status) conds.push(eq(r.status, status as any))
      if (riskCategory) conds.push(eq(r.riskCategory, riskCategory as any))
      return conds.length ? and(...conds) : undefined
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
    limit: 100,
  })

  return NextResponse.json({ risks: rows })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { riskId, action, operatorUserId, mitigationNote } = body
  // action: 'acknowledge' | 'mitigate' | 'escalate' | 'close'

  const risk = await db.query.riskEvents.findFirst({
    where: eq(riskEvents.id, riskId),
  })
  if (!risk) return NextResponse.json({ error: '风险事件不存在' }, { status: 404 })

  if (action === 'acknowledge') {
    await db
      .update(riskEvents)
      .set({
        status: 'acknowledged',
        acknowledgedBy: operatorUserId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(riskEvents.id, riskId))
  } else if (action === 'mitigate') {
    await db
      .update(riskEvents)
      .set({
        status: 'mitigated',
        mitigatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(riskEvents.id, riskId))

    // 缓解风险 → 写反馈样本（风险判断被确认有效）
    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'risk_mitigated',
      sourceObjectId: riskId,
      workspaceId: risk.workspaceId,
      originalOutputJson: {
        riskCategory: risk.riskCategory,
        riskLevel: risk.riskLevel,
        title: risk.title,
      },
      correctedOutputJson: { mitigationNote: mitigationNote ?? '' },
      feedbackLabel: 'accepted',
      feedbackReasonCode: 'risk_review',
      reusableFlag: true,
    })
  } else if (action === 'escalate') {
    await db
      .update(riskEvents)
      .set({ status: 'escalated', updatedAt: new Date() })
      .where(eq(riskEvents.id, riskId))
  } else if (action === 'close') {
    await db
      .update(riskEvents)
      .set({
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(riskEvents.id, riskId))
  } else if (action === 'dismiss') {
    // 驳回风险（AI 误判）→ 写负向反馈样本
    await db
      .update(riskEvents)
      .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
      .where(eq(riskEvents.id, riskId))

    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'risk_dismissed',
      sourceObjectId: riskId,
      workspaceId: risk.workspaceId,
      originalOutputJson: {
        riskCategory: risk.riskCategory,
        riskLevel: risk.riskLevel,
        title: risk.title,
        description: risk.description,
      },
      correctedOutputJson: { reason: mitigationNote ?? '判断有误，非真实风险' },
      feedbackLabel: 'rejected',
      feedbackReasonCode: 'risk_false_positive',
      reusableFlag: true,
    })
  }

  return NextResponse.json({ success: true })
}
