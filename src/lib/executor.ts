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
  deliverables,
  riskEvents,
  assets,
  notifications,
  connectorInstances,
  agentSkills,
  skillTemplates,
} from '@/db/schema'
import { generateId } from '@/lib/utils'
import { eq, desc, and } from 'drizzle-orm'
import { minimaxChat } from '@/lib/minimax'
import { pushNotification } from '@/lib/notify'
import { getToolById } from '@/lib/tool-registry'
import { triggerExecutionCallback } from '@/lib/stage-engine'

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

  // 溯源：从 run 拿到来源信号 ID
  const run = action.runId
    ? await db.query.agentRuns.findFirst({ where: eq(agentRuns.id, action.runId) })
    : null
  const sourceSignalId = run?.triggerSignalId ?? null

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
        result = await executeEscalate(action.workspaceId, payload, actionId, action.runId ?? undefined)
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
      case 'generate_solution_ppt':
        result = await executeGenerateSolutionPpt(action.workspaceId, payload, actionId)
        break
      case 'generate_tender_doc':
        result = await executeGenerateTenderDoc(action.workspaceId, payload, actionId)
        break
      case 'generate_scene_render':
      case 'parse_tender_document':
      case 'extract_contract_risks':
        result = await executeCapabilityAsDeliverable(action.workspaceId, action.actionType, payload, actionId)
        break
      case 'generate_quotation':
        result = await executeGenerateQuotation(action.workspaceId, payload, actionId)
        break
      case 'generate_safety_proposal':
        result = await executeGenerateSafetyProposal(action.workspaceId, payload, actionId)
        break
      case 'generate_after_sales_report':
        result = await executeGenerateAfterSalesReport(action.workspaceId, payload, actionId)
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
      runId: action.runId ?? null,
      signalId: sourceSignalId,
      executorType: action.actionType,
      requestPayloadJson: payload,
      responsePayloadJson: result,
      executionStatus: 'completed',
      executedAt: new Date(),
    })

    // 执行成功后异步触发 execution_callback（接通 Agent 链）
    triggerExecutionCallback(action.workspaceId, action.actionType, result, action.runId ?? undefined)

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
      runId: action.runId ?? null,
      signalId: sourceSignalId,
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
  payload: Record<string, unknown>,
  actionId?: string,
  _runId?: string
): Promise<Record<string, unknown>> {
  // 升级风险分
  await db
    .update(opportunityWorkspaces)
    .set({ riskScore: 80, updatedAt: new Date() })
    .where(eq(opportunityWorkspaces.id, workspaceId))

  // 写入结构化风险事件
  const riskId = generateId()
  const riskCategory = (payload.riskCategory as string) ?? 'customer_health'
  await db.insert(riskEvents).values({
    id: riskId,
    workspaceId,
    sourceActionId: actionId ?? null,
    riskCategory: riskCategory as any,
    riskLevel: (payload.riskLevel as any) ?? 'high',
    title: (payload.title as string) ?? '风险升级',
    description: (payload.description as string) ?? null,
    triggerEvidence: (payload.evidence as string) ?? null,
    status: 'detected',
    recommendedAction: (payload.recommendedAction as string) ?? null,
  })

  return {
    riskEventId: riskId,
    reason: payload.description ?? payload.title ?? '需要升级处理',
    message: '已升级并写入风险台账，驾驶舱风险告警已触发',
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

async function executeSkillTemplate(
  template: { id: string; name: string; executionConfigJson: unknown },
  toolInput: Record<string, unknown>
): Promise<{ success: boolean; message: string; data?: Record<string, unknown> }> {
  const execConfig = (template.executionConfigJson ?? {}) as Record<string, unknown>
  const execType = (execConfig.type as string) ?? 'stub'

  if (execType === 'http') {
    const apiUrl = execConfig.apiUrl as string
    if (!apiUrl) return { success: false, message: '技能缺少 apiUrl 配置' }
    const method = ((execConfig.httpMethod as string) ?? 'POST').toUpperCase()
    const headers = (execConfig.headers as Record<string, string>) ?? {}
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const res = await fetch(
        method === 'GET' ? `${apiUrl}?${new URLSearchParams(toolInput as Record<string, string>)}` : apiUrl,
        {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: method !== 'GET' ? JSON.stringify(toolInput) : undefined,
          signal: controller.signal,
        }
      )
      const text = await res.text()
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 500) } }
      return { success: res.ok, message: `HTTP ${res.status} ${res.statusText}`, data }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { success: false, message: '技能 HTTP 调用超时（30s）' }
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  if (execType === 'builtin') {
    const builtinToolId = execConfig.toolId as string
    const builtinTool = getToolById(builtinToolId)
    if (!builtinTool) return { success: false, message: `内置工具 ${builtinToolId} 不存在` }
    const result = await builtinTool.execute(toolInput)
    return result
  }

  // stub — 沙盘占位，不真实执行
  return { success: true, message: `[stub] 技能 ${template.name} 已模拟执行`, data: toolInput }
}

