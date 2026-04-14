/**
 * 工具注册表 — 数字员工可装载的行动技能
 *
 * 每个 ToolDef 描述一种外部能力。Agent 在 system prompt 中看到已装载的工具列表，
 * 可通过 actionType='call_tool' + payload.toolId 来调用。
 * executor.ts 负责实际路由执行。
 */

export type ToolCategory = 'communicate' | 'browse' | 'document' | 'data'

export type ToolResult = {
  success: boolean
  message: string
  data?: Record<string, unknown>
}

/** 工具风险等级：只读/内部写入/外部发送 */
export type ToolRiskLevel = 'readonly' | 'internal_write' | 'external_send'

export type ToolDef = {
  id: string
  name: string
  category: ToolCategory
  description: string
  /** 需要的连接器类型（对应 connectorTypeEnum），null 表示无需授权 */
  requiresConnector: string | null
  /** 是否支持在沙盘中测试 */
  testable: boolean
  /** 风险等级：readonly=只读查询，internal_write=内部写入（任务/草稿），external_send=对外发送（需审批） */
  riskLevel: ToolRiskLevel
  /** 超时时间（毫秒），默认 30000 */
  timeoutMs?: number
  /** 输出字段描述，Agent 可参考 */
  outputSchema?: Record<string, string>
  /** 执行函数：toolInput 来自 actionPayloadJson.toolInput，connectorConfig 来自 connectorInstances.configJson */
  execute: (toolInput: Record<string, unknown>, connectorConfig?: Record<string, unknown>) => Promise<ToolResult>
}

// ── 工具实现 ──────────────────────────────────────────────────────────────────

async function sendWecomMessage(
  input: Record<string, unknown>,
  config?: Record<string, unknown>
): Promise<ToolResult> {
  const { touser, content } = input as { touser?: string; content?: string }
  if (!touser || !content) {
    return { success: false, message: '缺少 touser 或 content 参数' }
  }
  const accessToken = config?.accessToken as string | undefined
  if (!accessToken) {
    return { success: false, message: '企业微信连接器未授权，请先在「连接器与模型」中完成配置' }
  }
  try {
    const res = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ touser, msgtype: 'text', agentid: config?.agentId ?? 0, text: { content } }),
      }
    )
    const json = await res.json() as { errcode?: number; errmsg?: string; msgid?: string }
    if (json.errcode === 0) {
      return { success: true, message: `已发送企业微信消息至 ${touser}`, data: { msgid: json.msgid } }
    }
    return { success: false, message: `企业微信 API 错误：${json.errmsg}（code ${json.errcode}）` }
  } catch (e) {
    return { success: false, message: `网络错误：${String(e)}` }
  }
}

async function sendDingtalkMessage(
  input: Record<string, unknown>,
  config?: Record<string, unknown>
): Promise<ToolResult> {
  const { content, atMobiles } = input as { content?: string; atMobiles?: string[] }
  if (!content) {
    return { success: false, message: '缺少 content 参数' }
  }
  const webhookUrl = config?.webhookUrl as string | undefined
  if (!webhookUrl) {
    return { success: false, message: '钉钉连接器未配置 webhookUrl，请先在「连接器与模型」中完成配置' }
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: { content },
        at: { atMobiles: atMobiles ?? [], isAtAll: false },
      }),
    })
    const json = await res.json() as { errcode?: number; errmsg?: string }
    if (json.errcode === 0) {
      return { success: true, message: `已发送钉钉消息` }
    }
    return { success: false, message: `钉钉 API 错误：${json.errmsg}（code ${json.errcode}）` }
  } catch (e) {
    return { success: false, message: `网络错误：${String(e)}` }
  }
}

async function sendEmail(
  input: Record<string, unknown>,
  _config?: Record<string, unknown>
): Promise<ToolResult> {
  const { to, subject, body, workspaceId } = input as {
    to?: string; subject?: string; body?: string; workspaceId?: string
  }
  if (!to || !subject || !body) {
    return { success: false, message: '缺少 to、subject 或 body 参数' }
  }
  if (!workspaceId) {
    return { success: false, message: '缺少 workspaceId，无法写入草稿' }
  }
  // 写入 drafts 表，走人工审阅发送流程
  try {
    const { db } = await import('@/db')
    const { drafts } = await import('@/db/schema')
    const { generateId } = await import('@/lib/utils')
    const id = generateId()
    await db.insert(drafts).values({
      id,
      workspaceId,
      draftType: 'email',
      title: subject,
      recipientInfo: { to, subject, channel: 'email' },
      content: body,
      draftStatus: 'pending_review',
    })
    return {
      success: true,
      message: `邮件草稿已写入审阅队列（收件人：${to}，主题：${subject}），请前往「草稿中心」发送`,
      data: { draftId: id, to, subject },
    }
  } catch (e) {
    return { success: false, message: `写入草稿失败：${String(e)}` }
  }
}

