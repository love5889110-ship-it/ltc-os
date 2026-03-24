/**
 * 统一推送服务
 *
 * 支持渠道：钉钉群机器人 / 企业微信群机器人 / 飞书 Webhook
 *
 * 使用场景：
 * 1. AI 数字员工产生 pending_approval 动作 → 推送"待您决策"通知（含一键批准按钮）
 * 2. 高优先级信号进入收件箱 → 推送"新信号需关注"通知
 */

import { createHmac } from 'crypto'
import { getAISettings } from '@/lib/ai-settings'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'
import { eq } from 'drizzle-orm'

export type NotifyChannel = 'dingtalk' | 'wecom' | 'feishu'

export interface PushMessage {
  title: string
  body: string
  /** 主操作链接（查看详情） */
  actionUrl?: string
  /** 主操作按钮文案 */
  actionLabel?: string
  /** 一键批准链接（仅钉钉 ActionCard 双按钮使用） */
  approveUrl?: string
  /** 一键驳回链接 */
  rejectUrl?: string
  /** 紧急程度：影响消息样式 */
  urgent?: boolean
}

interface PushResult {
  channel: NotifyChannel | 'none'
  success: boolean
  error?: string
}

// ─── 签名工具 ─────────────────────────────────────────────────────────────────

const SECRET = process.env.QUICK_APPROVE_SECRET ?? 'ltc-quick-approve-secret'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'

/**
 * 生成带时间戳签名的一键审批 URL（10分钟有效）
 */
export function buildQuickApproveUrl(actionId: string, decision: 'approved' | 'rejected'): string {
  const ts = Date.now()
  const payload = `${actionId}:${decision}:${ts}`
  const token = createHmac('sha256', SECRET).update(payload).digest('hex')
  return `${APP_URL}/api/actions/quick-approve?actionId=${encodeURIComponent(actionId)}&decision=${decision}&ts=${ts}&token=${token}`
}

// ─── 推送入口 ─────────────────────────────────────────────────────────────────

/**
 * 推送通知到所有已配置的渠道，至少成功一个即视为成功
 */
export async function pushNotification(msg: PushMessage): Promise<PushResult> {
  const results = await Promise.allSettled([
    pushDingTalk(msg),
    pushWeCom(msg),
    pushFeishu(msg),
  ])

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.success) {
      return r.value
    }
  }

  const firstError = results
    .map(r => r.status === 'rejected' ? String(r.reason) : (r.value.error ?? ''))
    .find(Boolean)

  return { channel: 'none', success: false, error: firstError }
}

// ─── 钉钉群机器人 ─────────────────────────────────────────────────────────────

async function pushDingTalk(msg: PushMessage): Promise<PushResult> {
  const connector = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'dingtalk'),
  })
  const config = connector?.configJson as { robotWebhook?: string } | null
  const webhookUrl = config?.robotWebhook

  if (!webhookUrl) return { channel: 'dingtalk', success: false, error: '未配置机器人 Webhook' }

  let body: Record<string, unknown>

  if (msg.approveUrl || msg.rejectUrl) {
    // 双按钮 ActionCard（审批场景）
    const btns: Array<{ title: string; actionURL: string }> = []
    if (msg.approveUrl) btns.push({ title: '✅ 全部批准', actionURL: msg.approveUrl })
    if (msg.rejectUrl) btns.push({ title: '❌ 驳回', actionURL: msg.rejectUrl })
    if (msg.actionUrl) btns.push({ title: msg.actionLabel ?? '查看详情', actionURL: msg.actionUrl })

    body = {
      msgtype: 'actionCard',
      actionCard: {
        title: msg.title,
        text: `${msg.urgent ? '### 🔴 紧急\n\n' : ''}### ${msg.title}\n\n${msg.body}`,
        btns,
        btnOrientation: '1', // 横向排列
      },
    }
  } else if (msg.actionUrl) {
    // 单按钮 ActionCard
    body = {
      msgtype: 'actionCard',
      actionCard: {
        title: msg.title,
        text: `${msg.urgent ? '### 🔴 紧急\n\n' : ''}### ${msg.title}\n\n${msg.body}`,
        singleTitle: msg.actionLabel ?? '立即处理',
        singleURL: msg.actionUrl,
      },
    }
  } else {
    // 纯 Markdown
    body = {
      msgtype: 'markdown',
      markdown: {
        title: msg.title,
        text: `### ${msg.urgent ? '🔴 ' : ''}${msg.title}\n\n${msg.body}`,
      },
    }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { errcode?: number; errmsg?: string }
    if (data.errcode !== 0) throw new Error(data.errmsg ?? `errcode ${data.errcode}`)
    return { channel: 'dingtalk', success: true }
  } catch (e) {
    return { channel: 'dingtalk', success: false, error: String(e) }
  }
}

// ─── 企业微信群机器人 ─────────────────────────────────────────────────────────

