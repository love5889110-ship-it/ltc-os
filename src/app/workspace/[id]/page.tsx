'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot, AlertTriangle, CheckCircle, Clock, Play, RefreshCw,
  ChevronRight, ChevronDown, Zap, FileText, TrendingUp, Radio, GitBranch, Lightbulb, Trophy, XCircle, X
} from 'lucide-react'
import { AGENT_LABELS, ACTION_TYPE_LABELS, SIGNAL_TYPE_LABELS, statusColor, signalTypeColor, formatRelativeTime, healthScoreColor } from '@/lib/utils'

const STAGES = ['需求挖掘', '方案设计', '招投标', '商务谈判', '合同签订', '交付', '售后']

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
  customer: { id: string; name: string; industry: string | null } | null
  threads: Array<{
    thread: { id: string; agentType: string; threadStatus: string; lastActiveAt: string | null }
    latestRun: { id: string; reasoningSummary: string | null; outputSummary: string | null; runStatus: string; startedAt: string } | null
    decisions: Array<{ id: string; decisionType: string; decisionLabel: string; severityLevel: number | null; rationaleSummary: string | null }>
  }>
  pendingActions: Array<{
    id: string
    actionType: string
    actionStatus: string
    actionPriority: number | null
    actionPayloadJson: { title?: string; description?: string; draft?: string } | null
    createdAt: string | null
  }>
  lastSnapshot: { stage: string | null; healthScore: number | null; riskSummary: string | null; nextActionsJson: unknown[] } | null
  recentSignals: Array<{
    id: string
    signalType: string | null
    contentSummary: string | null
    priority: number | null
    eventTime: string | null
    status: string
  }>
}

interface Toast {
  id: string
  message: string
  link?: { label: string; href: string }
}

