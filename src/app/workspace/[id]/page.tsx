'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Bot, AlertTriangle, CheckCircle, Clock, Play, RefreshCw,
  ChevronRight, ChevronDown, Zap, FileText, Radio, GitBranch,
  Trophy, XCircle, X, Users, Briefcase, HardHat, Package,
  Sparkles, Building2, Handshake, Edit2, MoreHorizontal, Plus,
  ShieldAlert, PackageOpen, MessageSquarePlus, Send,
} from 'lucide-react'
import { AGENT_LABELS, ACTION_TYPE_LABELS, SIGNAL_SOURCE_LABELS, formatRelativeTime, healthScoreColor } from '@/lib/utils'

const STAGES = ['需求挖掘', '方案设计', '招投标', '商务谈判', '合同签订', '交付', '售后']

// 专项员工分组（按角色视角）
const SPECIALIST_GROUPS = [
  {
    role: '销售 Agent',
    icon: Briefcase,
    agents: ['sales'],
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    role: '解决方案 Agent',
    icon: Package,
    agents: ['presales_assistant'],
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  {
    role: '招标 Agent',
    icon: FileText,
    agents: ['tender_assistant'],
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    role: '交付 Agent',
    icon: HardHat,
    agents: ['handover'],
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
]

interface WorkspaceDetail {
  workspace: {
    id: string
    currentStage: string | null
    healthScore: number | null
    riskScore: number | null
    blockScore: number | null
    workspaceStatus: string
  }
  opportunity: { id: string; name: string; stage: string; amount: number | null } | null
  customer: { id: string; name: string; industry: string | null; profileJson: Record<string, unknown> | null } | null
  channelPartner: { id: string; name: string; region: string | null; profileJson: Record<string, unknown> | null } | null
  threads: Array<{
    thread: { id: string; agentType: string; threadStatus: string; lastActiveAt: string | null }
    latestRun: {
      id: string
      reasoningSummary: string | null
      outputSummary: string | null
      runStatus: string
      startedAt: string | null
      inputContextSummary: {
        signalCount: number
        assetCount: number
        hasMemory: boolean
        crossAgentSummary: string | null
      } | null
      executionSteps: Array<{
        actionId: string
        executorType: string
        executionStatus: string
        responsePayloadJson: Record<string, unknown>
        executedAt: string | null
      }>
    } | null
    decisions: Array<{ id: string; decisionType: string; decisionLabel: string; severityLevel: number | null; rationaleSummary: string | null }>
  }>
  pendingActions: Array<{
    id: string
    actionType: string
    actionStatus: string
    actionPriority: number | null
    agentType: string | null
    executorCategory: string | null
    actionPayloadJson: { title?: string; description?: string; draft?: string } | null
    createdAt: string | null
  }>
  lastSnapshot: { stage: string | null; healthScore: number | null; riskSummary: string | null; nextActionsJson: unknown[] } | null
  recentSignals: Array<{
    id: string
    signalType: string | null
    sourceType: string | null
    contentSummary: string | null
    priority: number | null
    eventTime: string | null
    status: string
  }>
  completedActions: Array<{
    id: string
    actionType: string
    actionStatus: string
    agentType: string | null
    actionPayloadJson: { title?: string } | null
    updatedAt: string | null
  }>
}

interface Deliverable {
  id: string
  type: string
  title: string
  status: string
  approvalStatus: string | null
  version: number
  stage: string | null
  audience: string | null
  content: string | null
  fileUrl: string | null
  metadata: Record<string, unknown> | null
  createdAt: string | null
  updatedAt: string | null
}

interface RiskEvent {
  id: string
  riskCategory: string
  riskLevel: string
  title: string
  description: string | null
  status: string
  recommendedAction: string | null
  acknowledgedBy: string | null
  createdAt: string | null
}

interface Toast {
  id: string
  message: string
  link?: { label: string; href: string }
}

interface RejectPanel {
  actionId: string
  actionType: string
  comment: string
  correction: string
  feedbackType: string
}

// Helper: renders a group of flat/nested key fields for profile editing
function setNestedKey(obj: Record<string, unknown>, dotKey: string, value: string): Record<string, unknown> {
  const parts = dotKey.split('.')
  if (parts.length === 1) return { ...obj, [parts[0]]: value }
  const top = parts[0]
  return { ...obj, [top]: setNestedKey((obj[top] as Record<string, unknown>) ?? {}, parts.slice(1).join('.'), value) }
}

function getNestedKey(obj: Record<string, unknown>, dotKey: string): string {
  const parts = dotKey.split('.')
  let cur: unknown = obj
  for (const p of parts) cur = (cur as Record<string, unknown>)?.[p]
  return (cur as string) ?? ''
}

function ProfileSection({
  title, fields, draft, onChange,
}: {
  title: string
  fields: { key: string; label: string; placeholder: string }[]
  draft: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-2">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-gray-500 block mb-0.5">{label}</label>
            <input
              value={getNestedKey(draft, key)}
              onChange={(e) => onChange(setNestedKey(draft, key, e.target.value))}
              placeholder={placeholder}
              className="w-full border rounded-lg px-3 py-1.5 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<WorkspaceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'situation' | 'agents' | 'decisions' | 'outputs' | 'deliverables' | 'signals'>(
    (searchParams.get('tab') as 'situation' | 'agents' | 'decisions' | 'outputs' | 'deliverables' | 'signals') ?? 'situation'
  )
  const [runningAgent, setRunningAgent] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [runningCoordinator, setRunningCoordinator] = useState(false)
  const [changingStage, setChangingStage] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [closeModal, setCloseModal] = useState<'won' | 'lost' | null>(null)
  const [showCloseMenu, setShowCloseMenu] = useState(false)
  const [closingDeal, setClosingDeal] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [lostNote, setLostNote] = useState('')
  const [showSpecialists, setShowSpecialists] = useState(false)
  const [showStageConfirm, setShowStageConfirm] = useState<string | null>(null)
  const [decisionFeedback, setDecisionFeedback] = useState<Record<string, 'correct' | 'wrong'>>({})
  const [decisionFeedbackOpen, setDecisionFeedbackOpen] = useState<string | null>(null)
  const [decisionCorrectInput, setDecisionCorrectInput] = useState<Record<string, string>>({})
  // 训练相关状态
  const [rejectPanel, setRejectPanel] = useState<RejectPanel | null>(null)
  // 画像编辑抽屉
  const [profileDrawer, setProfileDrawer] = useState<'customer' | 'channel' | null>(null)
  const [profileDraft, setProfileDraft] = useState<Record<string, unknown>>({})
  // 执行结果可见
  const [completedExpanded, setCompletedExpanded] = useState(false)
  // 执行过程折叠（存 thread.id）
  const [expandedRunDetail, setExpandedRunDetail] = useState<string | null>(null)
  const [executionExpanded, setExecutionExpanded] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)
  // 成果物与风险
  const [deliverablesList, setDeliverablesList] = useState<Deliverable[]>([])
  const [risksList, setRisksList] = useState<RiskEvent[]>([])
  const [expandedDeliverable, setExpandedDeliverable] = useState<string | null>(null)
  const [ackingRisk, setAckingRisk] = useState<string | null>(null)
  // 成果物退回面板（带修改意见）
  const [deliverableRejectId, setDeliverableRejectId] = useState<string | null>(null)
  const [deliverableRejectNote, setDeliverableRejectNote] = useState('')
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  // 聊天式修改指令
  const [instructionOpen, setInstructionOpen] = useState<string | null>(null)
  const [instructionText, setInstructionText] = useState<Record<string, string>>({})
  const [sendingInstruction, setSendingInstruction] = useState<string | null>(null)
  // 成果物 RPA 生成文件状态（deliverableId → 'generating' | 'done'）
  const [generatingFile, setGeneratingFile] = useState<Record<string, 'generating' | 'done'>>({})
  // 阶段复盘
  const [stageReview, setStageReview] = useState<{
    fromStage: string; toStage: string
    reviews: Record<string, { quality: string; note: string }>
  } | null>(null)
  // Tab2 内联审批状态
  const [modifyOpenId, setModifyOpenId] = useState<string | null>(null)
  const [rejectOpenId, setRejectOpenId] = useState<string | null>(null)
  const [modifyText, setModifyText] = useState<Record<string, string>>({})
  const [rejectText, setRejectText] = useState<Record<string, string>>({})

  const load = async () => {
    const res = await fetch(`/api/workspaces/${id}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
    // 并行加载成果物和风险
    const [delRes, riskRes] = await Promise.all([
      fetch(`/api/deliverables?workspaceId=${id}`),
      fetch(`/api/risks?workspaceId=${id}`),
    ])
    if (delRes.ok) {
      const d = await delRes.json()
      setDeliverablesList(d.deliverables ?? [])
    }
    if (riskRes.ok) {
      const r = await riskRes.json()
      setRisksList(r.risks ?? [])
    }
  }

  useEffect(() => { load() }, [id])

  const showToast = (message: string, link?: Toast['link']) => {
    const toastId = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id: toastId, message, link }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 5000)
  }

  const runAgent = async (agentType: string) => {
    if (agentType === 'coordinator') setRunningCoordinator(true)
    setRunningAgent(agentType)
    try {
      await fetch(`/api/workspaces/${id}/run-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, triggerType: 'manual' }),
      })
    } catch { /* fall through */ }
    setRunningAgent(null)
    setRunningCoordinator(false)
    load()
  }

  const handleAction = async (
    actionId: string,
    decision: 'approved' | 'rejected',
    actionType: string,
    comment?: string,
    correction?: string,
    feedbackType?: string,
  ) => {
    setApprovingId(actionId)
    const correctedPayload = correction?.trim() ? { suggestion: correction.trim() } : undefined
    const feedbackLabel = correction?.trim() ? 'modified' : decision === 'approved' ? 'accepted' : 'rejected'
    await fetch('/api/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId, decision, comments: comment, correctedPayload, feedbackLabel,
        feedbackReasonCode: feedbackType || (decision === 'rejected' ? 'manual_rejection' : 'manual_approval'),
      }),
    })
    setApprovingId(null)
    setRejectPanel(null)

    if (decision === 'approved') {
      if (actionType === 'send_draft') showToast('草稿已生成', { label: '查看草稿 →', href: '/drafts' })
      else if (actionType === 'create_task') showToast('任务已创建', { label: '查看任务 →', href: '/tasks' })
    }
    load()
  }

  const handleBulkApprove = async (group: WorkspaceDetail['pendingActions']) => {
    setBulkApproving(true)
    await Promise.all(group.map(a => handleAction(a.id, 'approved', a.actionType)))
    setBulkApproving(false)
  }

  const approveAction = async (actionId: string, correction?: string) => {
    const action = data?.pendingActions.find(a => a.id === actionId)
    if (!action) return
    await handleAction(actionId, 'approved', action.actionType, undefined, correction)
    setModifyOpenId(null)
    setModifyText(p => { const n = { ...p }; delete n[actionId]; return n })
  }

  const rejectAction = async (actionId: string, comment: string) => {
    const action = data?.pendingActions.find(a => a.id === actionId)
    if (!action) return
    await handleAction(actionId, 'rejected', action.actionType, comment)
    setRejectOpenId(null)
    setRejectText(p => { const n = { ...p }; delete n[actionId]; return n })
  }

  const handleStageChange = async (newStage: string) => {
    setChangingStage(true)
    await fetch(`/api/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStage: newStage }),
    })
    setChangingStage(false)
    // 阶段推进后，若有 coordinator 判断，触发阶段复盘
    if (coordinatorDecisions.length > 0) {
      setStageReview({ fromStage: currentStage, toStage: newStage, reviews: {} })
    }
    load()
  }

  const handleCloseDeal = async (outcome: 'won' | 'lost') => {
    if (outcome === 'lost' && !lostReason) return
    setClosingDeal(true)
    await fetch(`/api/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceStatus: 'closed',
        closeOutcome: outcome,
        lostReason: outcome === 'lost' ? lostReason : undefined,
        lostNote: outcome === 'lost' ? lostNote : undefined,
      }),
    })
    setClosingDeal(false)
    setCloseModal(null)
    router.push('/workspace')
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">加载中...</div>
  if (!data) return <div className="flex items-center justify-center h-full text-gray-400">战场不存在</div>

  const { workspace, opportunity, customer, channelPartner, threads, pendingActions, lastSnapshot, recentSignals, completedActions } = data
  const currentStage = workspace.currentStage ?? opportunity?.stage ?? ''

  // 销售总控 Agent（协调员）
  const coordinatorThread = threads.find(t => t.thread.agentType === 'coordinator')
  const coordinatorRun = coordinatorThread?.latestRun
  const coordinatorDecisions = coordinatorThread?.decisions ?? []
  const isCoordinatorRunning = runningCoordinator || coordinatorThread?.thread.threadStatus === 'running'


  return (
    <div className="h-full flex flex-col">
      {/* Toast */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div key={toast.id} className="bg-gray-900 text-white text-sm rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 min-w-64">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span>{toast.message}</span>
              {toast.link && (
                <button onClick={() => router.push(toast.link!.href)} className="text-blue-300 hover:text-blue-200 whitespace-nowrap ml-1">
                  {toast.link.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* 左：面包屑 + 标题 + 阶段 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
              <span>{customer?.name}</span>
              <ChevronRight className="w-3 h-3" />
              <span>战场总览</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-base font-semibold truncate">{opportunity?.name ?? '未知商机'}</h1>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded flex-shrink-0">{currentStage || '—'}</span>
              {opportunity?.amount && (
                <span className="text-xs text-gray-400 flex-shrink-0">¥{(opportunity.amount / 10000).toFixed(0)}万</span>
              )}
            </div>
          </div>

          {/* 中：阶段进度条 */}
          <div className="flex-1 min-w-0 max-w-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <GitBranch className="w-3 h-3" />当前阶段
              </span>
              <button
                onClick={() => {
                  const idx = STAGES.indexOf(currentStage)
                  const next = STAGES[idx + 1]
                  if (next) setShowStageConfirm(next)
                }}
                disabled={changingStage || STAGES.indexOf(currentStage) >= STAGES.length - 1}
                className="text-[10px] text-blue-600 hover:text-blue-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-0.5"
              >
                推进下一阶段 →
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              {STAGES.map((stage, idx) => {
                const currentIdx = STAGES.indexOf(currentStage)
                const isDone = idx < currentIdx
                const isCurrent = idx === currentIdx
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className={`h-1 w-full rounded-full transition-colors ${
                      isDone ? 'bg-blue-500' : isCurrent ? 'bg-blue-400' : 'bg-gray-200'
                    }`} />
                    <span className={`text-[9px] truncate max-w-full ${
                      isCurrent ? 'text-blue-600 font-semibold' : isDone ? 'text-gray-400' : 'text-gray-300'
                    }`}>{stage}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 右：健康分 + 操作 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className={`text-2xl font-bold leading-none ${healthScoreColor(workspace.healthScore ?? 0)}`}>
                {Math.round(workspace.healthScore ?? 0)}
              </div>
              <div className="text-[10px] text-gray-400">健康分</div>
              <div className="flex gap-2 mt-0.5 text-[10px]">
                <span className="text-red-500">风险 {Math.round(workspace.riskScore ?? 0)}</span>
                <span className="text-orange-500">阻塞 {Math.round(workspace.blockScore ?? 0)}</span>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowCloseMenu(v => !v)}
                className="p-1.5 rounded-lg border text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                title="赢单 / 输单"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showCloseMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCloseMenu(false)} />
                  <div className="absolute right-0 top-9 z-20 bg-white border rounded-xl shadow-lg w-28 overflow-hidden">
                    <button
                      onClick={() => { setShowCloseMenu(false); setCloseModal('won') }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-green-600 hover:bg-green-50"
                    >
                      <Trophy className="w-3.5 h-3.5" />赢单
                    </button>
                    <button
                      onClick={() => { setShowCloseMenu(false); setCloseModal('lost') }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />输单
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* ── 左主区（2列）── */}
          <div className="col-span-2 flex flex-col gap-0">

            {/* ── 单页垂直流（无Tab）── */}

            {/* 顶部快捷导航：有待决策时突出显示 */}
            {pendingActions.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-sm font-medium text-orange-800">有 <strong>{pendingActions.length}</strong> 项动作等待你的审批</span>
                </div>
                <a href="#section-decisions" className="text-xs text-orange-600 font-medium hover:underline">立即查看 ↓</a>
              </div>
            )}

            {/* ── Section: 当前态势 ── */}
            <div className="flex items-center gap-2 px-1 mb-1 mt-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">当前态势</span>
            </div>
            <div className="" id="section-situation">
              <div className="bg-white border border-t-0 rounded-b-xl divide-y">

                {/* A. 系统整体理解 */}
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-semibold text-gray-800">系统当前理解</span>
                    </div>
                    <button
                      onClick={() => runAgent('coordinator')}
                      disabled={!!runningAgent}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40"
                    >
                      {isCoordinatorRunning
                        ? <><RefreshCw className="w-3 h-3 animate-spin" />分析中</>
                        : <><RefreshCw className="w-3 h-3" />重新分析</>
                      }
                    </button>
                  </div>

                  {coordinatorRun?.outputSummary ? (
                    <div className="bg-blue-50 rounded-lg px-3 py-2.5 text-sm text-blue-900 leading-relaxed">
                      {coordinatorRun.outputSummary}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg px-3 py-4 text-center">
                      <p className="text-sm text-gray-400">系统尚未对此商机进行分析</p>
                      <button
                        onClick={() => runAgent('coordinator')}
                        disabled={!!runningAgent}
                        className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-40"
                      >
                        立即触发总控 Agent 分析 →
                      </button>
                    </div>
                  )}

                  {/* 推理过程（可折叠） */}
                  {coordinatorRun?.reasoningSummary && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                        查看推理过程
                      </summary>
                      <p className="mt-1.5 text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 border-l-2 border-gray-300 leading-relaxed">
                        {coordinatorRun.reasoningSummary}
                      </p>
                    </details>
                  )}
                </div>

                {/* B. 关键风险与机会判断 */}
                {coordinatorDecisions.length > 0 && (
                  <div className="px-4 py-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">关键风险与机会</p>
                    <div className="space-y-2">
                      {coordinatorDecisions.slice(0, 6).map((d) => {
                        const severity = d.severityLevel ?? 1
                        return (
                          <div key={d.id} className={`rounded-lg px-3 py-2.5 flex items-start gap-2 ${
                            severity >= 4 ? 'bg-red-50 border border-red-100' :
                            severity >= 3 ? 'bg-amber-50 border border-amber-100' :
                            'bg-gray-50 border border-gray-100'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                              severity >= 4 ? 'bg-red-500' :
                              severity >= 3 ? 'bg-amber-500' : 'bg-blue-400'
                            }`} />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-800">{d.decisionLabel}</p>
                              {d.rationaleSummary && (
                                <p className="text-xs text-gray-500 mt-0.5">{d.rationaleSummary}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* C. 结构化风险台账（来自 riskEvents） */}
                {risksList.filter(r => r.status !== 'closed').length > 0 && (
                  <div className="px-4 py-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      风险台账 · {risksList.filter(r => r.status !== 'closed').length} 项未关闭
                    </p>
                    <div className="space-y-2">
                      {risksList.filter(r => r.status !== 'closed').slice(0, 5).map(r => {
                        const catLabels: Record<string, string> = {
                          requirement_unclear: '需求不清', competitor: '竞品', decision_chain: '决策链',
                          budget: '预算', compliance: '合规', bid_qualification: '投标资格',
                          pricing_margin: '报价毛利', contract_terms: '合同', delivery_scope: '交付',
                          customer_health: '客户健康',
                        }
                        const levelDot: Record<string, string> = {
                          critical: 'bg-red-600', high: 'bg-red-400',
                          medium: 'bg-amber-400', low: 'bg-gray-300',
                        }
                        return (
                          <div key={r.id} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${levelDot[r.riskLevel] ?? 'bg-gray-300'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] bg-white border border-gray-200 text-gray-500 px-1 py-0.5 rounded">
                                  {catLabels[r.riskCategory] ?? r.riskCategory}
                                </span>
                              </div>
                              <p className="text-xs text-gray-700">{r.title}</p>
                            </div>
                            {r.status === 'detected' && (
                              <button
                                onClick={async () => {
                                  setAckingRisk(r.id)
                                  await fetch('/api/risks', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ riskId: r.id, action: 'acknowledge' }),
                                  })
                                  setAckingRisk(null)
                                  load()
                                }}
                                disabled={ackingRisk === r.id}
                                className="text-[10px] text-blue-600 hover:underline flex-shrink-0 disabled:opacity-40"
                              >
                                确认
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* D. 下一步行动建议 */}
                {lastSnapshot?.nextActionsJson && Array.isArray(lastSnapshot.nextActionsJson) && lastSnapshot.nextActionsJson.length > 0 && (
                  <div className="px-4 py-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">建议下一步</p>
                    <div className="space-y-1.5">
                      {(lastSnapshot.nextActionsJson as string[]).map((action, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs text-blue-500 font-bold mt-0.5 flex-shrink-0">{i + 1}</span>
                          <p className="text-xs text-gray-700">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* E. 待审批摘要（有待决策时展示提示） */}
                {pendingActions.length > 0 && (
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                      <p className="text-xs text-orange-700">
                        有 <strong>{pendingActions.length}</strong> 项动作等待你的审批
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('decisions')}
                      className="text-xs text-orange-600 hover:underline font-medium"
                    >
                      去审批 →
                    </button>
                  </div>
                )}

                {/* 空状态 */}
                {!coordinatorRun && coordinatorDecisions.length === 0 && risksList.length === 0 && pendingActions.length === 0 && (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm text-gray-400">系统尚未开始分析此商机</p>
                    <p className="text-xs text-gray-300 mt-1">点击「重新分析」让总控 Agent 读取信号并给出完整判断</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Tab 1: Agent 协作 ── */}
            <div className="flex items-center gap-2 px-1 mb-1 mt-4">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">数字员工协作</span>
            </div>
            <div className="space-y-4">
              <div className="bg-white border border-t-0 rounded-b-xl p-4 space-y-4">

            {/* ── 销售总控 Agent ── */}
            <div className="bg-white rounded-xl border">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold">销售总控 Agent</span>
                  {isCoordinatorRunning && (
                    <span className="text-xs text-blue-500 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />分析中...
                    </span>
                  )}
                  {coordinatorRun && !isCoordinatorRunning && (
                    <span className="text-xs text-gray-400">
                      更新于 {formatRelativeTime(coordinatorRun.startedAt)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => runAgent('coordinator')}
                  disabled={!!runningAgent}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-40"
                >
                  {isCoordinatorRunning
                    ? <><RefreshCw className="w-3 h-3 animate-spin" />分析中</>
                    : <><Play className="w-3 h-3" />重新分析</>
                  }
                </button>
              </div>

              <div className="px-4 py-4 space-y-4">
                {/* 阶段过期警告 */}
                {lastSnapshot?.stage && lastSnapshot.stage !== currentStage && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>上次分析时阶段为「{lastSnapshot.stage}」，当前已变更为「{currentStage}」，判断可能已过期</span>
                    </div>
                    <button
                      onClick={() => runAgent('coordinator')}
                      className="text-xs text-amber-700 font-medium hover:underline flex-shrink-0"
                    >
                      立即重新分析
                    </button>
                  </div>
                )}
                {/* 整体判断摘要 */}
                {coordinatorRun?.outputSummary ? (
                  <div className="bg-blue-50 rounded-lg px-3 py-2.5 text-sm text-blue-900">
                    {coordinatorRun.outputSummary}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 text-center py-4">
                    点击「重新分析」，销售总控 Agent 将读取所有信号，给出整体判断并安排专项助手
                  </div>
                )}

                {/* 风险/机会判断列表 */}
                {coordinatorDecisions.length > 0 && (
                  <div className="space-y-2">
                    {coordinatorDecisions.map((d) => {
                      const severity = d.severityLevel ?? 1
                      const fb = decisionFeedback[d.id]
                      const isOpen = decisionFeedbackOpen === d.id
                      return (
                        <div key={d.id} className={`rounded-lg px-3 py-2.5 ${
                          severity >= 4 ? 'bg-red-50 border border-red-100' :
                          severity >= 3 ? 'bg-amber-50 border border-amber-100' :
                          'bg-gray-50 border border-gray-100'
                        }`}>
                          <div className="flex items-start gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                              severity >= 4 ? 'bg-red-500' :
                              severity >= 3 ? 'bg-amber-500' : 'bg-blue-400'
                            }`} />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-gray-800">{d.decisionLabel}</p>
                              {d.rationaleSummary && (
                                <p className="text-xs text-gray-500 mt-0.5">{d.rationaleSummary}</p>
                              )}
                            </div>
                            {!fb ? (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  title="判断正确"
                                  onClick={async () => {
                                    await fetch(`/api/decisions/${d.id}/feedback`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ isCorrect: true }),
                                    })
                                    setDecisionFeedback(p => ({ ...p, [d.id]: 'correct' }))
                                  }}
                                  className="text-gray-300 hover:text-green-500 transition-colors"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  title="判断有误"
                                  onClick={() => setDecisionFeedbackOpen(isOpen ? null : d.id)}
                                  className="text-gray-300 hover:text-red-400 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className={`text-xs flex-shrink-0 ${fb === 'correct' ? 'text-green-500' : 'text-red-400'}`}>
                                {fb === 'correct' ? '✓ 正确' : '✗ 已纠偏'}
                              </span>
                            )}
                          </div>
                          {isOpen && !fb && (
                            <div className="ml-4 mt-2 space-y-1.5">
                              <input
                                value={decisionCorrectInput[d.id] ?? ''}
                                onChange={e => setDecisionCorrectInput(p => ({ ...p, [d.id]: e.target.value }))}
                                placeholder="正确的判断是什么？（选填）"
                                className="w-full border rounded px-2 py-1 text-xs"
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={async () => {
                                    await fetch(`/api/decisions/${d.id}/feedback`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ isCorrect: false, correctJudgment: decisionCorrectInput[d.id]?.trim() || undefined }),
                                    })
                                    setDecisionFeedback(p => ({ ...p, [d.id]: 'wrong' }))
                                    setDecisionFeedbackOpen(null)
                                  }}
                                  className="px-2 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                >提交纠偏</button>
                                <button
                                  onClick={() => setDecisionFeedbackOpen(null)}
                                  className="px-2 py-0.5 border rounded text-xs text-gray-500 hover:bg-gray-50"
                                >取消</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── 待你决策 ── */}
            {pendingActions.length > 0 && (
              <div className="bg-white rounded-xl border">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold">待你决策</span>
                  <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                    {pendingActions.length}
                  </span>
                  {(() => {
                    const authCount = pendingActions.filter(a => a.executorCategory === 'authorization').length
                    const collabCount = pendingActions.filter(a => a.executorCategory === 'collaboration').length
                    const execCount = pendingActions.filter(a => a.executorCategory === 'execution').length
                    return (
                      <div className="flex gap-1">
                        {authCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">授权 {authCount}</span>}
                        {collabCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">协作 {collabCount}</span>}
                        {execCount > 0 && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">执行 {execCount}</span>}
                      </div>
                    )
                  })()}
                  <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    每次决策都在训练 AI
                  </div>
                </div>

                {/* 按 executorCategory 分组渲染 */}
                {[
                  {
                    key: 'authorization',
                    label: '授权类',
                    desc: '需要你决策授权（报价/合同/重大资源）',
                    style: { dot: 'bg-red-500', badge: 'bg-red-50 text-red-600 border border-red-100', header: 'bg-red-50/60 border-b border-red-100' },
                  },
                  {
                    key: 'collaboration',
                    label: '协作类',
                    desc: 'AI 已准备材料，由你执行（打电话/开会）',
                    style: { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-600 border border-blue-100', header: 'bg-blue-50/60 border-b border-blue-100' },
                  },
                  {
                    key: 'execution',
                    label: '执行类',
                    desc: 'AI 可自动执行，确认后立即生效',
                    style: { dot: 'bg-green-500', badge: 'bg-green-50 text-green-600 border border-green-100', header: 'bg-green-50/40 border-b border-green-100' },
                  },
                ].map(({ key, label, desc, style }) => {
                  const group = pendingActions
                    .filter(a => (a.executorCategory ?? 'execution') === key)
                    .sort((a, b) => (b.actionPriority ?? 3) - (a.actionPriority ?? 3))
                  if (group.length === 0) return null
                  return (
                    <div key={key}>
                      {/* 分组 header */}
                      <div className={`px-4 py-2 flex items-center gap-2 ${style.header}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${style.badge}`}>{label}</span>
                        <span className="text-[11px] text-gray-400">{desc}</span>
                        {key === 'execution' ? (
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              onClick={() => setExecutionExpanded(v => !v)}
                              className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2"
                            >
                              {executionExpanded ? '折叠' : `展开 ${group.length} 条`}
                            </button>
                            <button
                              onClick={() => handleBulkApprove(group)}
                              disabled={bulkApproving || !executionExpanded}
                              title={!executionExpanded ? '请先展开查看内容再确认' : undefined}
                              className="text-[11px] px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {bulkApproving ? '执行中...' : '一键全部确认'}
                            </button>
                          </div>
                        ) : (
                          <span className="ml-auto text-[11px] text-gray-400">{group.length} 条</span>
                        )}
                      </div>
                      {/* 分组内动作列表（execution 组默认折叠） */}
                      {key === 'execution' && !executionExpanded ? null : (
                      <div className="divide-y">
                        {group.map((action) => {
                          const isRejectOpen = rejectPanel?.actionId === action.id
                          return (
                            <div key={action.id} className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs font-medium text-gray-700">
                                      {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
                                    </span>
                                    {action.actionPriority && action.actionPriority >= 4 && (
                                      <span className="text-xs text-red-500 font-medium">P{action.actionPriority} 紧急</span>
                                    )}
                                    {action.agentType && (
                                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                        {AGENT_LABELS[action.agentType] ?? action.agentType}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-700 font-medium truncate">
                                    {action.actionPayloadJson?.title ?? '—'}
                                  </p>
                                  {action.actionPayloadJson?.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                      {action.actionPayloadJson.description}
                                    </p>
                                  )}
                                  {action.actionPayloadJson?.draft && (
                                    <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1 line-clamp-2">
                                      {action.actionPayloadJson.draft}
                                    </p>
                                  )}
                                  {key === 'collaboration' && (
                                    <p className="text-[10px] text-blue-500 mt-1">💬 AI 已准备行动材料，由你执行</p>
                                  )}
                                </div>
                                {!isRejectOpen && (
                                  <div className="flex gap-1.5 flex-shrink-0">
                                    <button
                                      onClick={() => handleAction(action.id, 'approved', action.actionType)}
                                      disabled={approvingId === action.id}
                                      className="px-2.5 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                                    >
                                      通过
                                    </button>
                                    <button
                                      onClick={() => setRejectPanel({ actionId: action.id, actionType: action.actionType, comment: '', correction: '', feedbackType: '' })}
                                      disabled={approvingId === action.id}
                                      className="px-2.5 py-1 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50 disabled:opacity-50"
                                    >
                                      驳回
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* 驳回内联面板 */}
                              {isRejectOpen && rejectPanel && (
                                <div className="mt-3 pt-3 border-t border-red-100 bg-red-50/30 -mx-4 px-4 pb-3">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <Sparkles className="w-3.5 h-3.5 text-red-400" />
                                    <p className="text-xs font-medium text-red-600">驳回原因将沉淀为训练样本</p>
                                  </div>
                                  <textarea
                                    value={rejectPanel.comment}
                                    onChange={e => setRejectPanel(p => p ? { ...p, comment: e.target.value } : null)}
                                    placeholder="驳回原因（必填）..."
                                    className="w-full border rounded-lg px-3 py-2 text-xs h-14 resize-none mb-2"
                                    autoFocus
                                  />
                                  <textarea
                                    value={rejectPanel.correction}
                                    onChange={e => setRejectPanel(p => p ? { ...p, correction: e.target.value } : null)}
                                    placeholder="（可选）正确做法是什么？填写后升级为 modified 高价值样本..."
                                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-xs h-12 resize-none mb-2 bg-blue-50 placeholder-blue-300"
                                  />
                                  <select
                                    value={rejectPanel.feedbackType}
                                    onChange={e => setRejectPanel(p => p ? { ...p, feedbackType: e.target.value } : null)}
                                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs text-gray-500 mb-2 bg-white"
                                  >
                                    <option value="">AI 哪里不对？（可选）</option>
                                    <option value="direction_wrong">方向有误</option>
                                    <option value="focus_biased">重点偏了</option>
                                    <option value="info_insufficient">信息不足</option>
                                  </select>
                                  <div className="flex gap-2 justify-end">
                                    <button onClick={() => setRejectPanel(null)} className="px-3 py-1 border rounded text-xs text-gray-600 hover:bg-gray-50">取消</button>
                                    <button
                                      onClick={() => handleAction(action.id, 'rejected', action.actionType, rejectPanel.comment, rejectPanel.correction, rejectPanel.feedbackType || undefined)}
                                      disabled={!rejectPanel.comment.trim() || approvingId === action.id}
                                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                                    >
                                      确认驳回
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── 专项助手（折叠）── */}
            <div className="bg-white rounded-xl border">
              <button
                onClick={() => setShowSpecialists(v => !v)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">专项助手详情</span>
                  <span className="text-xs text-gray-400">销售 · 解决方案 · 招标 · 交付</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showSpecialists ? 'rotate-180' : ''}`} />
              </button>

              {showSpecialists && (
                <div className="border-t divide-y">
                  {SPECIALIST_GROUPS.map((group) => {
                    const Icon = group.icon
                    return (
                      <div key={group.role} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-6 h-6 rounded flex items-center justify-center ${group.bg}`}>
                            <Icon className={`w-3.5 h-3.5 ${group.color}`} />
                          </div>
                          <span className={`text-xs font-semibold ${group.color}`}>{group.role}</span>
                        </div>
                        {group.agents.map((agentType) => {
                          const threadData = threads.find(t => t.thread.agentType === agentType)
                          const thread = threadData?.thread
                          const run = threadData?.latestRun
                          const decisions = threadData?.decisions ?? []
                          const isRunning = runningAgent === agentType || thread?.threadStatus === 'running'

                          return (
                            <div key={agentType}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    isRunning ? 'bg-blue-400 animate-pulse' :
                                    thread?.threadStatus === 'idle' ? 'bg-green-400' :
                                    thread?.threadStatus === 'error' ? 'bg-red-400' : 'bg-gray-300'
                                  }`} />
                                  <span className="text-xs text-gray-600">
                                    {isRunning ? '运行中...' : thread?.lastActiveAt
                                      ? `上次运行 ${formatRelativeTime(thread.lastActiveAt)}`
                                      : '未运行'}
                                  </span>
                                </div>
                                <button
                                  onClick={() => runAgent(agentType)}
                                  disabled={!!runningAgent}
                                  className="flex items-center gap-1 px-2 py-0.5 border rounded text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                                >
                                  {isRunning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                  {isRunning ? '运行中' : run?.outputSummary ? '重新分析' : '启动分析'}
                                </button>
                              </div>

                              {run?.outputSummary && (
                                <p className="text-xs text-gray-600 bg-gray-50 rounded px-2.5 py-2 mb-1.5">
                                  {run.outputSummary}
                                </p>
                              )}
                              {!isRunning && (
                                <p className="text-[10px] text-gray-400 mb-1.5">
                                  {[
                                    pendingActions.filter(a => a.agentType === agentType).length > 0
                                      ? `${pendingActions.filter(a => a.agentType === agentType).length} 条待审`
                                      : null,
                                    completedActions.filter(a => a.agentType === agentType).length > 0
                                      ? `${completedActions.filter(a => a.agentType === agentType).length} 条已处理`
                                      : null,
                                  ].filter(Boolean).join(' · ') || (run?.outputSummary ? '' : '暂无产出')}
                                </p>
                              )}

                              {decisions.length > 0 && (
                                <div className="space-y-1">
                                  {decisions.slice(0, 3).map((d) => (
                                    <div key={d.id} className="flex items-start gap-1.5">
                                      <div className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${
                                        (d.severityLevel ?? 1) >= 4 ? 'bg-red-400' :
                                        (d.severityLevel ?? 1) >= 3 ? 'bg-yellow-400' : 'bg-blue-400'
                                      }`} />
                                      <p className="text-xs text-gray-600">
                                        <span className="font-medium">{d.decisionLabel}</span>
                                        {d.rationaleSummary && ` — ${d.rationaleSummary}`}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 本次产出物链接 */}
                              {run && (() => {
                                const runOutputs = completedActions.filter(a => a.agentType === agentType && a.actionStatus !== 'rejected')
                                const taskCount = runOutputs.filter(a => a.actionType === 'create_task').length
                                const draftCount = runOutputs.filter(a => a.actionType === 'send_draft').length
                                if (taskCount === 0 && draftCount === 0) return null
                                return (
                                  <div className="mt-1.5 flex flex-wrap gap-2">
                                    {taskCount > 0 && (
                                      <Link href="/tasks" className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded">
                                        本次产出：{taskCount} 个任务 →
                                      </Link>
                                    )}
                                    {draftCount > 0 && (
                                      <Link href="/drafts" className="inline-flex items-center gap-1 text-[10px] text-purple-600 hover:underline bg-purple-50 px-2 py-0.5 rounded">
                                        本次产出：{draftCount} 份草稿 →
                                      </Link>
                                    )}
                                  </div>
                                )
                              })()}

                              {/* 执行过程折叠区 */}
                              {run && (
                                <div className="mt-1.5">
                                  <button
                                    onClick={() => setExpandedRunDetail(expandedRunDetail === thread?.id ? null : (thread?.id ?? null))}
                                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"
                                  >
                                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedRunDetail === thread?.id ? 'rotate-180' : ''}`} />
                                    {expandedRunDetail === thread?.id ? '收起执行过程' : '查看执行过程'}
                                  </button>
                                  {expandedRunDetail === thread?.id && (
                                    <div className="mt-2 space-y-2.5 border-t pt-2">
                                      {/* A: 推理过程 */}
                                      {run.reasoningSummary && (
                                        <div>
                                          <p className="text-[10px] font-medium text-gray-500 mb-1">📋 推理过程</p>
                                          <p className="text-[11px] text-gray-600 border-l-2 border-gray-300 pl-2.5 py-1 bg-gray-50/60 rounded-r leading-relaxed">{run.reasoningSummary}</p>
                                        </div>
                                      )}
                                      {/* B: 执行步骤 */}
                                      {run.executionSteps.length > 0 && (
                                        <div>
                                          <p className="text-[10px] font-medium text-gray-500 mb-1">⚡ 执行步骤（{run.executionSteps.length} 项）</p>
                                          <div className="space-y-1">
                                            {run.executionSteps.map((step, i) => (
                                              <div key={i} className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${step.executionStatus === 'completed' ? 'bg-green-400' : 'bg-red-400'}`} />
                                                <span className="text-[10px] text-gray-600 font-medium flex-shrink-0">{ACTION_TYPE_LABELS[step.executorType] ?? step.executorType}</span>
                                                {!!(step.responsePayloadJson as Record<string, unknown>)?.title && (
                                                  <span className="text-[10px] text-gray-400 truncate">「{String((step.responsePayloadJson as Record<string, unknown>).title)}」</span>
                                                )}
                                                <span className={`text-[10px] flex-shrink-0 ${step.executionStatus === 'completed' ? 'text-green-600' : 'text-red-500'}`}>
                                                  {step.executionStatus === 'completed' ? '✓' : '✗'}
                                                </span>
                                                {step.executedAt && <span className="text-[10px] text-gray-300 ml-auto flex-shrink-0">{formatRelativeTime(step.executedAt)}</span>}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {/* C: 输入来源 */}
                                      {run.inputContextSummary && (
                                        <div className="flex flex-wrap gap-1.5">
                                          <span className="text-[10px] text-gray-400">📥 本次输入：</span>
                                          {run.inputContextSummary.signalCount > 0 && (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{run.inputContextSummary.signalCount} 条信号</span>
                                          )}
                                          {run.inputContextSummary.assetCount > 0 && (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">注入 {run.inputContextSummary.assetCount} 份资产</span>
                                          )}
                                          {run.inputContextSummary.hasMemory && (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">历史记忆</span>
                                          )}
                                          {run.inputContextSummary.crossAgentSummary && (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">参考了 {run.inputContextSummary.crossAgentSummary}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 本阶段已处理 */}
            {completedActions.length > 0 && (
              <div className="bg-white rounded-xl border">
                <button
                  onClick={() => setCompletedExpanded(v => !v)}
                  className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50"
                >
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600">本阶段已处理 {completedActions.length} 项</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-auto transition-transform ${completedExpanded ? 'rotate-180' : ''}`} />
                </button>
                {completedExpanded && (
                  <div className="border-t divide-y">
                    {completedActions.map(action => (
                      <div key={action.id} className="px-4 py-2 flex items-center gap-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${action.actionStatus === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                          {action.actionStatus === 'rejected' ? '已驳回' : '已完成'}
                        </span>
                        <span className="text-xs text-gray-500 flex-1 truncate">
                          {(action.actionPayloadJson as { title?: string } | null)?.title ?? ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
                        </span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(action.updatedAt)}</span>
                        {action.actionType === 'create_task' && action.actionStatus !== 'rejected' && (
                          <Link href="/tasks" className="text-[10px] text-blue-600 hover:underline flex-shrink-0">查看任务 →</Link>
                        )}
                        {action.actionType === 'send_draft' && action.actionStatus !== 'rejected' && (
                          <Link href="/drafts" className="text-[10px] text-blue-600 hover:underline flex-shrink-0">查看草稿 →</Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>{/* end Tab1 inner p-4 */}
            </div>{/* end Tab1 space-y-4 */}

            {/* ── Tab: 成果物 ── */}
            <div className="flex items-center gap-2 px-1 mb-1 mt-4">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">成果物</span>
            </div>
            <div className="">
              <div className="bg-white border border-t-0 rounded-b-xl">
                {deliverablesList.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <PackageOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">暂无成果物</p>
                    <p className="text-xs text-gray-300 mt-1">AI 生成方案PPT、效果图、标书草稿等后会出现在这里</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {deliverablesList.map(d => {
                      const typeLabels: Record<string, string> = {
                        solution_ppt: '方案PPT', scene_render: '场地效果图', layout_plan: '场地平面图',
                        safety_proposal: '安全培训方案', requirement_summary: '需求摘要',
                        bid_package: '投标文件', bid_prelim: '标前立项', contract_review: '合同审查意见',
                        handover_package: '交接包', acceptance_doc: '验收文件', after_sales_report: '售后报告',
                        quotation: '报价单', other: '其他',
                      }
                      const statusConfig: Record<string, { label: string; cls: string }> = {
                        drafting: { label: '草稿中', cls: 'bg-gray-100 text-gray-500' },
                        pending_review: { label: '待审核', cls: 'bg-amber-50 text-amber-600' },
                        approved: { label: '已批准', cls: 'bg-green-50 text-green-600' },
                        sent: { label: '已发送', cls: 'bg-blue-50 text-blue-600' },
                        archived: { label: '已归档', cls: 'bg-gray-50 text-gray-400' },
                      }
                      const st = statusConfig[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-500' }
                      const isExpanded = expandedDeliverable === d.id
                      return (
                        <div key={d.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">
                                  {typeLabels[d.type] ?? d.type}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.cls}`}>
                                  {st.label}
                                </span>
                                {d.version > 1 && (
                                  <span className="text-[10px] text-gray-400">v{d.version}</span>
                                )}
                                {d.stage && (
                                  <span className="text-[10px] text-gray-400">· {d.stage}</span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                              {d.audience && (
                                <p className="text-xs text-gray-400 mt-0.5">受众：{d.audience}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {d.content && (
                                <button
                                  onClick={() => setExpandedDeliverable(isExpanded ? null : d.id)}
                                  className="text-[10px] text-blue-600 hover:underline"
                                >
                                  {isExpanded ? '收起' : '预览'}
                                </button>
                              )}
                              {(d.status === 'drafting' || d.status === 'pending_review') && (
                                <button
                                  onClick={async () => {
                                    await fetch('/api/deliverables', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ deliverableId: d.id, action: 'approve' }),
                                    })
                                    showToast(`${d.title} 已批准`)
                                    load()
                                  }}
                                  className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100 border border-green-200"
                                >
                                  批准
                                </button>
                              )}
                              {d.status === 'approved' && (
                                <button
                                  onClick={async () => {
                                    await fetch('/api/deliverables', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ deliverableId: d.id, action: 'mark_sent' }),
                                    })
                                    showToast(`${d.title} 已标记为发送`)
                                    load()
                                  }}
                                  className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200"
                                >
                                  标记发送
                                </button>
                              )}
                              {/* 生成真实文件按钮：已批准且无 fileUrl 时显示 */}
                              {d.status === 'approved' && !d.fileUrl && generatingFile[d.id] !== 'done' && (
                                <button
                                  disabled={generatingFile[d.id] === 'generating'}
                                  onClick={async () => {
                                    setGeneratingFile(prev => ({ ...prev, [d.id]: 'generating' }))
                                    try {
                                      await fetch('/api/deliverables', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ deliverableId: d.id, action: 'trigger_rpa' }),
                                      })
                                      // 每 3 秒轮询，等 fileUrl 写回
                                      const poll = setInterval(async () => {
                                        const res = await fetch(`/api/deliverables?workspaceId=${id}`)
                                        const data = await res.json() as { deliverables: Deliverable[] }
                                        const updated = data.deliverables.find((x: Deliverable) => x.id === d.id)
                                        if (updated?.fileUrl) {
                                          clearInterval(poll)
                                          setGeneratingFile(prev => ({ ...prev, [d.id]: 'done' }))
                                          setDeliverablesList(data.deliverables)
                                          showToast(`✅ 文件已生成，点击下载`)
                                        }
                                      }, 3000)
                                      // 超时保护：60 秒后停止轮询
                                      setTimeout(() => clearInterval(poll), 60000)
                                    } catch {
                                      setGeneratingFile(prev => { const n = {...prev}; delete n[d.id]; return n })
                                    }
                                  }}
                                  className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 border border-purple-200 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {generatingFile[d.id] === 'generating' ? (
                                    <><span className="inline-block w-2.5 h-2.5 border border-purple-400 border-t-transparent rounded-full animate-spin" />生成中…</>
                                  ) : '生成文件'}
                                </button>
                              )}
                              {/* 已有文件 URL：显示下载链接 */}
                              {d.fileUrl && (
                                <a
                                  href={d.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded hover:bg-green-100 border border-green-300 font-medium"
                                >
                                  ↓ 下载文件
                                </a>
                              )}
                              <button
                                onClick={() => {
                                  setDeliverableRejectId(d.id)
                                  setDeliverableRejectNote('')
                                }}
                                className="text-[10px] px-2 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100 border border-red-200"
                              >
                                退回
                              </button>
                            </div>
                          </div>
                          {/* 退回 / 重新生成面板 */}
                          {deliverableRejectId === d.id && (
                            <div className="mt-2 pt-2 border-t border-red-100 bg-red-50/40 rounded-lg px-3 pb-3">
                              <p className="text-[10px] font-medium text-red-600 mb-1.5 flex items-center gap-1">
                                <span>✕</span> 修改意见（越具体数字员工改得越准）
                              </p>
                              <textarea
                                value={deliverableRejectNote}
                                onChange={e => setDeliverableRejectNote(e.target.value)}
                                placeholder="例：第5页行业案例太空洞，改成中石化炼化工程的真实部署数据，包含培训人数和事故下降率…"
                                className="w-full border border-red-200 rounded px-2.5 py-1.5 text-xs h-16 resize-none mb-2 bg-white"
                                autoFocus
                              />
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => setDeliverableRejectId(null)}
                                  className="px-2.5 py-1 border rounded text-xs text-gray-500 hover:bg-gray-50"
                                >
                                  取消
                                </button>
                                <button
                                  onClick={async () => {
                                    await fetch('/api/deliverables', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        deliverableId: d.id,
                                        action: 'reject',
                                        reviewNote: deliverableRejectNote,
                                      }),
                                    })
                                    showToast(`已退回「${d.title}」，修改意见已写入训练样本`)
                                    setDeliverableRejectId(null)
                                    load()
                                  }}
                                  className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded text-xs hover:bg-red-200"
                                >
                                  仅退回
                                </button>
                                <button
                                  disabled={!deliverableRejectNote.trim() || regeneratingId === d.id}
                                  onClick={async () => {
                                    if (!deliverableRejectNote.trim()) return
                                    setRegeneratingId(d.id)
                                    try {
                                      const res = await fetch('/api/deliverables', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          deliverableId: d.id,
                                          action: 'reject_and_regenerate',
                                          reviewNote: deliverableRejectNote,
                                        }),
                                      })
                                      const json = await res.json() as { success?: boolean; newDeliverableId?: string; error?: string }
                                      if (json.success) {
                                        showToast('数字员工正在按意见修改，新版已生成，请审批')
                                        setDeliverableRejectId(null)
                                        load()
                                      } else {
                                        showToast(`重新生成失败：${json.error}`)
                                      }
                                    } finally {
                                      setRegeneratingId(null)
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {regeneratingId === d.id ? (
                                    <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" /> 生成中…</>
                                  ) : '↻ 按意见重新生成'}
                                </button>
                              </div>
                            </div>
                          )}
                          {/* 内容预览 */}
                          {isExpanded && d.content && (
                            <div className="mt-3 bg-gray-50 rounded-lg p-3">
                              {(() => {
                                // 尝试解析 slides JSON
                                try {
                                  const parsed = JSON.parse(d.content)
                                  if (parsed?.slides && Array.isArray(parsed.slides)) {
                                    return (
                                      <div className="space-y-2">
                                        <p className="text-xs font-semibold text-gray-600 mb-2">{parsed.title ?? d.title}</p>
                                        {(parsed.slides as Array<{ page: number; title: string; bullets: string[]; notes?: string }>).map((slide) => (
                                          <div key={slide.page} className="bg-white rounded border px-3 py-2">
                                            <p className="text-xs font-medium text-gray-700 mb-1">P{slide.page}. {slide.title}</p>
                                            <ul className="space-y-0.5">
                                              {slide.bullets.map((b, i) => (
                                                <li key={i} className="text-[11px] text-gray-500 flex items-start gap-1.5">
                                                  <span className="text-blue-400 flex-shrink-0">·</span>{b}
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  }
                                } catch { /* not JSON, show as text */ }
                                return (
                                  <pre className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                                    {d.content}
                                  </pre>
                                )
                              })()}
                            </div>
                          )}
                          {/* 聊天式修改指令（所有状态都可用） */}
                          {instructionOpen === d.id ? (
                            <div className="mt-2 pt-2 border-t border-indigo-100 bg-indigo-50/30 rounded-lg px-3 pb-3">
                              <p className="text-[10px] font-medium text-indigo-600 mb-1.5">发送修改指令给数字员工</p>
                              <textarea
                                value={instructionText[d.id] ?? ''}
                                onChange={e => setInstructionText(prev => ({ ...prev, [d.id]: e.target.value }))}
                                placeholder="例：帮我把第3页技术架构加上WebGL渲染引擎和离线部署方案的内容；或：整体语气改得更简洁，减少形容词"
                                className="w-full border border-indigo-200 rounded px-2.5 py-1.5 text-xs h-16 resize-none mb-2 bg-white"
                                autoFocus
                              />
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => setInstructionOpen(null)}
                                  className="px-2.5 py-1 border rounded text-xs text-gray-500 hover:bg-gray-50"
                                >
                                  取消
                                </button>
                                <button
                                  disabled={!(instructionText[d.id] ?? '').trim() || sendingInstruction === d.id}
                                  onClick={async () => {
                                    const note = (instructionText[d.id] ?? '').trim()
                                    if (!note) return
                                    setSendingInstruction(d.id)
                                    try {
                                      const res = await fetch('/api/deliverables', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          deliverableId: d.id,
                                          action: 'reject_and_regenerate',
                                          reviewNote: note,
                                        }),
                                      })
                                      const json = await res.json() as { success?: boolean; newDeliverableId?: string; error?: string }
                                      if (json.success) {
                                        showToast('数字员工已收到指令，正在修改中，新版即将出现')
                                        setInstructionOpen(null)
                                        setInstructionText(prev => { const n = { ...prev }; delete n[d.id]; return n })
                                        load()
                                      } else {
                                        showToast(`指令发送失败：${json.error}`)
                                      }
                                    } finally {
                                      setSendingInstruction(null)
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {sendingInstruction === d.id ? (
                                    <><span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" /> 发送中…</>
                                  ) : '发送给数字员工 →'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setInstructionOpen(d.id)}
                              className="mt-1.5 text-[10px] text-indigo-400 hover:text-indigo-600 flex items-center gap-0.5"
                            >
                              <span>✎</span> 发修改指令给数字员工
                            </button>
                          )}
                          <p className="text-[10px] text-gray-300 mt-1.5">{formatRelativeTime(d.createdAt)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Tab 2: 待你决策 ── */}
            <div className="flex items-center gap-2 px-1 mb-1 mt-4" id="section-decisions">
              <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-800">需要你决策</span>
              {pendingActions.length > 0 && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">{pendingActions.length} 件</span>
              )}
            </div>
            <div className="">
              <div className="bg-white border border-t-0 rounded-b-xl">
                {pendingActions.length === 0 ? (
                  <div className="px-4 py-10 text-center text-gray-400 text-sm">暂无待审批动作 · AI 正在持续监控，有新判断会自动出现</div>
                ) : (
                  <div className="divide-y">
                    {['authorization', 'execution', 'collaboration'].map(cat => {
                      const items = pendingActions.filter(a => a.executorCategory === cat)
                      if (!items.length) return null
                      const catLabel = cat === 'authorization' ? '授权类' : cat === 'execution' ? '执行类' : '协作类'
                      const catColor = cat === 'authorization' ? 'text-red-600 bg-red-50' : cat === 'execution' ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'
                      return (
                        <div key={cat}>
                          <div className="px-4 py-2 bg-gray-50 border-b">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${catColor}`}>{catLabel} {items.length}件</span>
                          </div>
                          {items.map(action => {
                            const isApproving = approvingId === action.id
                            const modifyOpen = modifyOpenId === action.id
                            const rejectOpen = rejectOpenId === action.id
                            const payload = action.actionPayloadJson as { title?: string; description?: string; draft?: string } | null
                            return (
                              <div key={action.id} className="px-4 py-3 border-b last:border-0">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div>
                                    <p className="text-sm font-medium text-gray-800">{payload?.title ?? ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}</p>
                                    {payload?.description && <p className="text-xs text-gray-500 mt-0.5">{payload.description}</p>}
                                    {payload?.draft && (
                                      <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mt-1.5 line-clamp-2">{payload.draft}</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeTime(action.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => approveAction(action.id)}
                                    disabled={isApproving}
                                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {isApproving ? '处理中…' : '通过'}
                                  </button>
                                  <button
                                    onClick={() => { setModifyOpenId(modifyOpen ? null : action.id); setRejectOpenId(null) }}
                                    className={`px-3 py-1 rounded text-xs border ${modifyOpen ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                  >
                                    改后通过
                                  </button>
                                  <button
                                    onClick={() => { setRejectOpenId(rejectOpen ? null : action.id); setModifyOpenId(null) }}
                                    className={`px-3 py-1 rounded text-xs border ${rejectOpen ? 'bg-red-50 border-red-300 text-red-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                                  >
                                    驳回
                                  </button>
                                </div>
                                {modifyOpen && (
                                  <div className="mt-2 bg-blue-50 rounded-lg p-3 space-y-2">
                                    <textarea
                                      value={modifyText[action.id] ?? ''}
                                      onChange={e => setModifyText(p => ({ ...p, [action.id]: e.target.value }))}
                                      placeholder="请输入修改后的内容（必填）"
                                      rows={2}
                                      className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                                    />
                                    <button
                                      onClick={() => approveAction(action.id, modifyText[action.id] ?? '')}
                                      disabled={!modifyText[action.id]?.trim() || isApproving}
                                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      记录并通过
                                    </button>
                                  </div>
                                )}
                                {rejectOpen && (
                                  <div className="mt-2 bg-red-50 rounded-lg p-3 space-y-2">
                                    <textarea
                                      value={rejectText[action.id] ?? ''}
                                      onChange={e => setRejectText(p => ({ ...p, [action.id]: e.target.value }))}
                                      placeholder="请输入驳回原因（必填）"
                                      rows={2}
                                      className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                                    />
                                    <button
                                      onClick={() => rejectAction(action.id, rejectText[action.id] ?? '')}
                                      disabled={!rejectText[action.id]?.trim() || isApproving}
                                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                                    >
                                      确认驳回
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Tab 3: 草稿与任务 ── */}
            <div className="">
              <div className="bg-white border border-t-0 rounded-b-xl px-4 py-6 space-y-3">
                <Link href={`/drafts?workspaceId=${id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">草稿中心</span>
                    <span className="text-xs text-gray-400">AI 生成的对外草稿，待审阅后发送</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
                <Link href={`/tasks?workspaceId=${id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium">任务中心</span>
                    <span className="text-xs text-gray-400">AI 生成的待跟进任务，可分配执行</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              </div>
            </div>

            {/* ── Tab 4: 信号流 ── */}
            <div className="">
              <div className="bg-white border border-t-0 rounded-b-xl">
                {!recentSignals || recentSignals.length === 0 ? (
                  <div className="px-4 py-10 text-center text-gray-400 text-sm">暂无关联信号 · 信号录入后会自动绑定并出现在这里</div>
                ) : (
                  <div className="divide-y">
                    {recentSignals.map(signal => (
                      <div key={signal.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(signal.priority ?? 3) >= 4 ? 'bg-red-400' : (signal.priority ?? 3) >= 3 ? 'bg-amber-400' : 'bg-gray-300'}`} />
                          {signal.signalType && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{signal.signalType}</span>
                          )}
                          <span className="text-[10px] text-gray-400">{formatRelativeTime(signal.eventTime)}</span>
                          {signal.sourceType && (
                            <span className="text-[10px] text-gray-300">· {SIGNAL_SOURCE_LABELS[signal.sourceType] ?? signal.sourceType}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-700">{signal.contentSummary ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>{/* end col-span-2 */}

          {/* ── 右侧面板（1列）── */}
          <div className="space-y-4">
            {/* 甲方画像卡片 */}
            {customer && (
              <div className="bg-white rounded-xl border px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">甲方画像</span>
                    <span className="text-xs text-gray-400">{customer.name}</span>
                  </div>
                  <button
                    onClick={() => { setProfileDrawer('customer'); setProfileDraft(customer.profileJson ?? {}) }}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                  >
                    <Edit2 className="w-3 h-3" />编辑
                  </button>
                </div>
                {customer.profileJson && Object.keys(customer.profileJson).length > 0 ? (
                  <div className="space-y-1">
                    {(customer.profileJson as any).basicInfo && (
                      <p className="text-xs text-gray-600">
                        {[(customer.profileJson as any).basicInfo.ownership, (customer.profileJson as any).basicInfo.scale].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {(customer.profileJson as any).decisionChain?.keyPerson && (
                      <p className="text-xs text-gray-500">决策人：{(customer.profileJson as any).decisionChain.keyPerson}</p>
                    )}
                    {(customer.profileJson as any).riskTags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {((customer.profileJson as any).riskTags as string[]).slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { setProfileDrawer('customer'); setProfileDraft(customer.profileJson ?? {}) }}
                    className="w-full border border-dashed border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-400 hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    补充甲方画像
                  </button>
                )}
              </div>
            )}

            {/* 渠道商画像卡片 */}
            {(channelPartner || data?.opportunity) && (
              <div className="bg-white rounded-xl border px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Handshake className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">渠道商画像</span>
                    <span className="text-xs text-gray-400">
                      {channelPartner?.name ?? (opportunity as any)?.channelPartner ?? '直销'}
                    </span>
                  </div>
                  {channelPartner && (
                    <button
                      onClick={() => { setProfileDrawer('channel'); setProfileDraft(channelPartner.profileJson ?? {}) }}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      <Edit2 className="w-3 h-3" />编辑
                    </button>
                  )}
                </div>
                {channelPartner?.profileJson && Object.keys(channelPartner.profileJson).length > 0 ? (
                  <div className="space-y-1">
                    {(channelPartner.profileJson as any).capability && (
                      <p className="text-xs text-gray-600">
                        {[(channelPartner.profileJson as any).capability.industries?.join('/')].filter(Boolean).join(' · ')}
                        {(channelPartner.profileJson as any).capability.regions && (
                          <> · {(channelPartner.profileJson as any).capability.regions.join('/')}</>
                        )}
                      </p>
                    )}
                    {(channelPartner.profileJson as any).relationship?.clientDepth && (
                      <p className="text-xs text-gray-500">客户关系：{(channelPartner.profileJson as any).relationship.clientDepth}</p>
                    )}
                    {(channelPartner.profileJson as any).riskTags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {((channelPartner.profileJson as any).riskTags as string[]).slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    {channelPartner ? (
                      <button
                        onClick={() => { setProfileDrawer('channel'); setProfileDraft(channelPartner.profileJson ?? {}) }}
                        className="w-full border border-dashed border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-400 hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        补充渠道商画像
                      </button>
                    ) : '直销（无渠道商）'}
                  </p>
                )}
              </div>
            )}
            {/* 风险台账（结构化） */}
            {risksList.filter(r => r.status !== 'closed').length > 0 ? (
              <div className="bg-white rounded-xl border">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">风险台账</span>
                  <span className="text-xs text-red-100 bg-red-500 px-1.5 py-0.5 rounded-full ml-auto font-medium">
                    {risksList.filter(r => r.status !== 'closed').length}
                  </span>
                </div>
                <div className="divide-y">
                  {risksList.filter(r => r.status !== 'closed').slice(0, 5).map(r => {
                    const levelConfig: Record<string, { dot: string; bg: string }> = {
                      critical: { dot: 'bg-red-600', bg: 'bg-red-50' },
                      high:     { dot: 'bg-red-400', bg: 'bg-red-50' },
                      medium:   { dot: 'bg-amber-400', bg: 'bg-amber-50' },
                      low:      { dot: 'bg-gray-300', bg: 'bg-gray-50' },
                    }
                    const catLabels: Record<string, string> = {
                      requirement_unclear: '需求不清', competitor: '竞品', decision_chain: '决策链',
                      budget: '预算', compliance: '合规', bid_qualification: '投标资格',
                      pricing_margin: '报价毛利', contract_terms: '合同', delivery_scope: '交付',
                      customer_health: '客户健康',
                    }
                    const lc = levelConfig[r.riskLevel] ?? { dot: 'bg-gray-300', bg: 'bg-gray-50' }
                    return (
                      <div key={r.id} className={`px-4 py-2.5 ${lc.bg}`}>
                        <div className="flex items-start gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${lc.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className="text-[10px] bg-white border border-gray-200 text-gray-500 px-1 py-0.5 rounded">
                                {catLabels[r.riskCategory] ?? r.riskCategory}
                              </span>
                              {r.status === 'detected' && (
                                <span className="text-[10px] text-amber-600">待确认</span>
                              )}
                              {r.status === 'escalated' && (
                                <span className="text-[10px] text-red-600 font-medium">已升级</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 font-medium leading-tight">{r.title}</p>
                            {r.recommendedAction && (
                              <p className="text-[10px] text-gray-500 mt-0.5">建议：{r.recommendedAction}</p>
                            )}
                          </div>
                          {r.status === 'detected' && (
                            <button
                              onClick={async () => {
                                setAckingRisk(r.id)
                                await fetch('/api/risks', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ riskId: r.id, action: 'acknowledge' }),
                                })
                                setAckingRisk(null)
                                load()
                              }}
                              disabled={ackingRisk === r.id}
                              className="text-[10px] text-blue-600 hover:underline flex-shrink-0 disabled:opacity-40"
                            >
                              确认
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : lastSnapshot?.riskSummary ? (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">风险摘要</span>
                </div>
                <p className="text-xs text-amber-800">{lastSnapshot.riskSummary}</p>
              </div>
            ) : null}

            {/* 下一步行动建议（从快照取） */}
            {lastSnapshot?.nextActionsJson && Array.isArray(lastSnapshot.nextActionsJson) && lastSnapshot.nextActionsJson.length > 0 && (
              <div className="bg-white rounded-xl border">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">下一步行动</span>
                  <span className="text-xs text-gray-400 ml-auto">{(lastSnapshot.nextActionsJson as unknown[]).length} 项</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {(lastSnapshot.nextActionsJson as string[]).map((action, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-xs text-blue-500 font-bold mt-0.5 flex-shrink-0">{i + 1}</span>
                      <p className="text-xs text-gray-700">{action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 客户近期动态 */}
            <div className="bg-white rounded-xl border">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">客户近期动态</span>
                {recentSignals && recentSignals.length > 0 && (
                  <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full ml-1">{recentSignals.length}</span>
                )}
              </div>
              {recentSignals && recentSignals.length > 0 ? (
                <div className="divide-y">
                  {recentSignals.slice(0, 3).map(signal => (
                    <div key={signal.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(signal.priority ?? 3) >= 4 ? 'bg-red-400' : (signal.priority ?? 3) >= 3 ? 'bg-amber-400' : 'bg-gray-300'}`} />
                        <span className="text-[10px] text-gray-400">{formatRelativeTime(signal.eventTime)}</span>
                        {signal.sourceType && (
                          <span className="text-[10px] text-gray-300">· {SIGNAL_SOURCE_LABELS[signal.sourceType] ?? signal.sourceType}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{signal.contentSummary ?? '—'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 px-4 py-3 flex items-center gap-1">
                  <Clock className="w-3 h-3" />暂无关联信号
                </p>
              )}
            </div>
          </div>{/* end right panel */}
        </div>{/* end grid */}
      </div>{/* end flex-1 overflow-auto */}

      {/* 画像编辑抽屉 */}
      {profileDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setProfileDrawer(null)} />
          <div className="w-96 bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                {profileDrawer === 'customer'
                  ? <Building2 className="w-4 h-4 text-gray-500" />
                  : <Handshake className="w-4 h-4 text-gray-500" />}
                <h2 className="text-sm font-semibold">
                  {profileDrawer === 'customer' ? `甲方画像 · ${customer?.name}` : `渠道商画像 · ${channelPartner?.name}`}
                </h2>
              </div>
              <button onClick={() => setProfileDrawer(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
              {profileDrawer === 'customer' ? (
                <>
                  <ProfileSection title="基本信息" fields={[
                    { key: 'basicInfo.ownership', label: '性质', placeholder: '如：央企/国企/民企' },
                    { key: 'basicInfo.scale', label: '规模', placeholder: '如：大型/中型' },
                    { key: 'basicInfo.employeeCount', label: '员工数', placeholder: '如：5000+' },
                    { key: 'basicInfo.annualRevenue', label: '营收', placeholder: '如：百亿级' },
                  ]} draft={profileDraft} onChange={setProfileDraft} />
                  <ProfileSection title="决策链" fields={[
                    { key: 'decisionChain.keyPerson', label: '关键人', placeholder: '如：安全部主任 张XX' },
                    { key: 'decisionChain.procurementProcess', label: '采购方式', placeholder: '如：招投标/直采' },
                    { key: 'decisionChain.budgetCycle', label: '预算周期', placeholder: '如：每年Q4确定预算' },
                  ]} draft={profileDraft} onChange={setProfileDraft} />
                  <ProfileSection title="需求与痛点" fields={[
                    { key: 'needs.painPoints', label: '痛点', placeholder: '如：工伤事故多，监管压力大' },
                    { key: 'needs.existingEquipment', label: '现有设备', placeholder: '如：传统视频培训，无VR' },
                  ]} draft={profileDraft} onChange={setProfileDraft} />
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">风险标签（逗号分隔）</label>
                    <input
                      value={((profileDraft as any).riskTags ?? []).join('、')}
                      onChange={(e) => setProfileDraft(p => ({ ...p, riskTags: e.target.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean) }))}
                      placeholder="如：决策周期长、价格敏感"
                      className="w-full border rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                </>
              ) : (
                <>
                  <ProfileSection title="基本信息" fields={[
                    { key: 'basicInfo.scale', label: '规模', placeholder: '如：中小型' },
                    { key: 'basicInfo.teamSize', label: '团队规模', placeholder: '如：20人' },
                  ]} draft={profileDraft} onChange={setProfileDraft} />
                  <ProfileSection title="能力与覆盖" fields={[
                    { key: 'capability.techCapability', label: '技术能力', placeholder: '如：弱，依赖厂商支持' },
                    { key: 'workStyle', label: '合作风格', placeholder: '如：主动推进，需要厂商提供完整方案' },
                  ]} draft={profileDraft} onChange={setProfileDraft} />
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">覆盖行业（逗号分隔）</label>
                    <input
                      value={((profileDraft as any).capability?.industries ?? []).join('、')}
                      onChange={(e) => setProfileDraft(p => ({ ...p, capability: { ...((p as any).capability ?? {}), industries: e.target.value.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean) } }))}
                      placeholder="如：煤炭、电力"
                      className="w-full border rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                  <ProfileSection title="合作记录" fields={[
                    { key: 'cooperation.paymentRecord', label: '回款记录', placeholder: '如：良好/回款慢' },
                  ]} draft={profileDraft} onChange={setProfileDraft} />
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">风险标签（逗号分隔）</label>
                    <input
                      value={((profileDraft as any).riskTags ?? []).join('、')}
                      onChange={(e) => setProfileDraft(p => ({ ...p, riskTags: e.target.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean) }))}
                      placeholder="如：回款慢、多家厂商合作"
                      className="w-full border rounded-lg px-3 py-2 text-xs"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-4 border-t flex gap-2 justify-end">
              <button onClick={() => setProfileDrawer(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button
                onClick={async () => {
                  if (profileDrawer === 'customer' && customer) {
                    await fetch(`/api/customers/${customer.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ profileJson: profileDraft }),
                    })
                  } else if (profileDrawer === 'channel' && channelPartner) {
                    await fetch(`/api/channel-partners/${channelPartner.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ profileJson: profileDraft }),
                    })
                  }
                  setProfileDrawer(null)
                  load()
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 阶段推进确认弹窗 */}
      {showStageConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold mb-2">推进阶段确认</h2>
            <p className="text-sm text-gray-600 mb-1">
              当前阶段：<span className="font-medium text-gray-800">{currentStage}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              推进到：<span className="font-medium text-blue-600">{showStageConfirm}</span>
            </p>
            <p className="text-xs text-gray-400 mb-5">阶段推进后，销售总控 Agent 将自动重新分析并安排对应专项助手。</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowStageConfirm(null)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => { handleStageChange(showStageConfirm); setShowStageConfirm(null) }}
                disabled={changingStage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {changingStage ? '推进中...' : '确认推进'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 赢单/输单弹窗 */}
      {closeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">
                {closeModal === 'won' ? '🏆 标记赢单' : '❌ 标记输单'}
              </h2>
              <button onClick={() => setCloseModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            {closeModal === 'lost' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">输单原因 <span className="text-red-500">*</span></label>
                  <select
                    value={lostReason}
                    onChange={e => setLostReason(e.target.value)}
                    className="w-full border rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择输单原因</option>
                    <option value="price">价格竞争因素（低价竞标）</option>
                    <option value="control">控标力不足（未影响采购条件）</option>
                    <option value="solution">方案竞争力不足（功能/案例弱于竞品）</option>
                    <option value="document">投标文件内部失误（错误/遗漏）</option>
                    <option value="risk">销售未预判关键风险（突发变局）</option>
                    <option value="relationship">客户关系不足（决策层未建立信任）</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">补充说明（可选）</label>
                  <textarea
                    value={lostNote}
                    onChange={e => setLostNote(e.target.value)}
                    placeholder="输单的具体情况、可改进的地方..."
                    rows={3}
                    className="w-full border rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            )}
            {closeModal === 'won' && (
              <p className="text-sm text-gray-600 mb-4">确认将此商机标记为赢单并关闭？</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCloseModal(null)} className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={() => handleCloseDeal(closeModal!)}
                disabled={closingDeal || (closeModal === 'lost' && !lostReason)}
                className={`px-4 py-1.5 rounded text-sm text-white disabled:opacity-50 ${
                  closeModal === 'won' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {closingDeal ? '处理中...' : closeModal === 'won' ? '确认赢单' : '确认输单'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 阶段复盘弹窗 */}
      {stageReview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-base font-semibold mb-1">阶段复盘</h2>
            <p className="text-xs text-gray-400 mb-4">
              {stageReview.fromStage} → {stageReview.toStage} · AI 的判断质量如何？
              <span className="text-gray-300 ml-1">（可跳过）</span>
            </p>
            <div className="space-y-3 mb-5">
              {coordinatorDecisions.slice(0, 5).map(d => {
                const r = stageReview.reviews[d.id]
                return (
                  <div key={d.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-medium text-gray-800 mb-1.5">{d.decisionLabel}</p>
                    <div className="flex gap-1.5">
                      {[
                        { key: 'correct', label: '✓ 准确', cls: 'bg-green-50 text-green-700 border-green-200' },
                        { key: 'biased',  label: '~ 偏了',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                        { key: 'wrong',   label: '✗ 判断错', cls: 'bg-red-50 text-red-700 border-red-200' },
                      ].map(opt => (
                        <button key={opt.key}
                          onClick={() => setStageReview(p => p ? { ...p, reviews: { ...p.reviews, [d.id]: { quality: opt.key, note: r?.note ?? '' } } } : null)}
                          className={`px-2 py-0.5 text-[11px] rounded border ${r?.quality === opt.key ? opt.cls : 'bg-white text-gray-400 border-gray-200'}`}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setStageReview(null)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">跳过</button>
              <button
                onClick={async () => {
                  await fetch(`/api/workspaces/${id}/stage-review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(stageReview),
                  })
                  setStageReview(null)
                  showToast('复盘已记录为训练数据 ✓')
                }}
                disabled={Object.keys(stageReview.reviews).length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
              >提交复盘</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
