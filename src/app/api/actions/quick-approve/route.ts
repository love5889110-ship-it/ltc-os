/**
 * 钉钉/企微一键审批端点
 *
 * 用户在钉钉群机器人消息里点"全部批准"按钮，浏览器打开此 URL。
 * 服务器验证签名后执行审批，返回简单 HTML 确认页，无需登录系统。
 *
 * URL 格式：
 *   GET /api/actions/quick-approve?actionId=xxx&decision=approved&ts=1234567890&token=yyy
 *
 * 签名算法：
 *   payload = `${actionId}:${decision}:${ts}`
 *   token   = HMAC-SHA256(payload, QUICK_APPROVE_SECRET).hex
 *
 * 有效期：10 分钟（ts 参与签名，过期链接自动失效）
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db } from '@/db'
import { agentActions, agentRuns, agentThreads, approvalTasks, feedbackSamples, humanInterventions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { executeAction } from '@/lib/executor'

const SECRET = process.env.QUICK_APPROVE_SECRET ?? 'ltc-quick-approve-secret'
const TTL_MS = 10 * 60 * 1000 // 10 分钟

function verifyToken(actionId: string, decision: string, ts: string, token: string): boolean {
  const payload = `${actionId}:${decision}:${ts}`
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex')
  // Constant-time comparison
  if (expected.length !== token.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  }
  return diff === 0
}

function html(title: string, icon: string, message: string, color: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #f5f7fa; }
    .card { background: white; border-radius: 16px; padding: 48px 40px;
            text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
            max-width: 380px; width: 90%; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    h1 { font-size: 22px; color: ${color}; margin: 0 0 8px; }
    p { font-size: 14px; color: #888; margin: 0; line-height: 1.6; }
    .close { margin-top: 24px; font-size: 13px; color: #bbb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="close">可以关闭此页面</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const actionId = searchParams.get('actionId') ?? ''
  const decision = searchParams.get('decision') ?? ''
  const ts = searchParams.get('ts') ?? ''
  const token = searchParams.get('token') ?? ''

  // Basic param check
  if (!actionId || !decision || !ts || !token) {
    return html('链接无效', '⚠️', '缺少必要参数，请通过系统干预台操作。', '#f59e0b')
  }

  // Decision must be approved or rejected
  if (decision !== 'approved' && decision !== 'rejected') {
    return html('链接无效', '⚠️', '无效的审批操作。', '#f59e0b')
  }

  // Check expiry
  const tsNum = Number(ts)
  if (isNaN(tsNum) || Date.now() - tsNum > TTL_MS) {
    return html('链接已过期', '⏰', '此审批链接已超过 10 分钟有效期，请前往系统干预台操作。', '#6b7280')
  }

  // Verify signature
  if (!verifyToken(actionId, decision, ts, token)) {
    return html('验证失败', '🔒', '链接签名不正确，请通过系统干预台操作。', '#ef4444')
  }

  // Fetch action
  const action = await db.query.agentActions.findFirst({
    where: eq(agentActions.id, actionId),
  })

  if (!action) {
    return html('动作不存在', '❓', '该审批动作已被删除或不存在。', '#6b7280')
  }

  // Already processed
  if (action.actionStatus === 'approved' || action.actionStatus === 'rejected') {
    const already = action.actionStatus === 'approved' ? '已批准' : '已驳回'
    return html(`已${already}`, '✅', `该动作之前已被${already}，无需重复操作。`, '#10b981')
  }

  // Must be pending_approval
  if (action.actionStatus !== 'pending_approval') {
    return html('状态异常', '⚠️', `当前动作状态为 ${action.actionStatus}，无法通过此链接操作。`, '#f59e0b')
  }

  // Resolve agentType for feedback
  let agentType: string | null = null
  if (action.runId) {
    const run = await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, action.runId) })
    if (run?.threadId) {
      const thread = await db.query.agentThreads.findFirst({ where: eq(agentThreads.id, run.threadId) })
      agentType = thread?.agentType ?? null
    }
  }

  if (decision === 'approved') {
    await db.update(agentActions)
      .set({ actionStatus: 'approved', updatedAt: new Date() })
      .where(eq(agentActions.id, actionId))

    await db.insert(approvalTasks).values({
      id: generateId(),
      actionId,
      approvalType: 'manual_review',
      approverUserId: 'dingtalk_quick',
      taskStatus: 'approved',
      decision: 'approved',
      comments: '通过钉钉/企微一键批准',
      completedAt: new Date(),
    })

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
      feedbackReasonCode: 'quick_approve',
      reusableFlag: true,
    })

    // Async execute
    executeAction(actionId).catch(e => console.error('[quick-approve] execute error:', e))

    return html('已批准 ✓', '✅', '动作已批准，AI 正在执行中。结果将在系统中更新。', '#10b981')

  } else {
    await db.update(agentActions)
      .set({ actionStatus: 'rejected', updatedAt: new Date() })
      .where(eq(agentActions.id, actionId))

    await db.insert(approvalTasks).values({
      id: generateId(),
      actionId,
      approvalType: 'manual_review',
      approverUserId: 'dingtalk_quick',
      taskStatus: 'rejected',
      decision: 'rejected',
      comments: '通过钉钉/企微一键驳回',
      completedAt: new Date(),
    })

    await db.insert(humanInterventions).values({
      id: generateId(),
      relatedObjectType: 'agent_action',
      relatedObjectId: actionId,
      interventionType: 'reject_action',
      beforeJson: action.actionPayloadJson as any,
      afterJson: {},
      reasonText: '通过钉钉/企微一键驳回',
      operatorUserId: 'dingtalk_quick',
    })

    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'action_rejection',
      sourceObjectId: actionId,
      agentType: agentType as any,
      scenarioType: action.actionType,
      workspaceId: action.workspaceId,
      originalOutputJson: action.actionPayloadJson as any,
      correctedOutputJson: {},
      feedbackLabel: 'rejected',
      feedbackReasonCode: 'quick_reject',
      reusableFlag: true,
    })

    return html('已驳回', '❌', '动作已驳回，AI 将记录此反馈用于进化学习。', '#ef4444')
  }
}
