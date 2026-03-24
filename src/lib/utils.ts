import { v4 as uuidv4 } from 'uuid'

export function generateId(): string {
  return uuidv4()
}

export function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  return `${days} 天前`
}

export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  demand: '需求',
  risk: '风险',
  opportunity: '商机',
  blocker: '阻塞',
  escalation: '升级',
  info: '信息',
}

export const SIGNAL_STATUS_LABELS: Record<string, string> = {
  unbound: '未归属',
  pending_confirm: '待确认',
  bound: '已归属',
  triggered: '已触发',
  closed: '已关闭',
}

export const AGENT_LABELS: Record<string, string> = {
  coordinator: '销售总控 Agent',
  sales_copilot: '销售 Agent',
  sales: '销售 Agent',
  presales_assistant: '解决方案 Agent',
  tender_assistant: '招标 Agent',
  commercial: '商务 Agent',
  handover: '交付 Agent',
  service_triage: '服务 Agent',
  asset_governance: '资产管理 Agent',
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: '创建任务',
  create_collab: '创建协同单',
  update_status: '更新状态',
  send_draft: '发送草稿',
  escalate: '升级处理',
  create_snapshot: '生成快照',
  notify: '发送通知',
  call_tool: '调用工具',
}

export const SIGNAL_SOURCE_LABELS: Record<string, string> = {
  get_note: '录音笔记',
  recording: '录音',
  dingtalk: '钉钉',
  wechat_proxy: '微信',
  wecom: '企业微信',
  manual: '手动录入',
  file_ocr: '文件',
}

export function signalTypeColor(type: string): string {
  const map: Record<string, string> = {
    demand: 'bg-blue-100 text-blue-700',
    risk: 'bg-red-100 text-red-700',
    opportunity: 'bg-green-100 text-green-700',
    blocker: 'bg-orange-100 text-orange-700',
    escalation: 'bg-purple-100 text-purple-700',
    info: 'bg-gray-100 text-gray-700',
  }
  return map[type] ?? 'bg-gray-100 text-gray-700'
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    unbound: 'bg-gray-100 text-gray-600',
    pending_confirm: 'bg-yellow-100 text-yellow-700',
    bound: 'bg-blue-100 text-blue-700',
    triggered: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-400',
    pending: 'bg-yellow-100 text-yellow-700',
    pending_approval: 'bg-orange-100 text-orange-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    executing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

export function healthScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
}
