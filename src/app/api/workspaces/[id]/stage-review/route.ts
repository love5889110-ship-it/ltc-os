import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { feedbackSamples, agentDecisions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params
  const body = await req.json()
  const { fromStage, toStage, reviews } = body as {
    fromStage: string
    toStage: string
    reviews: Record<string, { quality: 'correct' | 'biased' | 'wrong'; note?: string }>
  }

  if (!reviews || Object.keys(reviews).length === 0) {
    return NextResponse.json({ error: '未提供复盘数据' }, { status: 400 })
  }

  const labelMap: Record<string, 'accepted' | 'modified' | 'rejected'> = {
    correct: 'accepted',
    biased: 'modified',
    wrong: 'rejected',
  }

  const inserts = await Promise.all(
    Object.entries(reviews).map(async ([decisionId, review]) => {
      const decision = await db.query.agentDecisions.findFirst({
        where: eq(agentDecisions.id, decisionId),
      })
      return db.insert(feedbackSamples).values({
        id: generateId(),
        sourceType: 'stage_review',
        sourceObjectId: decisionId,
        agentType: null,
        scenarioType: `stage_transition:${fromStage}→${toStage}`,
        workspaceId,
        originalOutputJson: decision ? { label: decision.decisionLabel, rationale: decision.rationaleSummary } : {},
        correctedOutputJson: review.note ? { correction: review.note } : {},
        feedbackLabel: labelMap[review.quality] ?? 'accepted',
        feedbackReasonCode: `stage_review_${review.quality}`,
        reusableFlag: review.quality !== 'correct',
      })
    })
  )

  return NextResponse.json({ inserted: inserts.length })
}