async function executeCallTool(
  workspaceId: string,
  payload: Record<string, unknown>,
  runId?: string
): Promise<Record<string, unknown>> {
  const toolId = payload.toolId as string | undefined
  const toolInput = (payload.toolInput as Record<string, unknown>) ?? {}

  if (!toolId) throw new Error('call_tool 动作缺少 toolId 参数')

  // 先查内置工具，找不到则查 skillTemplates
  const tool = getToolById(toolId)
  const skillTemplate = !tool
    ? await db.query.skillTemplates.findFirst({ where: eq(skillTemplates.id, toolId) })
    : null

  if (!tool && !skillTemplate) {
    throw new Error(`工具 "${toolId}" 不存在，请检查 tool-registry 或技能库`)
  }

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
          const toolName = tool?.name ?? skillTemplate?.name ?? toolId
          return {
            success: false,
            message: `Agent「${thread.agentType}」未装载工具「${toolName}」，请在技能工坊中装载后重试`,
          }
        }
      }
    }
  }

  // 内置工具：查 connector 授权并做健康检查后执行
  if (tool) {
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
      // 凭证健康检查：expired → 提示重新授权；degraded/down → 警告但继续尝试
      if (connector.authStatus === 'expired' || connector.authStatus === 'error') {
        return {
          success: false,
          message: `连接器「${tool.requiresConnector}」授权已失效（${connector.authStatus}），请前往「系统配置 → 连接器」重新授权`,
        }
      }
      if (connector.healthStatus === 'down') {
        return {
          success: false,
          message: `连接器「${tool.requiresConnector}」当前不可用（down），请稍后重试或检查连接器状态`,
        }
      }
      connectorConfig = (connector.configJson as Record<string, unknown>) ?? undefined
    }
    const toolResult = await tool.execute({ ...toolInput, workspaceId }, connectorConfig)
    return {
      toolId,
      toolName: tool.name,
      success: toolResult.success,
      message: toolResult.message,
      data: toolResult.data ?? null,
    }
  }

  // 自训练技能：按 executionConfigJson 执行
  const templateResult = await executeSkillTemplate(skillTemplate!, { ...toolInput, workspaceId })
  return {
    toolId,
    toolName: skillTemplate!.name,
    success: templateResult.success,
    message: templateResult.message,
    data: templateResult.data ?? null,
  }
}

// ── 预置能力执行函数 ─────────────────────────────────────────────────────────

/**
 * 生成方案 PPT：结构化 slides[] JSON，注入资产库，写入 deliverables
 */
