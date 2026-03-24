import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { drafts, humanInterventions, feedbackSamples } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const status = searchParams.get('status')

  const rows = await db.query.drafts.findMany({
    where: (d, { and, eq }) => {
      const conds: ReturnType<typeof eq>[] = []
      if (workspaceId) conds.push(eq(d.workspaceId, workspaceId))
      if (status) conds.push(eq(d.draftStatus, status as any))
      return conds.length ? and(...conds) : undefined
    },
    orderBy: (d, { desc }) => [desc(d.createdAt)],
    limit: 50,
  })

  return NextResponse.json({ drafts: rows })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { draftId, action, reviewNote, operatorUserId, content } = body
  // action: 'approve' | 'reject' | 'mark_sent' | 'save_content'

  const draft = await db.query.drafts.findFirst({ where: eq(drafts.id, draftId) })
  if (!draft) return NextResponse.json({ error: '草稿不存在' }, { status: 404 })

  // [P1-8] Inline content save
  if (action === 'save_content') {
    if (content === undefined) return NextResponse.json({ error: '缺少 content' }, { status: 400 })
    await db.update(drafts).set({ content, updatedAt: new Date() }).where(eq(drafts.id, draftId))
    return NextResponse.json({ success: true })
  }

  if (action === 'approve') {
    await db
      .update(drafts)
      .set({ draftStatus: 'approved', reviewNote: reviewNote ?? null, updatedAt: new Date() })
      .where(eq(drafts.id, draftId))

    await db.insert(humanInterventions).values({
      id: generateId(),
      relatedObjectType: 'draft',
      relatedObjectId: draftId,
      interventionType: 'modify_output',
      beforeJson: { status: 'pending_review' },
      afterJson: { status: 'approved' },
      reasonText: reviewNote ?? null,
      operatorUserId: operatorUserId ?? null,
    })

    // [P0-2] Write feedbackSample — approval is a positive training signal
    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'draft_approval',
      sourceObjectId: draftId,
      workspaceId: draft.workspaceId,
      originalOutputJson: { title: draft.title, content: draft.content.slice(0, 500) },
      feedbackLabel: 'accepted',
      feedbackReasonCode: 'draft_review',
      reusableFlag: true,
    })
  } else if (action === 'reject') {
    await db
      .update(drafts)
      .set({ draftStatus: 'archived', reviewNote: reviewNote ?? null, updatedAt: new Date() })
      .where(eq(drafts.id, draftId))

    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'draft_rejection',
      sourceObjectId: draftId,
      workspaceId: draft.workspaceId,
      originalOutputJson: { title: draft.title, content: draft.content.slice(0, 500) },
      correctedOutputJson: { reviewNote: reviewNote ?? '' },
      feedbackLabel: 'rejected',
      feedbackReasonCode: 'draft_review',
      reusableFlag: true,
    })
  } else if (action === 'mark_sent') {
    await db
      .update(drafts)
      .set({ draftStatus: 'sent', updatedAt: new Date() })
      .where(eq(drafts.id, draftId))
  }

  return NextResponse.json({ success: true })
}
