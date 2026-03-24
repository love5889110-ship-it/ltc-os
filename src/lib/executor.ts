/**
 * Action 执行引擎
 * 审批通过后，根据 action_type 路由到对应执行器
 */
import { db } from '@/db'
import {
  agentActions,
  agentRuns,
  agentThreads,
  executionLogs,
  stateSnapshots,
  opportunityWorkspaces,
  opportunities,
  customers,
  tasks,
  drafts,
  assets,
  notifications,
  connectorInstances,
  agentSkills,
} from '@/db/schema'
import { generateId } from '@/lib/utils'
import { eq, desc, and } from 'drizzle-orm'
import { minimaxChat } from '@/lib/minimax'
import { getAISettings } from '@/lib/ai-settings'
import { pushNotification } from '@/lib/notify'
import { getToolById } from '@/lib/tool-registry'

export type ExecutionResult =
  | { success: true; result: Record<string, unknown> }
  | { success: false; errorCode: string; errorMessage: string }

/**
 * 执行一个已审批的动作
 */
export async function executeAction(actionId: string): Promise<ExecutionResult> {
  const action = await db.query.agentActions.findFirst({
    where: eq(agentActions.id, actionId),
  })
  if (!action) {
    return { success: false, errorCode: 'NOT_FOUND', errorMessage: '动作不存在' }
  }
  if (action.actionStatus !== 'approved') {
    return { success: false, errorCode: 'NOT_APPROVED', errorMessage: '动作未审批' }
  }

  // Mark as executing
  await db
    .update(agentActions)
    .set({ actionStatus: 'executing', updatedAt: new Date() })
    .where(eq(agentActions.id, actionId))

  const logId = generateId()
  const payload = (action.actionPayloadJson ?? {}) as Record<string, unknown>

  try {
    let result: Record<string, unknown> = {}

    switch (action.actionType) {
      case 'create_task':
        result = await executeCreateTask(action.workspaceId, payload, actionId, action.runId ?? undefined)
        break
      case 'send_draft':
        result = await executeSendDraft(action.workspaceId, payload, actionId, action.runId ?? undefined)
        break
      case 'create_snapshot':
        result = await executeCreateSnapshot(action.workspaceId, payload)
        break
      case 'update_status':
        result = await executeUpdateStatus(action.workspaceId, payload)
        break
      case 'escalate':
        result = await executeEscalate(action.workspaceId, payload)
        break
      case 'notify':
        result = await executeNotify(action.workspaceId, actionId, payload)
        break
      case 'create_collab':
        result = await executeCreateCollab(action.workspaceId, actionId, payload)
        break
      case 'call_tool':
        result = await executeCallTool(action.workspaceId, payload, action.runId ?? undefined)
        break
      default:
        result = { message: `动作类型 ${action.actionType} 已记录，等待人工处理` }
    }

    // Mark completed
    await db
      .update(agentActions)
      .set({ actionStatus: 'completed', executedAt: new Date(), updatedAt: new Date() })
      .where(eq(agentActions.id, actionId))

    // Write execution log
    await db.insert(executionLogs).values({
      id: logId,
      actionId,
      executorType: action.actionType,
      requestPayloadJson: payload,
      responsePayloadJson: result,
      executionStatus: 'completed',
      executedAt: new Date(),
    })

    return { success: true, result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    await db
      .update(agentActions)
      .set({
        actionStatus: 'failed',
        failedAt: new Date(),
        retryCount: (action.retryCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(agentActions.id, actionId))

    await db.insert(executionLogs).values({
      id: logId,
      actionId,
      executorType: action.actionType,
      requestPayloadJson: payload,
      responsePayloadJson: {},
      executionStatus: 'failed',
      errorCode: 'EXECUTION_ERROR',
      errorMessage: msg,
      executedAt: new Date(),
    })

    return { success: false, errorCode: 'EXECUTION_ERROR', errorMessage: msg }
  }
}

// ─── 各类动作执行器 ────────────────────────────────────────────────────────────

async function executeCreateTask(
  workspaceId: string,
  payload: Record<string, unknown>,
  actionId: string,
  runId?: string
): Promise<Record<string, unknown>> {
  const taskId = generateId()

  // 查询商机和客户名称，写入任务描述前缀，方便任务中心展示上下文
  let contextPrefix = ''
  const ws = await db.query.opportunityWorkspaces.findFirst({ where: eq(opportunityWorkspaces.id, workspaceId) })
  if (ws) {
    const opp = await db.query.opportunities.findFirst({ where: eq(opportunities.id, ws.opportunityId) })
    if (opp) {
      const customer = await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) })
      contextPrefix = `[${customer?.name ?? ''}·${opp.name}] `
    }
  }

  const originalDesc = (payload.description as string) ?? null
  await db.insert(tasks).values({
    id: taskId,
    workspaceId,
    runId: runId ?? null,
    actionId,
    title: (payload.title as string) ?? '未命名任务',
    description: originalDesc ? `${contextPrefix}${originalDesc}` : (contextPrefix || null),
    assignedTo: (payload.assignee as string) ?? null,
    priority: (payload.priority as number) ?? 3,
    taskStatus: 'pending',
  })
  return {
    taskId,
    title: payload.title ?? '未命名任务',
    status: 'pending',
    message: '任务已创建，可在任务中心查看',
  }
}