async function executeGenerateSolutionPpt(
  workspaceId: string,
  payload: Record<string, unknown>,
  actionId: string
): Promise<Record<string, unknown>> {
  const title = (payload.title as string) ?? '解决方案PPT'
  const topic = (payload.topic as string) ?? title
  const stage = (payload.stage as string) ?? null

  // 加载资产库素材
  const relatedAssets = await db.query.assets.findMany({
    where: (a, { eq }) => eq(a.status, 'active'),
    orderBy: (a, { desc }) => [desc(a.usageCount), desc(a.qualityScore)],
    limit: 6,
  })
  const assetContext = relatedAssets.length > 0
    ? '\n\n可参考的资产库素材：\n' + relatedAssets.map(
        (a) => `- 【${a.assetType}】${a.title}：${a.summary ?? ''}${a.fullContent ? '\n  ' + a.fullContent.slice(0, 400) : ''}`
      ).join('\n')
    : ''

  // 加载商机上下文
  const ws = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, workspaceId),
  })
  const opp = ws ? await db.query.opportunities.findFirst({
    where: eq(opportunities.id, ws.opportunityId),
  }) : null

  const contextSummary = [
    opp ? `商机：${opp.name}，阶段：${opp.stage}` : '',
    ws ? `当前阶段：${ws.currentStage ?? ''}，健康分：${ws.healthScore ?? ''}` : '',
  ].filter(Boolean).join('\n')

  const style = (payload.style as string) ?? 'tech'
  const revisionNote = (payload.revisionNote as string) ?? ''
  const previousContent = (payload.previousContent as string) ?? ''

  // 修改模式：在 prompt 开头注入修改指令 + 上一版内容
  const revisionContext = revisionNote
    ? `【修改指令】请根据以下人工审批意见对上一版PPT进行修改，保留无问题的内容，仅修改被指出的部分：\n${revisionNote}\n\n【上一版内容参考（JSON）】\n${previousContent.slice(0, 3000)}\n\n---\n`
    : ''

  const raw = await minimaxChat({
    system: `你是一位专业的 B2B 售前方案经理，擅长为工业安全/VR培训场景制作高质量汇报PPT。
规则：
- 每页 3-5 个 bullet，每条 15-35 字，必须具体，禁止使用"赋能"、"助力"等空话套话
- 每个 bullet 尽量包含数字、客户专有名词、或明确的行动项
- accent 字段：该页最重要的数字/指标（用于右侧卡片展示，如"85%"、"300人/年"、"6周交付"，可不填）
- 输出纯 JSON，不加任何 Markdown 代码块包裹`,
    user: `${revisionContext}请为"${topic}"生成一份 8 页方案汇报PPT，结构如下：
页1-价值主张：3 bullet，每条含具体数字，概括我方核心价值
页2-客户痛点：3-4 bullet，引用客户行业/场景的具体挑战，避免泛泛而谈
页3-解决方案：4-5 bullet，逐一列举产品核心功能与差异化能力
页4-技术架构：3-4 bullet，描述系统架构要点和关键技术（VR引擎、数据平台等）
页5-行业案例：3 bullet，含真实/参考客户名称和量化效果数据
页6-竞争优势：3-4 bullet，与传统培训/竞品的直接对比，优势明确
页7-实施计划：4 bullet，分阶段时间表，含周期和里程碑
页8-投资回报：3 bullet，ROI 量化分析 + 下一步行动 + 具体日期

商机背景：
${contextSummary}
${assetContext}

输出格式（JSON，必须包含 accent 字段）：
{
  "title": "PPT标题",
  "slides": [
    {
      "page": 1,
      "title": "页面标题",
      "bullets": ["具体要点1（含数字或场景）", "要点2", "要点3"],
      "accent": "85%",
      "notes": "演讲备注"
    }
  ]
}`,
    maxTokens: 4000,
  })

  let slidesData: unknown
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    slidesData = jsonMatch ? JSON.parse(jsonMatch[0]) : { title, slides: [] }
  } catch {
    slidesData = { title, slides: [] }
  }

  const deliverableId = generateId()
  const supersedesId = (payload.supersedesId as string) ?? null
  const newVersion = (payload.previousVersion as number ?? 0) + 1
  await db.insert(deliverables).values({
    id: deliverableId,
    workspaceId,
    sourceActionId: actionId,
    type: 'solution_ppt',
    stage,
    title: revisionNote ? `方案PPT（v${newVersion}修订）：${title}` : `方案PPT：${title}`,
    status: 'pending_review',
    content: JSON.stringify(slidesData),
    metadata: { slideCount: (slidesData as any)?.slides?.length ?? 0, style, revisionNote: revisionNote || undefined },
    createdBy: 'agent',
    version: newVersion,
    supersedesId,
  })

  return {
    deliverableId,
    title: `方案PPT：${title}`,
    slideCount: (slidesData as any)?.slides?.length ?? 0,
    message: '方案PPT已生成，可在成果物中心预览',
  }
}

