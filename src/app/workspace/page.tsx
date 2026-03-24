'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Swords, Plus, TrendingUp, AlertTriangle, Clock, Zap, RefreshCw,
  Building2, ChevronDown, LayoutGrid, GitBranch, Radio, Upload, Edit3,
} from 'lucide-react'
import { healthScoreColor, formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'
import { Breadcrumb } from '@/components/ui/breadcrumb'

// ── 卡片视图数据类型 ──────────────────────────────────────
interface WorkspaceItem {
  workspace: {
    id: string
    workspaceStatus: string
    currentStage: string | null
    healthScore: number | null
    riskScore: number | null
    updatedAt: string | null
  }
  opportunity: {
    id: string
    name: string
    stage: string
    amount: number | null
    channelPartner: string | null
  } | null
  customer: {
    id: string
    name: string
    industry: string | null
  } | null
  pendingActionCount: number
  runningAgentCount: number
}

// ── 流水线视图数据类型 ─────────────────────────────────────
const STAGES = ['需求挖掘', '方案设计', '招投标', '商务谈判', '合同签订', '交付', '售后']

interface PipelineItem {
  workspaceId: string
  currentStage: string | null
  healthScore: number | null
  riskScore: number | null
  opportunity: { id: string; name: string; amount: number | null; stage: string } | null
  customer: { id: string; name: string } | null
  pendingActionCount: number
  runningAgentCount: number
  agentStatuses: { agentType: string; status: string; lastActiveAt: string | null }[]
}

type SortKey = 'risk' | 'pending' | 'health' | 'amount'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'risk',    label: '风险优先' },
  { key: 'pending', label: '待审批优先' },
  { key: 'health',  label: '健康度优先' },
  { key: 'amount',  label: '金额优先' },
]