async function executeSendDraft(
  workspaceId: string,
  payload: Record<string, unknown>,
  actionId: string,
  runId?: string
): Promise<Record<string, unknown>> {
  // Get workspace context for AI content generation
  const workspace = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, workspaceId),
  })

  let draftContent = (payload.draft as string) ?? (payload.description as string) ?? ''

  // If content is missing or too short, use MiniMax to generate full content
  if (draftContent.length < 100) {
    const opportunity = workspace
      ? await db.query.opportunities.findFirst({
          where: eq(opportunities.id, workspace.opportunityId),
        })
      : null

    // Find relevant assets
    const relatedAssets = await db.query.assets.findMany({
      where: (a, { eq }) => eq(a.status, 'active'),
      orderBy: (a, { desc }) => [desc(a.usageCount)],
      limit: 3,
    })
    const assetContext = relatedAssets.length > 0
      ? '\n\n参考素材：\n' + relatedAssets.map((a) => `- ${a.title}：${a.summary ?? ''}`).join('\n')
      : ''

    const contextSummary = [
      opportunity ? `商机名称：${opportunity.name}，阶段：${opportunity.stage}` : '',
      workspace ? `商机健康度：${workspace.healthScore}，风险分：${workspace.riskScore}` : '',
      `任务标题：${payload.title ?? ''}`,
      `任务描述：${payload.description ?? ''}`,
    ].filter(Boolean).join('\n')

    draftContent = await minimaxChat({
      system: '你是一个专业的销售文案助手，根据商机背景生成专业、具体的沟通草稿，长度200-500字，风格正式但不生硬。',
      user: `请生成一份完整的草稿：\n\n${contextSummary}${assetContext}\n\n直接输出草稿正文，不需要额外说明。`,
      maxTokens: 1024,
    })
  }

  const draftId = generateId()
  const draftType = determineDraftType(payload)

  await db.insert(drafts).values({
    id: draftId,
    workspaceId,
    runId: runId ?? null,
    actionId,
    draftType,
    title: (payload.title as string) ?? '草稿',
    recipientInfo: (payload.recipient as Record<string, unknown>) ?? {},
    content: draftContent,
    draftStatus: 'pending_review',
  })

  return {
    draftId,
    title: payload.title ?? '草稿',
    contentLength: draftContent.length,
    status: 'pending_review',
    message: '草稿已生成，可在草稿中心审阅后发送',
  }
}

function determineDraftType(payload: Record<string, unknown>): 'email' | 'proposal_section' | 'tender_response' | 'wechat' | 'report' {
  const title = ((payload.title as string) ?? '').toLowerCase()
  if (title.includes('邮件') || title.includes('email')) return 'email'
  if (title.includes('方案') || title.includes('proposal')) return 'proposal_section'
  if (title.includes('标书') || title.includes('投标') || title.includes('tender')) return 'tender_response'
  if (title.includes('微信') || title.includes('wechat')) return 'wechat'
  if (title.includes('报告') || title.includes('report')) return 'report'
  return 'email'
}

async function executeCreateSnapshot(
  workspaceId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const workspace = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, workspaceId),
  })
  if (!workspace) throw new Error('Workspace 不存在')

  const opp = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, workspace.opportunityId),
  })

  const snapshotId = generateId()
  await db.insert(stateSnapshots).values({
    id: snapshotId,
    workspaceId,
    snapshotType: 'auto',
    stage: workspace.currentStage ?? opp?.stage ?? null,
    healthScore: workspace.healthScore,
    riskSummary: (payload.riskSummary as string) ?? null,
    nextActionsJson: (payload.nextActions as unknown[]) ?? [],
    blockersJson: (payload.blockers as unknown[]) ?? [],
  })

  await db
    .update(opportunityWorkspaces)
    .set({ lastSnapshotId: snapshotId, updatedAt: new Date() })
    .where(eq(opportunityWorkspaces.id, workspaceId))

  return { snapshotId, message: '状态快照已生成' }
}

async function executeUpdateStatus(
  workspaceId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const updates: Partial<typeof opportunityWorkspaces.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (payload.stage) updates.currentStage = payload.stage as string
  if (typeof payload.healthScore === 'number') updates.healthScore = payload.healthScore
  if (typeof payload.riskScore === 'number') updates.riskScore = payload.riskScore

  await db
    .update(opportunityWorkspaces)
    .set(updates)
    .where(eq(opportunityWorkspaces.id, workspaceId))

  return { message: '状态已更新', updates }
}

