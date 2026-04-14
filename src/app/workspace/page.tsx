'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Swords, Plus, TrendingUp, AlertTriangle, Clock, Zap, RefreshCw,
  LayoutGrid, GitBranch, Radio, Users, Table2,
} from 'lucide-react'
import { healthScoreColor, formatRelativeTime, AGENT_LABELS } from '@/lib/utils'
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
  agentStatuses: { agentType: string; status: string; lastActiveAt: string | null }[]
  aiSummary: { outputSummary: string | null; agentType: string; startedAt: string | null } | null
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
  const [view, setView] = useState<'matrix' | 'cards' | 'pipeline'>(
    viewParam === 'pipeline' ? 'pipeline' : viewParam === 'cards' ? 'cards' : 'matrix'
  )

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
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingByWorkspace, setPendingByWorkspace] = useState<{ name: string; count: number; id: string }[]>([])
  const [runningAgentTotal, setRunningAgentTotal] = useState(0)
  const [riskWorkspaceCount, setRiskWorkspaceCount] = useState(0)

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
        // 全局运转中Agent数 + 高风险商机数
        const runningTotal = ws.reduce((sum, w) => sum + w.runningAgentCount, 0)
        setRunningAgentTotal(runningTotal)
        const riskCount = ws.filter(w => (w.workspace.riskScore ?? 0) > 50).length
        setRiskWorkspaceCount(riskCount)
      })
  }, [])

  useEffect(() => {
    if (view === 'pipeline' && pipelineItems.length === 0) {
      setLoadingPipeline(true)
      fetch('/api/pipeline')
        .then(r => r.json())
        .then(d => { setPipelineItems(d.items ?? []); setLoadingPipeline(false) })
    }
  }, [view, pipelineItems.length])

  const switchView = (v: 'matrix' | 'cards' | 'pipeline') => {
    setView(v)
    router.replace(v === 'pipeline' ? '/workspace?view=pipeline' : v === 'cards' ? '/workspace?view=cards' : '/workspace', { scroll: false })
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

  return (
    <div className={`flex flex-col ${view === 'pipeline' ? 'h-full' : ''}`}>
      {/* Page header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">        <Breadcrumb items={[{ label: '主价值流' }, { label: '商机作战空间' }]} />
        <PageGuide
          storageKey="workspace"
          contents={{
            sales: {
              roleLabel: '销售',
              purpose: '所有商机与 AI 数字员工协作的全局视图',
              whenToUse: '每天开始工作时，或在此录入信号后查看哪个战场需要你的决策',
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
              purpose: '智能体协同执行的商机推进主阵地',
              whenToUse: '每周例会前或看到风险告警时来这里',
              aiAlreadyDid: '已为所有商机评分，标记高风险战场，统计积压动作数',
              youDecide: '关注风险分高的战场，决定是否介入或调整资源',
              nextStepLabel: '查看运行驾驶舱',
              nextStepHref: '/dashboard',
            },
          }}
        />

        {/* 全局系统状态横条 — 始终显示 */}
        <div className={`rounded-xl px-4 py-2.5 mb-3 flex items-center gap-4 flex-wrap text-xs ${
          pendingTotal > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50 border border-gray-200'
        }`}>
          {/* 运转中 */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${runningAgentTotal > 0 ? 'bg-blue-400 animate-pulse' : 'bg-gray-300'}`} />
            <span className={runningAgentTotal > 0 ? 'text-blue-700 font-medium' : 'text-gray-500'}>
              {runningAgentTotal > 0 ? `${runningAgentTotal} 个数字员工运转中` : '暂无 Agent 运行'}
            </span>
          </div>
          <span className="text-gray-300">·</span>
          {/* 待决策 */}
          <div className="flex items-center gap-1.5">
            <Zap className={`w-3.5 h-3.5 ${pendingTotal > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
            {pendingTotal > 0 ? (
              <span className="text-orange-700 font-medium">{pendingTotal} 件等你决策</span>
            ) : (
              <span className="text-gray-500">无待审批</span>
            )}
          </div>
          <span className="text-gray-300">·</span>
          {/* 风险商机 */}
          <div className="flex items-center gap-1.5">
            <AlertTriangle className={`w-3.5 h-3.5 ${riskWorkspaceCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            {riskWorkspaceCount > 0 ? (
              <span className="text-red-700 font-medium">{riskWorkspaceCount} 个商机高风险</span>
            ) : (
              <span className="text-gray-500">无高风险商机</span>
            )}
          </div>
          {/* 快速跳转待审批链接 */}
          {pendingTotal > 0 && (
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
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
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold">商机作战空间</h1>
            <span className="text-sm text-gray-500">{workspaces.length} 个商机</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 录入信号 */}
            <Link
              href="/inbox"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              <Radio className="w-4 h-4" />录入信号
            </Link>
            {/* 视图切换 */}
            <div className="flex border rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => switchView('matrix')}
                className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${view === 'matrix' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Table2 className="w-3.5 h-3.5" />矩阵
              </button>
              <button
                onClick={() => switchView('cards')}
                className={`flex items-center gap-1 px-3 py-1.5 border-l transition-colors ${view === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
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
            )}          </div>
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

      {/* ── 矩阵视图 ─────────────────────────────── */}
      {view === 'matrix' && (
        <div className="flex-1 overflow-auto">
          {loadingCards ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : sortedCards.length === 0 ? (
            <div className="text-center py-16">
              <Swords className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">还没有商机</p>
            </div>
          ) : (
            <div className="min-w-max">
              {/* 矩阵表头 */}
              <div className="sticky top-0 bg-gray-50 border-b z-10 flex text-xs font-medium text-gray-500">
                <div className="w-72 flex-shrink-0 px-4 py-3 border-r">战场 · 商机</div>
                <div className="w-20 flex-shrink-0 px-3 py-3 border-r text-center">总控</div>
                <div className="w-20 flex-shrink-0 px-3 py-3 border-r text-center">销售</div>
                <div className="w-20 flex-shrink-0 px-3 py-3 border-r text-center">方案</div>
                <div className="w-20 flex-shrink-0 px-3 py-3 border-r text-center">招标</div>
                <div className="w-20 flex-shrink-0 px-3 py-3 border-r text-center">交付</div>
                <div className="w-20 flex-shrink-0 px-3 py-3 border-r text-center">服务</div>
                <div className="w-28 flex-shrink-0 px-3 py-3 text-center text-orange-500">待你审批</div>
              </div>

              {/* 矩阵行 */}
              {sortedCards.map((item) => {
                const { workspace, opportunity, customer, pendingActionCount, agentStatuses, aiSummary } = item
                const hasRunning = agentStatuses.some(a => a.status === 'running')
                const MATRIX_AGENTS = ['coordinator', 'sales', 'presales_assistant', 'tender_assistant', 'handover', 'service_triage']
                const AGENT_SHORT: Record<string, string> = {
                  coordinator: '总控', sales: '销售', presales_assistant: '方案',
                  tender_assistant: '招标', handover: '交付', service_triage: '服务',
                }
                return (
                  <div
                    key={workspace.id}
                    className={`flex border-b hover:bg-blue-50/20 transition-colors ${hasRunning ? 'border-l-2 border-l-blue-400' : 'border-l-2 border-l-transparent'}`}
                  >
                    {/* 战场名称列 */}
                    <div className="w-72 flex-shrink-0 px-4 py-3 border-r">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`/workspace/${workspace.id}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
                          >
                            {opportunity?.name ?? '未知商机'}
                          </a>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                            <span>{customer?.name ?? '—'}</span>
                            <span>·</span>
                            <span>{opportunity?.stage ?? workspace.currentStage ?? '—'}</span>
                          </div>
                        </div>
                        <span className={`text-lg font-bold flex-shrink-0 ml-2 ${
                          (workspace.healthScore ?? 0) >= 70 ? 'text-green-500' :
                          (workspace.healthScore ?? 0) >= 50 ? 'text-amber-500' : 'text-red-500'
                        }`}>{Math.round(workspace.healthScore ?? 0)}</span>
                      </div>
                      {/* AI 诊断句 */}
                      {aiSummary?.outputSummary && (
                        <p className="text-[11px] text-blue-600 mt-1.5 line-clamp-1 bg-blue-50 px-2 py-0.5 rounded">
                          {aiSummary.outputSummary.slice(0, 45)}{aiSummary.outputSummary.length > 45 ? '...' : ''}
                        </p>
                      )}
                    </div>

                    {/* Agent 状态单元格 */}
                    {MATRIX_AGENTS.map((agentType) => {
                      const agentStatus = agentStatuses.find(a => a.agentType === agentType)
                      const status = agentStatus?.status ?? 'none'
                      return (
                        <div
                          key={agentType}
                          className="w-20 flex-shrink-0 px-3 py-3 border-r flex flex-col items-center justify-center gap-1"
                          title={`${AGENT_SHORT[agentType]} · ${status === 'running' ? '运行中' : status === 'idle' ? '待命' : status === 'error' ? '错误' : '未部署'}`}
                        >
                          {status === 'running' ? (
                            <>
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                              </span>
                              <span className="text-[9px] text-blue-500 font-medium">运行中</span>
                            </>
                          ) : status === 'idle' ? (
                            <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
                          ) : status === 'error' ? (
                            <>
                              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                              <span className="text-[9px] text-red-400">错误</span>
                            </>
                          ) : (
                            <span className="text-[9px] text-gray-300">—</span>
                          )}
                        </div>
                      )
                    })}

                    {/* 待审批列 */}
                    <div className="w-28 flex-shrink-0 px-3 py-3 flex items-center justify-center">
                      {pendingActionCount > 0 ? (
                        <a
                          href={`/workspace/${workspace.id}`}
                          className="flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold px-2.5 py-1 rounded-full hover:bg-orange-100 transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          {pendingActionCount} 件
                        </a>
                      ) : (
                        <span className="text-[10px] text-gray-300">—</span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* 图例 */}
              <div className="bg-white border-t px-6 py-3 flex items-center gap-6 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" /></span>
                  运行中
                </div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-200" />待命</div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" />异常</div>
                <div className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-blue-400" />有Agent运行中的战场（左侧蓝线）</div>
              </div>
            </div>
          )}
        </div>
      )}

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
                const { workspace, opportunity, customer, pendingActionCount, runningAgentCount, agentStatuses, aiSummary } = item
                const activeAgents = agentStatuses.filter(a => a.status === 'running' || a.status === 'pending_approval')
                const hasRunning = activeAgents.some(a => a.status === 'running')
                const hasPending = activeAgents.some(a => a.status === 'pending_approval')
                return (
                  <Link
                    key={workspace.id}
                    href={`/workspace/${workspace.id}`}
                    className="relative bg-white rounded-xl border hover:shadow-md transition-shadow block overflow-hidden"
                  >
                    {/* 顶部状态色条 */}
                    <div className={`h-1 w-full ${
                      hasRunning ? 'bg-blue-400' :
                      pendingActionCount > 0 ? 'bg-orange-400' :
                      (workspace.riskScore ?? 0) > 50 ? 'bg-red-400' : 'bg-green-300'
                    }`} />

                    <div className="p-4">
                      {/* 行1: 商机名 + 健康分 */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 line-clamp-1">
                            {opportunity?.name ?? '未知商机'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {customer?.name ?? '—'}
                            {opportunity?.channelPartner && (
                              <span className="ml-1.5">· {opportunity.channelPartner}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-col items-end ml-3 flex-shrink-0">
                          <span className={`text-2xl font-bold leading-none ${healthScoreColor(workspace.healthScore ?? 0)}`}>
                            {Math.round(workspace.healthScore ?? 0)}
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5">健康分</span>
                        </div>
                      </div>

                      {/* 行2: Agent 状态行 */}
                      <div className="flex items-center gap-1.5 mb-2.5 min-h-[22px]">
                        {hasRunning ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                            <span className="text-xs text-blue-600 font-medium truncate">
                              {AGENT_LABELS[activeAgents.find(a => a.status === 'running')?.agentType ?? ''] ?? '数字员工'} 运行中...
                            </span>
                          </>
                        ) : hasPending ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                            <span className="text-xs text-orange-600 font-medium">等待审批指令</span>
                          </>
                        ) : agentStatuses.length > 0 ? (
                          <>
                            <Users className="w-3 h-3 text-gray-300 flex-shrink-0" />
                            <span className="text-xs text-gray-400">
                              {agentStatuses.length} 个数字员工待命
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-300">暂未部署 Agent</span>
                        )}
                        {pendingActionCount > 0 && (
                          <span className="ml-auto flex-shrink-0 bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {pendingActionCount} 待审
                          </span>
                        )}
                      </div>

                      {/* 行3: AI 最新诊断句 */}
                      {aiSummary?.outputSummary ? (
                        <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2.5">
                          <p className="text-xs text-blue-700 line-clamp-2 leading-relaxed">
                            {aiSummary.outputSummary}
                          </p>
                          <p className="text-[10px] text-blue-400 mt-1">
                            {AGENT_LABELS[aiSummary.agentType] ?? aiSummary.agentType} · {formatRelativeTime(aiSummary.startedAt)}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2.5">
                          <p className="text-xs text-gray-400">暂无 AI 分析记录</p>
                        </div>
                      )}

                      {/* 行4: 价值链进度条 */}
                      {(() => {
                        const stage = opportunity?.stage ?? workspace.currentStage ?? ''
                        const stageIdx = STAGES.indexOf(stage)
                        return (
                          <div className="mb-2.5">
                            <div className="flex gap-0.5 mb-1">
                              {STAGES.map((s, i) => (
                                <div
                                  key={s}
                                  title={s}
                                  className={`flex-1 h-1 rounded-full transition-colors`}
                                  style={{ backgroundColor: i < stageIdx ? '#60a5fa' : i === stageIdx ? '#2563eb' : '#e5e7eb' }}
                                />
                              ))}
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
                              <span>{STAGES[0]}</span>
                              {stageIdx > 0 && stageIdx < STAGES.length - 1 && (
                                <span className="text-blue-600 font-medium">{stage}</span>
                              )}
                              <span>{STAGES[STAGES.length - 1]}</span>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 行5: 底部元信息 */}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3" />
                          {opportunity?.amount ? `¥${(opportunity.amount / 10000).toFixed(0)}万` : '—'}
                          {(workspace.riskScore ?? 0) > 30 && (
                            <span className="flex items-center gap-0.5 text-red-500 ml-1">
                              <AlertTriangle className="w-3 h-3" />
                              风险 {Math.round(workspace.riskScore ?? 0)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(workspace.updatedAt)}
                        </div>
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
