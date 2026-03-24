import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { agentActions, agentRuns, agentThreads, approvalTasks, humanInterventions, feedbackSamples, executionLogs } from '@/db/schema'
import { eq, desc, inArray } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { executeAction } from '@/lib/executor'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const workspaceId = searchParams.get('workspaceId')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const actions = await db.query.agentActions.findMany({
    where: (a, { and, eq }) => {
      const conditions = []
      if (status) conditions.push(eq(a.actionStatus, status as any))
      if (workspaceId) conditions.push(eq(a.workspaceId, workspaceId))
      return conditions.length ? and(...conditions) : undefined
    },
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    limit,
  })

  // Batch load execution_logs to show result summaries
  const actionIds = actions.map(a => a.id)
  const logs = actionIds.length > 0
    ? await db.query.executionLogs.findMany({
        where: (l, { inArray }) => inArray(l.actionId, actionIds),
      })
    : []

  const result = actions.map(a => {
    const log = logs.find(l => l.actionId === a.id)
    return {
      ...a,
      resultMessage: (log?.responsePayloadJson as { message?: string } | null)?.message ?? null,
      executionLogStatus: log?.executionStatus ?? null,
    }
  })

  return NextResponse.json({ actions: result })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { actionId, decision, comments, operatorUserId, correctedPayload } = body

  const action = await db.query.agentActions.findFirst({
    where: eq(agentActions.id, actionId),
  })
  if (!action) return NextResponse.json({ error: '动作不存在' }, { status: 404 })

  // Resolve agentType from the run that created this action
  let agentType: string | null = null
  if (action.runId) {
    const run = await db.query.agentRuns.findFirst({
      where: eq(agentRuns.id, action.runId),
    })
    if (run?.threadId) {
      const thread = await db.query.agentThreads.findFirst({
        where: eq(agentThreads.id, run.threadId),
      })
      agentType = thread?.agentType ?? null
    }
  }

  if (decision === 'approved') {
    await db
      .update(agentActions)
      .set({ actionStatus: 'approved', updatedAt: new Date() })
      .where(eq(agentActions.id, actionId))

    await db.insert(approvalTasks).values({
      id: generateId(),
      actionId,
      approvalType: 'manual_review',
      approverUserId: operatorUserId ?? null,
      taskStatus: 'approved',
      decision: 'approved',
      comments: comments ?? null,
      completedAt: new Date(),
    })

    // Collect accepted feedback
    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'action_approval',
      sourceObjectId: actionId,
      agentType: agentType as any,
      scenarioType: action.actionType,
      workspaceId: action.workspaceId,
      originalOutputJson: action.actionPayloadJson as any,
      correctedOutputJson: action.actionPayloadJson as any,
      feedbackLabel: 'accepted',
      feedbackReasonCode: 'manual_approval',
      reusableFlag: true,
    })

    // Trigger execution async (don't block response)
    executeAction(actionId).catch((err) =>
      console.error(`[executor] action ${actionId} failed:`, err)
    )
  } else if (decision === 'rejected') {
    await db
      .update(agentActions)
      .set({ actionStatus: 'rejected', updatedAt: new Date() })
      .where(eq(agentActions.id, actionId))

    await db.insert(approvalTasks).values({
      id: generateId(),
      actionId,
      approvalType: 'manual_review',
      approverUserId: operatorUserId ?? null,
      taskStatus: 'rejected',
      decision: 'rejected',
      comments: comments ?? null,
      completedAt: new Date(),
    })

    await db.insert(humanInterventions).values({
      id: generateId(),
      relatedObjectType: 'agent_action',
      relatedObjectId: actionId,
      interventionType: 'reject_action',
      beforeJson: action.actionPayloadJson as any,
      afterJson: correctedPayload ?? {},
      reasonText: comments ?? null,
      operatorUserId: operatorUserId ?? null,
    })

    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'action_rejection',
      sourceObjectId: actionId,
      agentType: agentType as any,
      scenarioType: action.actionType,
      workspaceId: action.workspaceId,
      originalOutputJson: action.actionPayloadJson as any,
      correctedOutputJson: correctedPayload ?? {},
      feedbackLabel: correctedPayload && Object.keys(correctedPayload).length > 0 ? 'modified' : 'rejected',
      feedbackReasonCode: 'manual_rejection',
      reusableFlag: true,
    })
  }

  return NextResponse.json({ success: true })
}
