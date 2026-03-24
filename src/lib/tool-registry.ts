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

export type ToolDef = {
  id: string
  name: string
  category: ToolCategory
  description: string
  /** 需要的连接器类型（对应 connectorTypeEnum），null 表示无需授权 */
  requiresConnector: string | null
  /** 是否支持在沙盘中测试 */
  testable: boolean
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
  const { to, subject, body } = input as { to?: string; subject?: string; body?: string }
  if (!to || !subject || !body) {
    return { success: false, message: '缺少 to、subject 或 body 参数' }
  }
  // Placeholder — 实际实现需接入 SMTP 或 SendGrid
  return { success: false, message: '邮件发送功能尚未配置，请联系管理员配置 SMTP 服务' }
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

// ── 注册表 ────────────────────────────────────────────────────────────────────

export const TOOLS: ToolDef[] = [
  {
    id: 'wecom.send_message',
    name: '发送企业微信消息',
    category: 'communicate',
    description: '向指定企业微信用户发送文本消息。需要先在「连接器与模型」中完成企业微信授权。',
    requiresConnector: 'wecom',
    testable: true,
    execute: sendWecomMessage,
  },
  {
    id: 'dingtalk.send_message',
    name: '发送钉钉群消息',
    category: 'communicate',
    description: '通过钉钉 Webhook 机器人发送消息到指定群。需要先在「连接器与模型」中配置钉钉 Webhook。',
    requiresConnector: 'dingtalk',
    testable: true,
    execute: sendDingtalkMessage,
  },
  {
    id: 'email.send',
    name: '发送邮件',
    category: 'communicate',
    description: '发送邮件给指定收件人。需要管理员配置 SMTP 或邮件服务 API。',
    requiresConnector: null,
    testable: false,
    execute: sendEmail,
  },
  {
    id: 'web.browse',
    name: '浏览网页',
    category: 'browse',
    description: '访问指定 URL，获取页面内容并按指令提取信息（如查看竞品官网、获取招标信息）。',
    requiresConnector: null,
    testable: true,
    execute: browseWeb,
  },
  {
    id: 'document.create_ppt',
    name: '生成 PPT',
    category: 'document',
    description: '根据标题和大纲生成演示文稿。支持方案 PPT、汇报 PPT 等场景。',
    requiresConnector: null,
    testable: true,
    execute: createPpt,
  },
]

export function getToolById(id: string): ToolDef | undefined {
  return TOOLS.find(t => t.id === id)
}