interface SignalDetail {
  rawContent: string | null
  normalizedContent: string | null
  parsedEntitiesJson: Record<string, unknown>
  signalType: string | null
  confidenceScore: number | null
}

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<WorkspaceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningAgent, setRunningAgent] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [runningAll, setRunningAll] = useState(false)
  const [changingStage, setChangingStage] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null)
  const [signalDetails, setSignalDetails] = useState<Record<string, SignalDetail>>({})
  const [closingDeal, setClosingDeal] = useState(false)
  const [closeModal, setCloseModal] = useState<'won' | 'lost' | null>(null)
  const [lostReason, setLostReason] = useState('')
  const [lostNote, setLostNote] = useState('')
  // Decision feedback state
  const [decisionFeedback, setDecisionFeedback] = useState<Record<string, 'correct' | 'wrong'>>({})
  const [decisionCorrectInput, setDecisionCorrectInput] = useState<Record<string, string>>({})
  const [decisionFeedbackOpen, setDecisionFeedbackOpen] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch(`/api/workspaces/${id}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const showToast = (message: string, link?: Toast['link']) => {
    const toastId = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id: toastId, message, link }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 5000)
  }

  const toggleSignal = async (sigId: string) => {
    if (expandedSignalId === sigId) {
      setExpandedSignalId(null)
      return
    }
    setExpandedSignalId(sigId)
    if (!signalDetails[sigId]) {
      const res = await fetch(`/api/signals/${sigId}`)
      if (res.ok) {
        const d = await res.json()
        setSignalDetails((prev) => ({ ...prev, [sigId]: d }))
      }
    }
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

  const runAgent = async (agentType: string) => {
    setRunningAgent(agentType)
    try {
      await fetch(`/api/workspaces/${id}/run-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, triggerType: 'manual' }),
      })
    } catch {
      // run completed or errored, fall through to reload
    }
    setRunningAgent(null)
    load()
  }

  const runAllAgents = async () => {
    setRunningAll(true)
    for (const agentType of AGENT_TYPES) {
      setRunningAgent(agentType)
      try {
        await fetch(`/api/workspaces/${id}/run-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentType, triggerType: 'manual' }),
        })
      } catch { /* continue */ }
      setRunningAgent(null)
    }
    setRunningAll(false)
    load()
  }

  const handleAction = async (actionId: string, decision: 'approved' | 'rejected', actionType: string) => {
    setApprovingId(actionId)
    await fetch('/api/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId, decision }),
    })
    setApprovingId(null)
    if (decision === 'approved') {
      if (actionType === 'send_draft') {
        showToast('草稿已生成，可前往草稿中心审阅', { label: '前往草稿中心 →', href: '/drafts' })
      } else if (actionType === 'create_task') {
        showToast('任务已创建', { label: '前往任务中心 →', href: '/tasks' })
      }
    }
    load()
  }

  const handleStageChange = async (newStage: string) => {
    setChangingStage(true)
    await fetch(`/api/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentStage: newStage }),
    })
    setChangingStage(false)
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">加载中...</div>
  if (!data) return <div className="flex items-center justify-center h-full text-gray-400">战场不存在</div>

  const { workspace, opportunity, customer, threads, pendingActions, lastSnapshot, recentSignals } = data
  const AGENT_TYPES = ['sales_copilot', 'presales_assistant', 'tender_assistant', 'commercial', 'handover']
  const currentStage = workspace.currentStage ?? opportunity?.stage ?? ''
  const stageHints = Array.isArray(lastSnapshot?.nextActionsJson)
    ? (lastSnapshot.nextActionsJson as string[]).slice(0, 2)
    : []

  return (
    <div className="h-full flex flex-col">
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div key={toast.id} className="bg-gray-900 text-white text-sm rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 min-w-64">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span>{toast.message}</span>
              {toast.link && (
                <button
                  onClick={() => router.push(toast.link!.href)}
                  className="text-blue-300 hover:text-blue-200 whitespace-nowrap ml-1"
                >
                  {toast.link.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <span>{customer?.name}</span>
              <ChevronRight className="w-3 h-3" />
              <span>商机作战台</span>
            </div>
            <h1 className="text-lg font-semibold">{opportunity?.name ?? '未知商机'}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {currentStage || '—'}
              </span>
              {opportunity?.amount && (
                <span className="text-xs text-gray-500">
                  ¥{(opportunity.amount / 10000).toFixed(0)}万
                </span>
              )}
            </div>
            {/* Stage selector */}
            <div className="flex items-center gap-1.5 mt-2">
              <GitBranch className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400">推进阶段：</span>
              <div className="flex gap-1 flex-wrap">
                {STAGES.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => handleStageChange(stage)}
                    disabled={changingStage || stage === currentStage}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      stage === currentStage
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 text-gray-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50'
                    }`}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${healthScoreColor(workspace.healthScore ?? 0)}`}>
              {Math.round(workspace.healthScore ?? 0)}
            </div>
            <div className="text-xs text-gray-400">健康分</div>
            <div className="flex gap-1.5 mt-1 justify-end">
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={runAllAgents}
                  disabled={!!runningAgent || runningAll}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-40"
                  title="让所有 AI 数字员工依次分析最新信号，产出风险判断、建议和行动"
                >
                  {runningAll ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {runningAll ? '全员运行中' : '触发全员'}
                </button>
                <p className="text-[10px] text-gray-400 text-right">AI 自动分析并生成建议</p>
              </div>
              <button
                onClick={() => setCloseModal('won')}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                title="标记此商机为赢单，关闭战场"
              >
                <Trophy className="w-3 h-3" />赢单
              </button>
              <button
                onClick={() => setCloseModal('lost')}
                className="flex items-center gap-1 px-2 py-1 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50"
                title="标记此商机为输单，记录输单原因，关闭战场"
              >
                <XCircle className="w-3 h-3" />输单
              </button>
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-gray-500">风险</span>
            <span className="font-medium text-red-500">{Math.round(workspace.riskScore ?? 0)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-gray-500">阻塞</span>
            <span className="font-medium text-orange-500">{Math.round(workspace.blockScore ?? 0)}</span>
          </div>
        </div>

        {/* Stage hints from last snapshot */}
        {stageHints.length > 0 && (
          <div className="flex items-center gap-2 mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="font-medium">当前阶段建议：</span>
            <span>{stageHints.join(' · ')}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-3 gap-6">

          {/* Left: Agent status */}
          <div className="col-span-2 space-y-4">
            {/* Pending actions */}
            {pendingActions.length > 0 && (
              <div className="bg-white rounded-xl border">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium">待确认动作</span>
                    <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">
                      {pendingActions.length}
                    </span>
                  </div>
                </div>
                <div className="divide-y">
                  {pendingActions.map((action) => (
                    <div key={action.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-700">
                            {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(action.actionStatus)}`}>
                            {action.actionStatus === 'pending_approval' ? '待审批' : action.actionStatus}
                          </span>
                          {action.actionPriority && action.actionPriority >= 4 && (
                            <span className="text-xs text-red-500">P{action.actionPriority}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600">
                          {action.actionPayloadJson?.title ?? action.actionPayloadJson?.description ?? '—'}
                        </p>
                        {action.actionPayloadJson?.draft && (
                          <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1 line-clamp-2">
                            {action.actionPayloadJson.draft}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleAction(action.id, 'approved', action.actionType)}
                          disabled={approvingId === action.id}
                          className="px-2.5 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => handleAction(action.id, 'rejected', action.actionType)}
                          disabled={approvingId === action.id}
                          className="px-2.5 py-1 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50 disabled:opacity-50"
                        >
                          驳回
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent threads */}
            <div className="bg-white rounded-xl border">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">数字员工状态</span>
                <span className="text-xs text-gray-400 ml-auto">新信号绑定后自动触发 · 也可手动触发</span>
              </div>
              <div className="divide-y">
                {AGENT_TYPES.map((agentType) => {
                  const threadData = threads.find((t) => t.thread.agentType === agentType)
                  const thread = threadData?.thread
                  const run = threadData?.latestRun
                  const decisions = threadData?.decisions ?? []
                  const isRunning = runningAgent === agentType || thread?.threadStatus === 'running'

                  return (
                    <div key={agentType} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            isRunning ? 'bg-blue-400 animate-pulse' :
                            thread?.threadStatus === 'idle' ? 'bg-green-400' :
                            thread?.threadStatus === 'error' ? 'bg-red-400' : 'bg-gray-300'
                          }`} />
                          <span className="text-sm font-medium">{AGENT_LABELS[agentType]}</span>
                          {thread && (
                            <span className="text-xs text-gray-400">
                              {isRunning ? '运行中...' :
                               thread.lastActiveAt ? `活跃于 ${formatRelativeTime(thread.lastActiveAt)}` : '未运行'}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => runAgent(agentType)}
                          disabled={!!runningAgent}
                          className="flex items-center gap-1 px-2.5 py-1 border rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                          title={`手动触发 ${AGENT_LABELS[agentType]}，分析当前信号并给出最新建议`}
                        >
                          {isRunning ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          {isRunning ? '运行中' : '触发'}
                        </button>
                      </div>

                      {run && (
                        <div className="text-xs text-gray-600 bg-gray-50 rounded px-2.5 py-2">
                          {run.outputSummary ?? run.reasoningSummary ?? '运行完成'}
                        </div>
                      )}

                      {decisions.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {decisions.slice(0, 2).map((d) => {
                            const fb = decisionFeedback[d.id]
                            const isOpen = decisionFeedbackOpen === d.id
                            return (
                              <div key={d.id}>
                                <div className="flex items-start gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                                    (d.severityLevel ?? 1) >= 4 ? 'bg-red-400' :
                                    (d.severityLevel ?? 1) >= 3 ? 'bg-yellow-400' : 'bg-blue-400'
                                  }`} />
                                  <p className="text-xs text-gray-600 leading-relaxed flex-1">
                                    <span className="font-medium">{d.decisionLabel}</span>
                                    {d.rationaleSummary && ` — ${d.rationaleSummary}`}
                                  </p>
                                  {/* Feedback buttons */}
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
                                          setDecisionFeedback((p) => ({ ...p, [d.id]: 'correct' }))
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
                                {/* Inline correction input */}
                                {isOpen && !fb && (
                                  <div className="ml-4 mt-1.5 space-y-1.5">
                                    <input
                                      value={decisionCorrectInput[d.id] ?? ''}
                                      onChange={(e) => setDecisionCorrectInput((p) => ({ ...p, [d.id]: e.target.value }))}
                                      placeholder="正确的判断是什么？（选填）"
                                      className="w-full border rounded px-2 py-1 text-xs"
                                    />
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={async () => {
                                          await fetch(`/api/decisions/${d.id}/feedback`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              isCorrect: false,
                                              correctJudgment: decisionCorrectInput[d.id]?.trim() || undefined,
                                            }),
                                          })
                                          setDecisionFeedback((p) => ({ ...p, [d.id]: 'wrong' }))
                                          setDecisionFeedbackOpen(null)
                                        }}
                                        className="px-2 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                      >
                                        提交纠偏
                                      </button>
                                      <button
                                        onClick={() => setDecisionFeedbackOpen(null)}
                                        className="px-2 py-0.5 border rounded text-xs text-gray-500 hover:bg-gray-50"
                                      >
                                        取消
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
            </div>
          </div>

          {/* Right: Snapshot */}
          <div className="space-y-4">
            {lastSnapshot ? (
              <div className="bg-white rounded-xl border">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">最新快照</span>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">阶段</p>
                    <p className="text-sm font-medium">{lastSnapshot.stage ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">健康度</p>
                    <p className={`text-sm font-bold ${healthScoreColor(lastSnapshot.healthScore ?? 0)}`}>
                      {lastSnapshot.healthScore ?? '—'}
                    </p>
                  </div>
                  {lastSnapshot.riskSummary && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">风险摘要</p>
                      <p className="text-xs text-gray-700">{lastSnapshot.riskSummary}</p>
                    </div>
                  )}
                  {Array.isArray(lastSnapshot.nextActionsJson) && lastSnapshot.nextActionsJson.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">推荐下一步</p>
                      <div className="space-y-1">
                        {(lastSnapshot.nextActionsJson as string[]).slice(0, 3).map((a, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <ChevronRight className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                            {a}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border px-4 py-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">触发 Agent 后生成快照</p>
              </div>
            )}

            {/* Recent signals */}
            {recentSignals && recentSignals.length > 0 && (
              <div className="bg-white rounded-xl border">
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">关联信号</span>
                  <span className="text-xs text-gray-400 ml-auto">{recentSignals.length} 条</span>
                </div>
                <div className="divide-y">
                  {recentSignals.map((sig) => {
                    const isExpanded = expandedSignalId === sig.id
                    const detail = signalDetails[sig.id]
                    return (
                      <div key={sig.id} className="px-4 py-2.5">
                        <button
                          className="w-full text-left"
                          onClick={() => toggleSignal(sig.id)}
                        >
                          <div className="flex items-center gap-2">
                            {sig.signalType && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${signalTypeColor(sig.signalType)} inline-block flex-shrink-0`}>
                                {SIGNAL_TYPE_LABELS[sig.signalType] ?? sig.signalType}
                              </span>
                            )}
                            <ChevronDown className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                          <p className="text-xs text-gray-700 line-clamp-2 mt-1">{sig.contentSummary ?? '—'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(sig.eventTime)}</p>
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {detail ? (
                              <>
                                {/* Key points */}
                                {Array.isArray(detail.parsedEntitiesJson?.keyPoints) && detail.parsedEntitiesJson.keyPoints.length > 0 && (
                                  <div className="bg-amber-50 rounded px-2.5 py-2">
                                    <p className="text-xs font-medium text-amber-700 mb-1.5">AI 提炼要点</p>
                                    <ul className="space-y-1">
                                      {(detail.parsedEntitiesJson.keyPoints as string[]).map((pt: string, i: number) => (
                                        <li key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                                          <span className="text-amber-400 flex-shrink-0 mt-0.5">•</span>
                                          {pt}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {/* Risk flags */}
                                {Array.isArray(detail.parsedEntitiesJson?.riskFlags) && detail.parsedEntitiesJson.riskFlags.length > 0 && (
                                  <div className="bg-red-50 rounded px-2.5 py-2">
                                    <p className="text-xs font-medium text-red-700 mb-1">风险信号</p>
                                    <div className="flex flex-wrap gap-1">
                                      {(detail.parsedEntitiesJson.riskFlags as string[]).map((flag: string, i: number) => (
                                        <span key={i} className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">⚠ {flag}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Parsed entities */}
                                {detail.parsedEntitiesJson && (() => {
                                  const entityLabels: Record<string, { label: string; color: string }> = {
                                    customerNames: { label: '客户', color: 'bg-blue-100 text-blue-800' },
                                    personNames: { label: '联系人', color: 'bg-purple-100 text-purple-800' },
                                    keywords: { label: '关键词', color: 'bg-gray-100 text-gray-700' },
                                    competitorMentions: { label: '竞品', color: 'bg-orange-100 text-orange-800' },
                                    amounts: { label: '金额', color: 'bg-green-100 text-green-800' },
                                    deadlines: { label: '时间', color: 'bg-cyan-100 text-cyan-800' },
                                  }
                                  const chips = Object.entries(entityLabels).flatMap(([k, cfg]) => {
                                    const val = (detail.parsedEntitiesJson as Record<string, unknown>)[k]
                                    if (!Array.isArray(val) || val.length === 0) return []
                                    return (val as string[]).map((item, i) => (
                                      <span key={`${k}-${i}`} className={`text-xs px-1.5 py-0.5 rounded ${cfg.color}`}>
                                        {cfg.label}: {item}
                                      </span>
                                    ))
                                  })
                                  return chips.length > 0 ? (
                                    <div className="bg-blue-50 rounded px-2.5 py-2">
                                      <p className="text-xs font-medium text-blue-700 mb-1">提取实体</p>
                                      <div className="flex flex-wrap gap-1">{chips}</div>
                                    </div>
                                  ) : null
                                })()}
                                {/* Raw content */}
                                {detail.rawContent && (
                                  <div className="bg-gray-50 rounded px-2.5 py-2">
                                    <p className="text-xs font-medium text-gray-500 mb-1">原始内容</p>
                                    <p className="text-xs text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                      {detail.rawContent}
                                    </p>
                                  </div>
                                )}
                                {detail.confidenceScore !== null && detail.confidenceScore !== undefined && (
                                  <p className="text-xs text-gray-400">
                                    AI 置信度：{Math.round((detail.confidenceScore ?? 0) * 100)}%
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-gray-400">加载中...</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close deal modal */}
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
                    onChange={(e) => setLostReason(e.target.value)}
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
                    onChange={(e) => setLostNote(e.target.value)}
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
              <button
                onClick={() => setCloseModal(null)}
                className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleCloseDeal(closeModal)}
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
    </div>
  )
}