/**
 * 生成投标文件：分节调用 MiniMax，合并写入 deliverables
 */
async function executeGenerateTenderDoc(
  workspaceId: string,
  payload: Record<string, unknown>,
  actionId: string
): Promise<Record<string, unknown>> {
  const title = (payload.title as string) ?? '投标文件'
  const requirements = (payload.requirements as string) ?? ''
  const stage = (payload.stage as string) ?? null

  // 加载资产库
  const relatedAssets = await db.query.assets.findMany({
    where: (a, { eq }) => eq(a.status, 'active'),
    orderBy: (a, { desc }) => [desc(a.usageCount)],
    limit: 8,
  })
  const assetContext = relatedAssets.length > 0
    ? relatedAssets.map((a) => `- 【${a.assetType}】${a.title}：${a.summary ?? ''}${a.fullContent ? '\n' + a.fullContent.slice(0, 500) : ''}`).join('\n')
    : '（暂无资产库素材）'

  const ws = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, workspaceId),
  })
  const opp = ws ? await db.query.opportunities.findFirst({
    where: eq(opportunities.id, ws.opportunityId),
  }) : null
  const customer = opp ? await db.query.customers.findFirst({
    where: eq(customers.id, opp.customerId),
  }) : null

  const bgContext = [
    customer ? `客户：${customer.name}，行业：${customer.industry ?? ''}` : '',
    opp ? `商机：${opp.name}` : '',
    requirements ? `招标需求：${requirements}` : '',
  ].filter(Boolean).join('\n')

  const SECTIONS = [
    { key: 'company_intro', label: '第一节：公司介绍与资质' },
    { key: 'requirement_response', label: '第二节：需求理解与响应' },
    { key: 'solution_design', label: '第三节：方案设计' },
    { key: 'implementation_plan', label: '第四节：实施计划' },
    { key: 'service_commitment', label: '第五节：服务承诺与保障' },
  ]

  const sectionContents: string[] = []

  for (const sec of SECTIONS) {
    const content = await minimaxChat({
      system: '你是一位资深标书撰写专家，负责撰写专业的投标响应文件章节。用中文输出，语言专业、结构清晰。',
      user: `请撰写投标文件的${sec.label}。

背景信息：
${bgContext}

可用资产素材：
${assetContext}

要求：
- 该章节内容充实，500-800字
- 结合上述背景和素材
- 使用标题和段落结构
- 直接输出正文，不需要额外说明`,
      maxTokens: 1200,
    })
    sectionContents.push(`## ${sec.label}\n\n${content}`)
  }

  const fullContent = sectionContents.join('\n\n---\n\n')

  const deliverableId = generateId()
  await db.insert(deliverables).values({
    id: deliverableId,
    workspaceId,
    sourceActionId: actionId,
    type: 'bid_package',
    stage,
    title: `标书：${title}`,
    status: 'pending_review',
    content: fullContent,
    metadata: { sectionCount: SECTIONS.length, requirements },
    createdBy: 'agent',
  })

  return {
    deliverableId,
    title: `标书：${title}`,
    sectionCount: SECTIONS.length,
    contentLength: fullContent.length,
    message: '投标文件已分节生成，可在成果物中心审阅',
  }
}

/**
 * 通用能力执行器：其他预置能力（场景渲染/文件解析/合同风险等）暂时生成占位 deliverable
 */
async function executeCapabilityAsDeliverable(
  workspaceId: string,
  actionType: string,
  payload: Record<string, unknown>,
  actionId: string
): Promise<Record<string, unknown>> {
  const title = (payload.title as string) ?? actionType
  const stage = (payload.stage as string) ?? null

  const typeMap: Record<string, string> = {
    generate_scene_render: 'scene_render',
    parse_tender_document: 'requirement_summary',
    extract_contract_risks: 'contract_review',
  }
  const deliverableType = (typeMap[actionType] ?? 'other') as any

  // 用 MiniMax 生成初步内容
  const content = await minimaxChat({
    system: '你是专业的 B2B 业务助手，根据商机背景生成专业分析内容。',
    user: `请根据以下信息生成"${title}"的初步内容：\n${JSON.stringify(payload, null, 2)}\n\n直接输出正文内容，结构清晰。`,
    maxTokens: 2000,
  })

  const deliverableId = generateId()
  await db.insert(deliverables).values({
    id: deliverableId,
    workspaceId,
    sourceActionId: actionId,
    type: deliverableType,
    stage,
    title,
    status: 'pending_review',
    content,
    metadata: { actionType, payload },
    createdBy: 'agent',
  })

  return {
    deliverableId,
    title,
    message: `成果物「${title}」已生成，可在成果物中心查看`,
  }
}

