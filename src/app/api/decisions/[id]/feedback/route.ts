import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { agentDecisions, agentRuns, agentThreads, feedbackSamples, humanInterventions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { isCorrect, correctJudgment } = await req.json()

  const decision = await db.query.agentDecisions.findFirst({
    where: eq(agentDecisions.id, id),
  })
  if (!decision) return NextResponse.json({ error: '决策不存在' }, { status: 404 })

  // Resolve agentType via run → thread
  let agentType: string | null = null
  const run = await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, decision.runId) })
  if (run?.threadId) {
    const thread = await db.query.agentThreads.findFirst({ where: eq(agentThreads.id, run.threadId) })
    agentType = thread?.agentType ?? null
  }

  const originalOutput = {
    label: decision.decisionLabel,
    type: decision.decisionType,
    rationale: decision.rationaleSummary,
    confidence: decision.confidenceScore,
    severity: decision.severityLevel,
  }

  await db.insert(feedbackSamples).values({
    id: generateId(),
    sourceType: 'decision_feedback',
    sourceObjectId: id,
    agentType: agentType as any,
    scenarioType: decision.decisionType,
    workspaceId: run?.inputContextJson ? (run.inputContextJson as any).workspaceId ?? null : null,
    feedbackLabel: isCorrect ? 'accepted' : 'rejected',
    feedbackReasonCode: isCorrect ? 'decision_correct' : 'decision_wrong',
    originalOutputJson: originalOutput,
    correctedOutputJson: correctJudgment ? { correct_judgment: correctJudgment } : {},
    reusableFlag: !isCorrect,
  })

  await db.insert(humanInterventions).values({
    id: generateId(),
    relatedObjectType: 'agent_decision',
    relatedObjectId: id,
    interventionType: 'override_decision',
    beforeJson: originalOutput,
    afterJson: { isCorrect, correctJudgment: correctJudgment ?? null },
  })

  return NextResponse.json({ ok: true })
}