async function browseWeb(
  input: Record<string, unknown>,
  _config?: Record<string, unknown>
): Promise<ToolResult> {
  const { url, instruction } = input as { url?: string; instruction?: string }
  if (!url) {
    return { success: false, message: '缺少 url 参数' }
  }
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const text = await res.text()
    const content = text.slice(0, 3000)
    return {
      success: true,
      message: `已读取：${url}${instruction ? `（指令：${instruction}）` : ''}`,
      data: { url, content, length: text.length },
    }
  } catch (e) {
    return { success: false, message: `浏览失败：${String(e)}` }
  }
}

async function createPpt(
  input: Record<string, unknown>,
  _config?: Record<string, unknown>
): Promise<ToolResult> {
  const { title, topic, workspaceId } = input as {
    title?: string
    topic?: string
    workspaceId?: string
  }
  if (!title) {
    return { success: false, message: '缺少 title 参数' }
  }
  if (!workspaceId) {
    return { success: false, message: '缺少 workspaceId 参数，无法保存草稿' }
  }
  try {
    // 1. 调用 MiniMax 生成 PPT 大纲
    const { minimaxChat } = await import('./minimax')
    const outline = await minimaxChat({
      system: '你是一位专业的 B2B 销售方案经理，擅长制作清晰的商务 PPT。',
      user: `请为"${topic ?? title}"生成一份 PPT 大纲，包含5-7页，每页含页面标题和3-4个要点，用 Markdown 格式输出（用 ## 表示页面标题，- 表示要点）。`,
    })
    // 2. 写入 drafts 表
    const { db } = await import('../db')
    const { drafts } = await import('../db/schema')
    const { generateId } = await import('./utils')
    const id = generateId()
    await db.insert(drafts).values({
      id,
      workspaceId,
      draftType: 'proposal_section',
      title: `PPT大纲：${title}`,
      content: outline,
      draftStatus: 'pending_review',
    })
    return {
      success: true,
      message: `PPT大纲「${title}」已生成并保存为草稿，草稿 ID: ${id}`,
      data: { draftId: id, title },
    }
  } catch (e) {
    return { success: false, message: `生成失败：${String(e)}` }
  }
}

// ── RPA 工具实现 ───────────────────────────────────────────────────────────────