// ── 报价单生成 ────────────────────────────────────────────────────────────────

async function executeGenerateQuotation(
  workspaceId: string,
  payload: Record<string, unknown>,
  actionId: string
): Promise<Record<string, unknown>> {
  const title = (payload.title as string) ?? '报价单'
  const customerName = (payload.customerName as string) ?? ''
  const stage = (payload.stage as string) ?? null

  // 加载商机与客户信息
  const ws = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, workspaceId),
  })
  const opp = ws ? await db.query.opportunities.findFirst({ where: eq(opportunities.id, ws.opportunityId) }) : null
  const customer = opp ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) }) : null

  // 加载产品/方案资产（用于生成报价参考）
  const assetRows = await db.query.assets.findMany({ limit: 5 })
  const assetBlock = assetRows.map(a => `【${a.title}】${a.summary ?? ''}`).join('\n')

  const context = [
    `客户名称：${customerName || customer?.name || '未知'}`,
    `商机名称：${opp?.name ?? ''}`,
    `采购预算：${opp?.amount ? `${opp.amount} 万元` : '待确认'}`,
    `当前阶段：${ws?.currentStage ?? stage ?? '商务谈判'}`,
    payload.products ? `目标产品/服务：${JSON.stringify(payload.products)}` : '',
    `\n## 产品参考资料\n${assetBlock}`,
  ].filter(Boolean).join('\n')

  const quotationJson = await minimaxChat({
    system: '你是专业的 B2B 销售报价专员，熟悉工业VR安全培训系统定价策略。',
    user: `请为以下商机生成一份结构化报价单 JSON，包含产品行项目和汇总信息。\n\n${context}\n\n输出格式（严格 JSON）：\n{"rows":[{"product":"产品/服务名称","qty":1,"unitPrice":10000,"unit":"套","total":10000,"note":"说明"}],"subtotal":10000,"discountRate":0.9,"finalPrice":9000,"currency":"CNY","validDays":30,"deliveryWeeks":8,"paymentTerms":"合同签订后30%预付，验收后70%"}`,
    maxTokens: 1500,
  })

  // 解析 JSON，失败时保留原始文本
  let content: string
  let metadata: Record<string, unknown> = { actionType: 'generate_quotation', payload }
  try {
    const parsed = JSON.parse(quotationJson)
    content = JSON.stringify(parsed)
    metadata = { ...metadata, quotation: parsed }
  } catch {
    content = quotationJson
  }

  const deliverableId = generateId()
  await db.insert(deliverables).values({
    id: deliverableId,
    workspaceId,
    sourceActionId: actionId,
    type: 'quotation',
    stage,
    title,
    status: 'pending_review',
    content,
    metadata,
    createdBy: 'agent',
  })

  return {
    deliverableId,
    title,
    message: `报价单「${title}」已生成，可在成果物中心查看并导出`,
  }
}

// ── 安全培训方案生成 ──────────────────────────────────────────────────────────