async function executeEscalate(
  workspaceId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await db
    .update(opportunityWorkspaces)
    .set({ riskScore: 80, updatedAt: new Date() })
    .where(eq(opportunityWorkspaces.id, workspaceId))

  return {
    escalationId: generateId(),
    reason: payload.description ?? payload.title ?? '需要升级处理',
    message: '已升级，驾驶舱风险告警已触发',
  }
}

async function executeNotify(
  workspaceId: string,
  actionId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const title = (payload.title as string) ?? '通知'
  const desc = (payload.description as string) ?? ''
  const urgent = (payload.priority as number ?? 3) >= 4

  const result = await pushNotification({
    title: `【数字员工通知】${title}`,
    body: desc,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/intervention`,
    actionLabel: '前往干预台',
    urgent,
  })

  await db.insert(notifications).values({
    id: generateId(),
    workspaceId,
    actionId,
    channel: result.channel,
    title,
    content: desc,
    deliveryStatus: result.success ? 'sent' : 'failed',
    errorMessage: result.error ?? null,
  })

  if (!result.success) {
    throw new Error(`通知发送失败（${result.channel}）：${result.error}`)
  }

  return {
    status: 'sent',
    channel: result.channel,
    message: `通知已发送至 ${result.channel}`,
  }
}

async function executeCreateCollab(
  workspaceId: string,
  actionId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const title = (payload.title as string) ?? '协作请求'
  const desc = (payload.description as string) ?? ''
  const urgent = (payload.priority as number ?? 3) >= 4

  const result = await pushNotification({
    title: `【协作请求】${title}`,
    body: `${desc}\n请查看系统处理。`,
    actionUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/intervention`,
    actionLabel: '前往处理',
    urgent,
  })

  await db.insert(notifications).values({
    id: generateId(),
    workspaceId,
    actionId,
    channel: result.channel,
    title,
    content: desc,
    deliveryStatus: result.success ? 'sent' : 'failed',
    errorMessage: result.error ?? null,
  })

  if (!result.success) {
    throw new Error(`协作请求发送失败（${result.channel}）：${result.error}`)
  }

  return {
    status: 'sent',
    channel: result.channel,
    message: `协作请求已发送至 ${result.channel}`,
  }
}

// ── call_tool 执行器 ──────────────────────────────────────────────────────────

async function executeCallTool(
  workspaceId: string,
  payload: Record<string, unknown>,
  runId?: string
): Promise<Record<string, unknown>> {
  const toolId = payload.toolId as string | undefined
  const toolInput = (payload.toolInput as Record<string, unknown>) ?? {}

  if (!toolId) throw new Error('call_tool 动作缺少 toolId 参数')

  const tool = getToolById(toolId)
  if (!tool) throw new Error(`工具 "${toolId}" 不存在，请检查 tool-registry.ts`)

  // ACL：检查 Agent 是否已装载此工具
  if (runId) {
    const run = await db.query.agentRuns.findFirst({
      where: eq(agentRuns.id, runId),
    })
    if (run?.threadId) {
      const thread = await db.query.agentThreads.findFirst({
        where: eq(agentThreads.id, run.threadId),
      })
      if (thread?.agentType) {
        const skill = await db.query.agentSkills.findFirst({
          where: and(
            eq(agentSkills.agentType, thread.agentType as any),
            eq(agentSkills.toolId, toolId),
            eq(agentSkills.enabled, true)
          ),
        })
        if (!skill) {
          return {
            success: false,
            message: `Agent「${thread.agentType}」未装载工具「${tool.name}」，请在技能工坊中装载后重试`,
          }
        }
      }
    }
  }

  // 若工具需要连接器，查询授权配置
  let connectorConfig: Record<string, unknown> | undefined
  if (tool.requiresConnector) {
    const connector = await db.query.connectorInstances.findFirst({
      where: (c, { and, eq }) => and(
        eq(c.connectorType, tool.requiresConnector as any),
        eq(c.enabled, true)
      ),
    })
    if (!connector) {
      return { success: false, message: `工具「${tool.name}」需要先在「连接器与模型」中完成 ${tool.requiresConnector} 授权` }
    }
    connectorConfig = (connector.configJson as Record<string, unknown>) ?? undefined
  }

  // 将 workspaceId 注入 toolInput，供 create_ppt 等工具写 DB 使用
  const toolResult = await tool.execute({ ...toolInput, workspaceId }, connectorConfig)
  return {
    toolId,
    toolName: tool.name,
    success: toolResult.success,
    message: toolResult.message,
    data: toolResult.data ?? null,
  }
}