async function pushWeCom(msg: PushMessage): Promise<PushResult> {
  const connector = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'wecom'),
  })
  const config = connector?.configJson as { robotWebhook?: string } | null
  const webhookUrl = config?.robotWebhook

  if (!webhookUrl) return { channel: 'wecom', success: false, error: '未配置机器人 Webhook' }

  // 企业微信 Markdown 不支持按钮，用文字链接替代
  const lines = [
    `${msg.urgent ? '> **🔴 紧急**\n' : ''}**${msg.title}**`,
    msg.body,
  ]
  if (msg.approveUrl) lines.push(`\n> [✅ 一键批准](${msg.approveUrl})`)
  if (msg.rejectUrl) lines.push(`> [❌ 驳回](${msg.rejectUrl})`)
  if (msg.actionUrl) lines.push(`> [${msg.actionLabel ?? '查看详情'}](${msg.actionUrl})`)

  const text = lines.filter(Boolean).join('\n\n')

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'markdown', markdown: { content: text } }),
    })
    const data = await res.json() as { errcode?: number; errmsg?: string }
    if (data.errcode !== 0) throw new Error(data.errmsg ?? `errcode ${data.errcode}`)
    return { channel: 'wecom', success: true }
  } catch (e) {
    return { channel: 'wecom', success: false, error: String(e) }
  }
}

// ─── 飞书 Webhook ─────────────────────────────────────────────────────────────

async function pushFeishu(msg: PushMessage): Promise<PushResult> {
  const settings = await getAISettings()
  const webhookUrl = settings.feishuWebhookUrl
  if (!webhookUrl) return { channel: 'feishu', success: false, error: '未配置飞书 Webhook' }

  const lines = [
    `${msg.urgent ? '🔴 ' : ''}${msg.title}`,
    msg.body,
  ]
  if (msg.approveUrl) lines.push(`\n一键批准：${msg.approveUrl}`)
  if (msg.rejectUrl) lines.push(`驳回：${msg.rejectUrl}`)
  if (msg.actionUrl) lines.push(`${msg.actionLabel ?? '查看详情'}：${msg.actionUrl}`)

  const text = lines.filter(Boolean).join('\n')

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { channel: 'feishu', success: true }
  } catch (e) {
    return { channel: 'feishu', success: false, error: String(e) }
  }
}

// ─── 场景化快捷方法 ───────────────────────────────────────────────────────────

const AGENT_NAMES: Record<string, string> = {
  sales_copilot: '销售助手',
  presales_assistant: '售前助手',
  tender_assistant: '招标助手',
  delivery_tracker: '交付跟踪',
  renewal_predictor: '续约预测',
}

/**
 * AI 数字员工产生待审批动作时推送
 *
 * @param actionIds 所有待审批动作的 ID 列表（用于生成一键批准链接）
 *   - 1 个动作：生成单个一键批准 URL
 *   - 多个动作：只提供"查看详情"链接（批量审批需在系统内操作）
 */
export async function notifyPendingApproval(params: {
  agentType: string
  opportunityName: string
  actionIds: string[]
  workspaceId: string
  priority?: number
}) {
  const agentName = AGENT_NAMES[params.agentType] ?? params.agentType
  const isUrgent = (params.priority ?? 3) >= 4
  const count = params.actionIds.length

  const bodyLines = [
    `**商机**：${params.opportunityName}`,
    `**待审批动作**：${count} 条`,
    isUrgent ? '⚠️ 高优先级，建议尽快处理' : '',
  ].filter(Boolean)

  // 单个动作：生成直接批准/驳回链接
  let approveUrl: string | undefined
  let rejectUrl: string | undefined

  if (count === 1) {
    const actionId = params.actionIds[0]
    approveUrl = buildQuickApproveUrl(actionId, 'approved')
    rejectUrl = buildQuickApproveUrl(actionId, 'rejected')
  } else {
    // 多个动作：提示去系统里批量处理
    bodyLines.push(`点击"查看详情"可逐条审批`)
  }

  await pushNotification({
    title: `${agentName} 完成分析，等待您决策`,
    body: bodyLines.join('\n'),
    approveUrl,
    rejectUrl,
    actionUrl: `${APP_URL}/intervention`,
    actionLabel: count === 1 ? '查看详情' : `查看全部 ${count} 条`,
    urgent: isUrgent,
  })
}

/**
 * 高优先级信号进入收件箱时推送
 */
export async function notifyNewSignal(params: {
  summary: string
  signalType: string
  priority: number
  sourceType: string
}) {
  if (params.priority < 4) return

  const sourceNames: Record<string, string> = {
    get_note: 'Get 笔记',
    dingtalk: '钉钉群',
    wecom: '企业微信',
    manual: '手动录入',
  }

  await pushNotification({
    title: '新高优信号待确认归属',
    body: [
      `**来源**：${sourceNames[params.sourceType] ?? params.sourceType}`,
      `**摘要**：${params.summary}`,
      `**优先级**：P${params.priority}`,
    ].join('\n'),
    actionUrl: `${APP_URL}/inbox`,
    actionLabel: '前往收件箱',
    urgent: params.priority >= 5,
  })
}