async function executeGenerateSafetyProposal(
  workspaceId: string,
  payload: Record<string, unknown>,
  actionId: string
): Promise<Record<string, unknown>> {
  const title = (payload.title as string) ?? '安全培训方案'
  const stage = (payload.stage as string) ?? null
  const customerIndustry = (payload.customerIndustry as string) ?? ''
  const sceneType = (payload.sceneType as string) ?? ''
  const traineeCount = (payload.traineeCount as number) ?? 0

  // 加载商机与资产
  const ws = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, workspaceId),
  })
  const opp = ws ? await db.query.opportunities.findFirst({ where: eq(opportunities.id, ws.opportunityId) }) : null
  const customer = opp ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) }) : null

  const assetRows = await db.query.assets.findMany({ limit: 6 })
  const assetBlock = assetRows.map(a => `【${a.title}】${a.summary ?? ''}`).join('\n')

  const context = [
    `客户：${customer?.name ?? ''}，行业：${customerIndustry || customer?.industry || '工业制造'}`,
    `培训场景：${sceneType || '综合安全培训'}`,
    `预计培训人数：${traineeCount || '待确认'}人/年`,
    `商机阶段：${ws?.currentStage ?? '交付'}`,
    `\n## 方案参考资产\n${assetBlock}`,
  ].filter(Boolean).join('\n')

  const proposal = await minimaxChat({
    system: '你是工业VR安全培训系统的方案专家，擅长为煤矿、电力、化工、制造等行业制定专业培训方案。',
    user: `请为以下客户制作一份完整的安全培训方案，用 Markdown 格式，包含：培训目标、VR场景配置清单、硬件部署方案、实施计划（分阶段）、预期成效、服务承诺。\n\n${context}`,
    maxTokens: 3000,
  })

  const deliverableId = generateId()
  await db.insert(deliverables).values({
    id: deliverableId,
    workspaceId,
    sourceActionId: actionId,
    type: 'safety_proposal',
    stage,
    title,
    status: 'pending_review',
    content: proposal,
    metadata: { actionType: 'generate_safety_proposal', customerIndustry, sceneType, traineeCount },
    createdBy: 'agent',
  })

  return {
    deliverableId,
    title,
    message: `安全培训方案「${title}」已生成，可在成果物中心查看`,
  }
}

// ── 售后报告生成 ──────────────────────────────────────────────────────────────

async function executeGenerateAfterSalesReport(
  workspaceId: string,
  payload: Record<string, unknown>,
  actionId: string
): Promise<Record<string, unknown>> {
  const title = (payload.title as string) ?? '售后服务报告'
  const stage = (payload.stage as string) ?? null
  const period = (payload.period as string) ?? '近3个月'

  const ws = await db.query.opportunityWorkspaces.findFirst({
    where: eq(opportunityWorkspaces.id, workspaceId),
  })
  const opp = ws ? await db.query.opportunities.findFirst({ where: eq(opportunities.id, ws.opportunityId) }) : null
  const customer = opp ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) }) : null

  // 加载近期任务和信号作为报告素材
  const recentTasks = await db.query.tasks.findMany({
    where: eq(tasks.workspaceId, workspaceId),
    limit: 10,
    orderBy: [desc(tasks.createdAt)],
  })

  const taskSummary = recentTasks.map(t =>
    `- [${t.taskStatus}] ${t.title}${t.description ? `：${t.description.slice(0, 60)}` : ''}`
  ).join('\n')

  const context = [
    `客户：${customer?.name ?? ''}`,
    `商机：${opp?.name ?? ''}`,
    `报告周期：${period}`,
    `当前健康分：${ws?.healthScore ?? '-'}，风险分：${ws?.riskScore ?? '-'}`,
    `\n## 服务任务记录（近期）\n${taskSummary || '暂无记录'}`,
  ].filter(Boolean).join('\n')

  const report = await minimaxChat({
    system: '你是工业VR安全培训系统的客户成功经理，专注于客户售后服务质量与续约管理。',
    user: `请根据以下信息生成一份专业的售后服务报告，用 Markdown 格式，包含：服务摘要、问题处理记录、客户满意度分析、系统使用情况、下一步服务计划、续约建议。\n\n${context}`,
    maxTokens: 2500,
  })

  const deliverableId = generateId()
  await db.insert(deliverables).values({
    id: deliverableId,
    workspaceId,
    sourceActionId: actionId,
    type: 'after_sales_report',
    stage,
    title,
    status: 'pending_review',
    content: report,
    metadata: { actionType: 'generate_after_sales_report', period },
    createdBy: 'agent',
  })

  return {
    deliverableId,
    title,
    message: `售后报告「${title}」已生成，可在成果物中心查看`,
  }
}