// ── 主页面 ──────────────────────────────────────────────────
function WorkspacePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const viewParam = searchParams.get('view')
  const [view, setView] = useState<'cards' | 'pipeline'>(viewParam === 'pipeline' ? 'pipeline' : 'cards')

  // 卡片视图状态
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('pending')
  const [channelFilter, setChannelFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [opportunities, setOpportunities] = useState<{ id: string; name: string }[]>([])
  const [selectedOppId, setSelectedOppId] = useState('')
  const [channelPartnerInput, setChannelPartnerInput] = useState('')
  const [creating, setCreating] = useState(false)

  // 流水线视图状态
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([])
  const [loadingPipeline, setLoadingPipeline] = useState(false)
  const [pipelineSort, setPipelineSort] = useState<'risk' | 'health' | 'amount'>('risk')

  // 信号输入 + 全局待处理
  const [signalCounts, setSignalCounts] = useState<{ total: number; unbound: number }>({ total: 0, unbound: 0 })
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingByWorkspace, setPendingByWorkspace] = useState<{ name: string; count: number; id: string }[]>([])
  const [showManualSignal, setShowManualSignal] = useState(false)
  const [manualContent, setManualContent] = useState('')
  const [submittingSignal, setSubmittingSignal] = useState(false)

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.json())
      .then(d => {
        const ws: WorkspaceItem[] = d.workspaces ?? []
        setWorkspaces(ws)
        setLoadingCards(false)
        // 全局待处理汇总
        const total = ws.reduce((sum, w) => sum + w.pendingActionCount, 0)
        setPendingTotal(total)
        const byWs = ws
          .filter(w => w.pendingActionCount > 0)
          .map(w => ({ name: w.opportunity?.name ?? '未命名', count: w.pendingActionCount, id: w.workspace.id }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
        setPendingByWorkspace(byWs)
      })
    fetch('/api/signals?limit=0')
      .then(r => r.json())
      .then(d => setSignalCounts({ total: d.total ?? 0, unbound: d.unboundCount ?? 0 }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (view === 'pipeline' && pipelineItems.length === 0) {
      setLoadingPipeline(true)
      fetch('/api/pipeline')
        .then(r => r.json())
        .then(d => { setPipelineItems(d.items ?? []); setLoadingPipeline(false) })
    }
  }, [view, pipelineItems.length])

  const switchView = (v: 'cards' | 'pipeline') => {
    setView(v)
    router.replace(v === 'pipeline' ? '/workspace?view=pipeline' : '/workspace', { scroll: false })
  }

  const loadOpportunities = async () => {
    const res = await fetch('/api/opportunities')
    const data = await res.json()
    setOpportunities(data.opportunities ?? [])
  }

  const handleCreate = async () => {
    if (!selectedOppId) return
    setCreating(true)
    await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: selectedOppId, channelPartner: channelPartnerInput.trim() || null }),
    })
    setCreating(false)
    setShowCreate(false)
    setChannelPartnerInput('')
    const res = await fetch('/api/workspaces')
    setWorkspaces((await res.json()).workspaces ?? [])
  }

  // 卡片视图：排序 + 过滤
  const channels = Array.from(new Set(workspaces.map(w => w.opportunity?.channelPartner ?? '直销')))
  const filtered = channelFilter
    ? workspaces.filter(w => (w.opportunity?.channelPartner ?? '直销') === channelFilter)
    : workspaces

  const sortedCards = [...filtered].sort((a, b) => {
    if (sortKey === 'risk')    return (b.workspace.riskScore ?? 0) - (a.workspace.riskScore ?? 0)
    if (sortKey === 'pending') return b.pendingActionCount - a.pendingActionCount
    if (sortKey === 'health')  return (a.workspace.healthScore ?? 0) - (b.workspace.healthScore ?? 0)
    if (sortKey === 'amount')  return (b.opportunity?.amount ?? 0) - (a.opportunity?.amount ?? 0)
    return 0
  })

  // 流水线视图：排序
  const sortedPipeline = [...pipelineItems].sort((a, b) => {
    if (pipelineSort === 'risk')   return (b.riskScore ?? 0) - (a.riskScore ?? 0)
    if (pipelineSort === 'health') return (b.healthScore ?? 0) - (a.healthScore ?? 0)
    if (pipelineSort === 'amount') return (b.opportunity?.amount ?? 0) - (a.opportunity?.amount ?? 0)
    return 0
  })

  const getStageIndex = (item: PipelineItem) => {
    const stage = item.currentStage ?? item.opportunity?.stage ?? ''
    const idx = STAGES.indexOf(stage)
    return idx >= 0 ? idx : -1
  }

  const handleManualSignal = async () => {
    if (!manualContent.trim()) return
    setSubmittingSignal(true)
    await fetch('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawContent: manualContent.trim(), sourceType: 'manual' }),
    })
    setSubmittingSignal(false)
    setManualContent('')
    setShowManualSignal(false)
    setSignalCounts(prev => ({ total: prev.total + 1, unbound: prev.unbound + 1 }))
  }

  return (
    <div className={`flex flex-col ${view === 'pipeline' ? 'h-full' : ''}`}>
      {/* Page header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <Breadcrumb items={[{ label: '主价值流' }, { label: '战场总览' }]} />
        <PageGuide
          storageKey="workspace"
          contents={{
            sales: {
              roleLabel: '销售',
              purpose: '所有商机与 AI 数字员工协作的全局视图',
              whenToUse: '每天开始工作时，或录入信号后查看哪个战场需要你的决策',
              aiAlreadyDid: '已为每个商机评估健康分/风险分，自动安排 Agent，生成待审批动作',
              youDecide: '进入有待审批动作的战场，在「待你决策」Tab 快速批准 AI 建议',
              nextStepLabel: '进入战场处理决策',
              nextStepHref: '/workspace',
            },
            solution: {
              roleLabel: '方案经理',
              purpose: '需要方案支持的商机全览',
              whenToUse: '收到方案审批请求或招标任务时来这里找对应战场',
              aiAlreadyDid: '已为每个商机分配解决方案 Agent，分析了技术评分和招标风险',
              youDecide: '进入需要技术审批的战场，在「待你决策」Tab 审核方案内容',
              nextStepLabel: '进入战场审批方案',
              nextStepHref: '/workspace',
            },
            manager: {
              roleLabel: '管理层',
              purpose: '全局商机健康状态总览',
              whenToUse: '每周例会前或看到风险告警时来这里',
              aiAlreadyDid: '已为所有商机评分，标记高风险战场，统计积压动作数',
              youDecide: '关注风险分高的战场，决定是否介入或调整资源',
              nextStepLabel: '查看运行驾驶舱',
              nextStepHref: '/dashboard',
            },
          }}
        />

        {/* 信号输入栏 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-blue-500" />
                信号输入
              </span>
              <button
                onClick={() => window.location.href = '/inbox?action=sync'}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />同步笔记
              </button>
              <button
                onClick={() => window.location.href = '/inbox?action=upload'}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border rounded-lg text-xs text-gray-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <Upload className="w-3 h-3" />上传文件
              </button>
              <button
                onClick={() => setShowManualSignal(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs transition-colors ${showManualSignal ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-blue-50 hover:border-blue-300'}`}
              >
                <Edit3 className="w-3 h-3" />手动录入
              </button>
            </div>
            {signalCounts.unbound > 0 && (
              <a href="/inbox" className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {signalCounts.unbound} 条待归属 →
              </a>
            )}
          </div>
          {showManualSignal && (
            <div className="mt-2.5 flex gap-2">
              <textarea
                value={manualContent}
                onChange={e => setManualContent(e.target.value)}
                placeholder="输入客户沟通记录、会议纪要、邮件内容等…AI 自动解析归类"
                rows={2}
                className="flex-1 text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={handleManualSignal}
                  disabled={submittingSignal || !manualContent.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingSignal ? '录入中…' : '录入'}
                </button>
                <button onClick={() => setShowManualSignal(false)} className="px-3 py-1.5 border rounded-lg text-xs text-gray-500">取消</button>
              </div>
            </div>
          )}
        </div>

        {/* 全局待处理汇总 */}
        {pendingTotal > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700">
              <Zap className="w-3.5 h-3.5" />
              共 <span className="font-bold">{pendingTotal}</span> 件事等你决策
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {pendingByWorkspace.map(ws => (
                <a
                  key={ws.id}
                  href={`/workspace/${ws.id}?tab=decisions`}
                  className="text-[11px] bg-white border border-orange-200 text-orange-600 px-2 py-0.5 rounded-full hover:bg-orange-100 transition-colors"
                >
                  {ws.name} · {ws.count}件
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold">战场总览</h1>
            <span className="text-sm text-gray-500">{workspaces.length} 个商机</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 视图切换 */}
            <div className="flex border rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => switchView('cards')}
                className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${view === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />卡片
              </button>
              <button
                onClick={() => switchView('pipeline')}
                className={`flex items-center gap-1 px-3 py-1.5 border-l transition-colors ${view === 'pipeline' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <GitBranch className="w-3.5 h-3.5" />流水线
              </button>
            </div>

            {view === 'cards' && (
              <button
                onClick={() => { setShowCreate(true); loadOpportunities() }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />新建战场
              </button>
            )}
          </div>
        </div>

        {/* 卡片视图工具栏 */}
        {view === 'cards' && (
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortKey(key)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    sortKey === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {channels.length > 1 && (
              <select
                value={channelFilter}
                onChange={e => setChannelFilter(e.target.value)}
                className="text-xs border rounded px-2 py-1 text-gray-600 bg-white"
              >
                <option value="">全部渠道</option>
                {channels.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        )}

        {/* 流水线视图工具栏 */}
        {view === 'pipeline' && (
          <div className="flex items-center gap-1 mt-3">
            {(['risk', 'health', 'amount'] as const).map(k => (
              <button
                key={k}
                onClick={() => setPipelineSort(k)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                  pipelineSort === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {k === 'risk' ? '风险优先' : k === 'health' ? '健康优先' : '金额优先'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 卡片视图 ─────────────────────────────── */}
      {view === 'cards' && (
        <div className="flex-1 overflow-auto p-6">
          {loadingCards ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : sortedCards.length === 0 ? (
            <div className="text-center py-16">
              <Swords className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">还没有商机</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedCards.map((item) => {
                const { workspace, opportunity, customer, pendingActionCount, runningAgentCount } = item
                return (
                  <Link
                    key={workspace.id}
                    href={`/workspace/${workspace.id}`}
                    className="relative bg-white rounded-xl border hover:shadow-md transition-shadow p-5 block"
                  >
                    {pendingActionCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold z-10">
                        {pendingActionCount}
                      </span>
                    )}

                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {runningAgentCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                          )}
                          <p className="font-medium text-sm text-gray-900 line-clamp-1">
                            {opportunity?.name ?? '未知商机'}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {customer?.name ?? '—'}
                          {opportunity?.channelPartner && (
                            <span className="text-gray-300 ml-1.5">· {opportunity.channelPartner}</span>
                          )}
                        </p>
                      </div>
                      <span className={`text-xl font-bold ml-2 flex-shrink-0 ${healthScoreColor(workspace.healthScore ?? 0)}`}>
                        {Math.round(workspace.healthScore ?? 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {opportunity?.stage ?? workspace.currentStage ?? '—'}
                      </span>
                      {(workspace.riskScore ?? 0) > 30 && (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          风险 {Math.round(workspace.riskScore ?? 0)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {opportunity?.amount ? `¥${(opportunity.amount / 10000).toFixed(0)}万` : '—'}
                        </div>
                        {pendingActionCount > 0 && (
                          <span className="flex items-center gap-0.5 text-orange-500">
                            <Zap className="w-3 h-3" />{pendingActionCount} 待审
                          </span>
                        )}
                        {runningAgentCount > 0 && (
                          <span className="flex items-center gap-0.5 text-blue-500">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            运行中 {runningAgentCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(workspace.updatedAt)}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 流水线视图 ───────────────────────────── */}
      {view === 'pipeline' && (
        <div className="flex-1 overflow-auto">
          {loadingPipeline ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">加载中...</div>
          ) : pipelineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <GitBranch className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">暂无活跃商机</p>
            </div>
          ) : (
            <div className="min-w-max">
              {/* Stage header */}
              <div className="sticky top-0 bg-gray-50 border-b z-10 flex">
                <div className="w-64 flex-shrink-0 px-4 py-3 text-xs font-medium text-gray-500 border-r">商机</div>
                <div className="w-24 flex-shrink-0 px-3 py-3 text-xs font-medium text-gray-500 border-r text-center">健康分</div>
                {STAGES.map(stage => (
                  <div key={stage} className="w-36 flex-shrink-0 px-3 py-3 text-xs font-medium text-gray-500 border-r text-center">
                    {stage}
                  </div>
                ))}
              </div>

              {sortedPipeline.map(item => {
                const stageIdx = getStageIndex(item)
                return (
                  <div
                    key={item.workspaceId}
                    className="flex border-b hover:bg-blue-50/30 cursor-pointer"
                    onClick={() => router.push(`/workspace/${item.workspaceId}`)}
                  >
                    <div className="w-64 flex-shrink-0 px-4 py-3 border-r">
                      <div className="text-xs text-gray-400 mb-0.5">{item.customer?.name ?? '—'}</div>
                      <div className="text-sm font-medium text-gray-800 line-clamp-1">{item.opportunity?.name ?? '未知商机'}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {item.opportunity?.amount && (
                          <span className="text-xs text-gray-500">¥{(item.opportunity.amount / 10000).toFixed(0)}万</span>
                        )}
                        {item.pendingActionCount > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-orange-600">
                            <Zap className="w-3 h-3" />{item.pendingActionCount} 待审
                          </span>
                        )}
                        {item.runningAgentCount > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-blue-600">
                            <RefreshCw className="w-3 h-3 animate-spin" />运行中
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-24 flex-shrink-0 px-3 py-3 border-r flex items-center justify-center">
                      <div className="text-center">
                        <div className={`text-lg font-bold ${healthScoreColor(item.healthScore ?? 0)}`}>
                          {Math.round(item.healthScore ?? 0)}
                        </div>
                        {(item.riskScore ?? 0) > 50 && (
                          <div className="flex items-center gap-0.5 text-xs text-red-500">
                            <AlertTriangle className="w-3 h-3" />高风险
                          </div>
                        )}
                      </div>
                    </div>
                    {STAGES.map((stage, idx) => {
                      const isCurrent = stageIdx === idx
                      const isPast = stageIdx > idx
                      const hasRunning = isCurrent && item.agentStatuses.some(a => a.status === 'running')
                      return (
                        <div
                          key={stage}
                          className={`w-36 flex-shrink-0 px-3 py-3 border-r flex items-center justify-center ${isCurrent ? 'bg-blue-50' : ''}`}
                        >
                          {isPast && <div className="w-2 h-2 rounded-full bg-green-400" />}
                          {isCurrent && (
                            <div className="flex flex-col items-center gap-1">
                              <div className={`w-2.5 h-2.5 rounded-full ${hasRunning ? 'bg-blue-400 animate-pulse' : 'bg-blue-500'}`} />
                              {hasRunning && <span className="text-xs text-blue-600">运行中</span>}
                              {item.pendingActionCount > 0 && !hasRunning && (
                                <span className="text-xs text-orange-600">{item.pendingActionCount} 待审</span>
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

          {/* Footer legend */}
          <div className="bg-white border-t px-6 py-3 flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-400" />已完成阶段</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" />当前阶段</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />AI 运行中</div>
            <div className="ml-auto">点击行进入战场</div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-96 p-6">
            <h2 className="text-base font-semibold mb-4">新建战场</h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">选择商机</label>
                <select
                  value={selectedOppId}
                  onChange={e => setSelectedOppId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">请选择...</option>
                  {opportunities.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">渠道商 <span className="text-gray-300">（可选）</span></label>
                <input
                  value={channelPartnerInput}
                  onChange={e => setChannelPartnerInput(e.target.value)}
                  placeholder="如：华安科技、中电智维..."
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button
                onClick={handleCreate}
                disabled={!selectedOppId || creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}>
      <WorkspacePageInner />
    </Suspense>
  )
}