async function callRpaServer(
  taskType: string,
  taskParams: Record<string, unknown>
): Promise<ToolResult> {
  const rpaUrl = process.env.RPA_SERVER_URL
  if (!rpaUrl) {
    return {
      success: false,
      message: 'RPA 服务未配置，请在环境变量 RPA_SERVER_URL 中设置机器地址（如 http://192.168.1.100:8000）',
    }
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
  const callbackUrl = `${appUrl}/api/rpa-callback`

  try {
    const res = await fetch(`${rpaUrl}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskType, taskParams, callbackUrl }),
    })
    const json = await res.json() as {
      taskExecutionId?: string
      status?: string
      outputData?: Record<string, unknown>
      fileUrl?: string
      error?: string
    }
    if (res.ok) {
      return {
        success: true,
        message: `RPA 任务已提交（ID: ${json.taskExecutionId ?? '-'}）`,
        data: {
          taskExecutionId: json.taskExecutionId,
          status: json.status ?? 'pending',
          fileUrl: json.fileUrl,
          ...(json.outputData ?? {}),
        },
      }
    }
    return { success: false, message: `RPA 服务错误：${json.error ?? res.status}` }
  } catch (e) {
    return { success: false, message: `RPA 机器不可达：${String(e)}` }
  }
}

async function rpaCreatePptx(
  input: Record<string, unknown>,
  _config?: Record<string, unknown>
): Promise<ToolResult> {
  const { deliverableId, slides, title } = input as {
    deliverableId?: string
    slides?: unknown
    title?: string
  }
  return callRpaServer('create_pptx', { deliverableId, slides, title })
}

async function rpaCreateDocx(
  input: Record<string, unknown>,
  _config?: Record<string, unknown>
): Promise<ToolResult> {
  const { deliverableId, sections, title, docType } = input as {
    deliverableId?: string
    sections?: unknown
    title?: string
    docType?: string
  }
  return callRpaServer('create_docx', { deliverableId, sections, title, docType })
}

async function rpaCreateXlsx(
  input: Record<string, unknown>,
  _config?: Record<string, unknown>
): Promise<ToolResult> {
  const { deliverableId, rows, title, customerName, totalAmount } = input as {
    deliverableId?: string
    rows?: unknown
    title?: string
    customerName?: string
    totalAmount?: number
  }
  return callRpaServer('create_xlsx', { deliverableId, rows, title, customerName, totalAmount })
}

async function rpaBrowseLogin(
  input: Record<string, unknown>,
  _config?: Record<string, unknown>
): Promise<ToolResult> {
  const { targetSite, query, credentials } = input as {
    targetSite?: string
    query?: string
    credentials?: Record<string, string>
  }
  if (!targetSite || !query) {
    return { success: false, message: '缺少 targetSite 或 query 参数' }
  }
  return callRpaServer('browse_login', { targetSite, query, credentials })
}

// ── 注册表 ────────────────────────────────────────────────────────────────────

export const TOOLS: ToolDef[] = [
  {
    id: 'wecom.send_message',
    name: '发送企业微信消息',
    category: 'communicate',
    description: '向指定企业微信用户发送文本消息。需要先在「连接器与模型」中完成企业微信授权。',
    requiresConnector: 'wecom',
    testable: true,
    riskLevel: 'external_send',
    timeoutMs: 10000,
    outputSchema: { msgid: '消息 ID' },
    execute: sendWecomMessage,
  },
  {
    id: 'dingtalk.send_message',
    name: '发送钉钉群消息',
    category: 'communicate',
    description: '通过钉钉 Webhook 机器人发送消息到指定群。需要先在「连接器与模型」中配置钉钉 Webhook。',
    requiresConnector: 'dingtalk',
    testable: true,
    riskLevel: 'external_send',
    timeoutMs: 10000,
    outputSchema: {},
    execute: sendDingtalkMessage,
  },
  {
    id: 'email.send',
    name: '发送邮件',
    category: 'communicate',
    description: '发送邮件给指定收件人。需要管理员配置 SMTP 或邮件服务 API。',
    requiresConnector: null,
    testable: false,
    riskLevel: 'external_send',
    timeoutMs: 15000,
    outputSchema: { draftId: '草稿 ID（待人工审阅后发送）', to: '收件人', subject: '主题' },
    execute: sendEmail,
  },
  {
    id: 'web.browse',
    name: '浏览网页',
    category: 'browse',
    description: '访问指定 URL，获取页面内容并按指令提取信息（如查看竞品官网、获取招标信息）。',
    requiresConnector: null,
    testable: true,
    riskLevel: 'readonly',
    timeoutMs: 20000,
    outputSchema: { url: '目标 URL', content: '提取的文本内容（最多 3000 字）', length: '原始内容字数' },
    execute: browseWeb,
  },
  {
    id: 'document.create_ppt',
    name: '生成 PPT',
    category: 'document',
    description: '根据标题和大纲生成演示文稿。支持方案 PPT、汇报 PPT 等场景。',
    requiresConnector: null,
    testable: true,
    riskLevel: 'internal_write',
    timeoutMs: 30000,
    outputSchema: { draftId: '草稿 ID', title: 'PPT 标题' },
    execute: createPpt,
  },
  {
    id: 'rpa.create_pptx',
    name: '生成真实PPT文件',
    category: 'document',
    description: '调用 RPA 引擎，将方案大纲（slides JSON）转换为真实 .pptx 文件（含排版）。通常在 generate_solution_ppt 审批通过后调用，传入 deliverableId 和 slides。需配置 RPA_SERVER_URL 环境变量。',
    requiresConnector: null,
    testable: true,
    riskLevel: 'internal_write',
    timeoutMs: 120000,
    outputSchema: { taskExecutionId: 'RPA 任务 ID', fileUrl: '生成的 .pptx 文件下载地址', status: '任务状态' },
    execute: rpaCreatePptx,
  },
  {
    id: 'rpa.create_docx',
    name: '生成真实Word文档',
    category: 'document',
    description: '调用 RPA 引擎，将投标文件/合同意见/交接包等文本内容转换为规范的 .docx 文件（含页眉页脚/公司抬头）。需配置 RPA_SERVER_URL 环境变量。',
    requiresConnector: null,
    testable: true,
    riskLevel: 'internal_write',
    timeoutMs: 120000,
    outputSchema: { taskExecutionId: 'RPA 任务 ID', fileUrl: '生成的 .docx 文件下载地址', status: '任务状态' },
    execute: rpaCreateDocx,
  },
  {
    id: 'rpa.create_xlsx',
    name: '生成真实报价单',
    category: 'document',
    description: '调用 RPA 引擎，将报价数据转换为 .xlsx 报价单（含公司抬头/合计公式/折扣说明）。通常在 generate_quotation 审批通过后调用。需配置 RPA_SERVER_URL 环境变量。',
    requiresConnector: null,
    testable: true,
    riskLevel: 'internal_write',
    timeoutMs: 60000,
    outputSchema: { taskExecutionId: 'RPA 任务 ID', fileUrl: '生成的 .xlsx 文件下载地址', status: '任务状态' },
    execute: rpaCreateXlsx,
  },
  {
    id: 'rpa.browse_login',
    name: 'RPA 浏览器查询',
    category: 'data',
    description: '调用 RPA 引擎，自动登录指定系统（天眼查/内部 CRM/投标平台），查询并返回结构化数据。需配置 RPA_SERVER_URL 环境变量，并在 credentials 中传入账号密码。',
    requiresConnector: null,
    testable: false,
    riskLevel: 'readonly',
    timeoutMs: 180000,
    outputSchema: { queryResult: '查询结果（JSON）', screenshotUrl: '截图地址（可选）', taskExecutionId: 'RPA 任务 ID' },
    execute: rpaBrowseLogin,
  },
]

export function getToolById(id: string): ToolDef | undefined {
  return TOOLS.find(t => t.id === id)
}
