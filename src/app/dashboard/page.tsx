'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { healthScoreColor } from '@/lib/utils'

// ─── 类型定义 ──────────────────────────────────────────────────────────────

interface DashboardData {
  workspaceCount: number
  signalCount: number
  pendingActionCount: number
  feedbackCount: number
  avgHealthScore: number
  runningAgentCount: number
  failedActionCount: number
  activeRulesCount: number
  acceptRate: number
  wonCount: number
  lostCount: number
  highRiskWorkspaces: Array<{ id: string; name: string; healthScore: number; riskScore: number }>
  signalsByType: Record<string, number>
  actionsByStatus: Record<string, number>
  feedbackByLabel: Record<string, number>
  agentEffectiveness: Array<{ agentType: string; agentLabel: string; totalRuns: number; acceptRate: number; correctedCount: number }>
}

interface SignalItem {
  id: string
  signalType: string
  binding?: { workspaceId: string } | null
}

interface SkillTemplate { id: string; name: string; enabled: boolean }

interface RecentAction { id: string; actionType: string; actionTitle: string | null; actionStatus: string }

type ViewMode = 'control' | 'scene'

// ─── 常量 ──────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  '总控 Agent · 分析「大同煤矿」招标信号',
  '方案 Agent · 生成解决方案文档',
  '销售 Agent · 更新「阳光电源」健康分',
  '招标 Agent · 生成投标响应文件',
  '总控 Agent · 触发「中建三局」投标流程',
  '规则引擎 · 注入 12 条经营规则',
  '交付 Agent · 创建项目交付任务',
  '销售 Agent · 发送客户关怀草稿',
]

// 总控 Agent（决策层：分析判断、分配任务）
const COORDINATOR_NODE = { label: '总控 Agent', color: '#6366f1', hex: 'indigo' }

// 执行 Agent（行动层：按任务激活执行）
const AGENT_NODES = [
  { label: '销售 Agent',  color: '#0ea5e9', hex: 'sky' },
  { label: '方案 Agent',  color: '#8b5cf6', hex: 'violet' },
  { label: '招标 Agent',  color: '#a855f7', hex: 'purple' },
  { label: '商务 Agent',  color: '#14b8a6', hex: 'teal' },
  { label: '交付 Agent',  color: '#f59e0b', hex: 'amber' },
  { label: '服务 Agent',  color: '#f97316', hex: 'orange' },
]

// 全部 Agent（场景图用）
const ALL_AGENT_NODES = [COORDINATOR_NODE, ...AGENT_NODES]

const SIGNAL_COLORS: Record<string, string> = {
  demand: '#6366f1', risk: '#ef4444', opportunity: '#22c55e',
  blocker: '#f97316', escalation: '#a855f7', info: '#64748b',
}
const SIGNAL_LABELS: Record<string, string> = {
  demand: '需求', risk: '风险', opportunity: '商机',
  blocker: '阻塞', escalation: '升级', info: '信息',
}

const ACTION_OUTPUTS = [
  { label: '解决方案文档', color: '#8b5cf6' },
  { label: '立项文件',    color: '#6366f1' },
  { label: '投标响应文件', color: '#a855f7' },
  { label: '报价单',      color: '#0ea5e9' },
  { label: '方案草稿',    color: '#14b8a6' },
  { label: '客户邮件',    color: '#22c55e' },
]

const STATUS_COLORS: Record<string, string> = {
  pending_approval: '#f59e0b', approved: '#22c55e',
  completed: '#22c55e', rejected: '#ef4444', failed: '#ef4444',
}
const STATUS_LABELS: Record<string, string> = {
  pending_approval: '待审批', approved: '已批准',
  completed: '已完成', rejected: '已驳回', failed: '失败',
}

// ─── 主组件 ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [signals, setSignals] = useState<SignalItem[]>([])
  const [assetCount, setAssetCount] = useState(0)
  const [skillCount, setSkillCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ViewMode>('control')
  const [tickerIdx, setTickerIdx] = useState(0)
  const [agentPulseIdx, setAgentPulseIdx] = useState(0)
  const [battleOpen, setBattleOpen] = useState(true)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickType, setQuickType] = useState('demand')
  const [quickText, setQuickText] = useState('')
  const [quickLoading, setQuickLoading] = useState(false)
  const [recentActions, setRecentActions] = useState<RecentAction[]>([])

  // ── 数据加载 ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [dashRes, sigRes, assetRes, skillRes, actRes] = await Promise.all([
      fetch('/api/dashboard'), fetch('/api/signals'),
      fetch('/api/assets'), fetch('/api/skill-templates'),
      fetch('/api/actions?limit=6'),
    ])
    const [d, s, a, sk, act] = await Promise.all([
      dashRes.json(), sigRes.json(), assetRes.json(), skillRes.json(), actRes.json(),
    ])
    setData(d)
    setSignals(Array.isArray(s.signals) ? s.signals : [])
    setAssetCount(Array.isArray(a.assets) ? a.assets.length : 0)
    setSkillCount(Array.isArray(sk.templates) ? sk.templates.filter((t: SkillTemplate) => t.enabled).length : 0)
    setRecentActions(Array.isArray(act.actions) ? act.actions.slice(0, 6) : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 30000)
    return () => clearInterval(timer)
  }, [loadData])

  // ── ticker 动画 ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => setTickerIdx(i => (i + 1) % TICKER_ITEMS.length), 3200)
    return () => clearInterval(t)
  }, [])

  // ── Agent 脉冲轮换 ─────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => setAgentPulseIdx(i => (i + 1) % ALL_AGENT_NODES.length), 1800)
    return () => clearInterval(t)
  }, [])

  // ─── 派生数据 ──────────────────────────────────────────────────────────────

  const boundSignals = signals.filter(s => s.binding)
  const unboundSignals = signals.filter(s => !s.binding)
  const pendingApproval = data ? (data.actionsByStatus['pending'] ?? 0) + (data.actionsByStatus['pending_approval'] ?? 0) : 0
  const completedActions = data?.actionsByStatus['completed'] ?? 0
  const totalFeedback = data ? Object.values(data.feedbackByLabel).reduce((a: number, b: unknown) => a + (b as number), 0) : 0
  const correctedCount = data ? (data.feedbackByLabel['modified'] ?? 0) + (data.feedbackByLabel['rejected'] ?? 0) : 0

  // ─── 加载态 ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
        </div>
        <span className="text-slate-400 text-sm font-mono">系统启动中...</span>
      </div>
    </div>
  )
  if (!data) return null

  // ─── 场景图子组件 ──────────────────────────────────────────────────────────

  const SceneView = () => {
    const acceptedCount = data ? Math.round((data.signalCount * (data.acceptRate / 100))) : 0
    const totalActions = data ? Object.values(data.actionsByStatus).reduce((a: number, b: unknown) => a + (b as number), 0) : 0

    return (
    <div className="flex-1 bg-[#020817] overflow-auto p-4 flex flex-col gap-3 min-h-0">

      {/* 顶部系统状态栏 */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-400">AI 原生经营系统 · 运行中</span>
        </div>
        <div className="w-px h-3 bg-slate-700" />
        <span className="text-xs text-slate-600">{data.workspaceCount} 个活跃商机</span>
        <div className="w-px h-3 bg-slate-700" />
        <span className="text-xs text-slate-600">{data.runningAgentCount > 0 ? `${data.runningAgentCount} 个 Agent 运行中` : 'Agent 待命'}</span>
        <div className="w-px h-3 bg-slate-700" />
        <span className="text-xs text-slate-600">采纳率 <span className="text-indigo-400 font-medium">{data.acceptRate}%</span></span>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
          <span key={tickerIdx} className="fadein-up">{TICKER_ITEMS[tickerIdx]}</span>
        </div>
      </div>

      {/* 主流程：4区域 + 流动箭头 */}
      <div className="flex gap-0 min-h-0" style={{ flex: '1 1 0' }}>

        {/* ── 感知区 ── */}
        <div className="flex flex-col rounded-l-xl border-y border-l overflow-hidden" style={{ flex: 1, borderColor: '#6366f140', background: 'linear-gradient(160deg, #6366f110 0%, #020817 60%)' }}>
          {/* 区域头 */}
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#6366f125', background: '#6366f115' }}>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#6366f1', background: '#6366f120' }}>01</span>
            <span className="text-sm font-bold text-slate-100">感知</span>
            <span className="text-[10px] text-slate-500 ml-1">原始信号捕捉</span>
          </div>

          {/* 核心指标 */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black font-mono leading-none" style={{ color: '#6366f1', textShadow: '0 0 30px #6366f160' }}>{signals.length}</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">条信号</p>
                <p className="text-[10px] text-slate-600">总捕捉量</p>
              </div>
            </div>
          </div>

          {/* 信号分布 */}
          <div className="px-4 pb-3 flex-1">
            <p className="text-[10px] text-slate-600 mb-2 uppercase tracking-wider">信号类型分布</p>
            <div className="space-y-1.5">
              {Object.entries(data.signalsByType).map(([type, cnt]) => {
                const pct = signals.length > 0 ? Math.round((cnt / signals.length) * 100) : 0
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SIGNAL_COLORS[type] ?? '#64748b' }} />
                        <span className="text-[11px] text-slate-400">{SIGNAL_LABELS[type] ?? type}</span>
                      </div>
                      <span className="text-[11px] font-medium font-mono" style={{ color: SIGNAL_COLORS[type] ?? '#64748b' }}>{cnt}</span>
                    </div>
                    <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SIGNAL_COLORS[type] ?? '#64748b' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 告警 */}
          {unboundSignals.length > 0 && (
            <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: '#f59e0b30', background: '#f59e0b08' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
              </span>
              <span className="text-xs text-amber-400">{unboundSignals.length} 条待归属</span>
            </div>
          )}

          {/* 进入按钮 */}
          <Link href="/inbox" className="flex items-center justify-between px-4 py-2.5 border-t text-xs font-medium transition-all hover:bg-indigo-500/10 group" style={{ borderColor: '#6366f125', color: '#6366f1aa' }}>
            <span>信号收件箱</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>

        {/* 流动箭头 01→02 */}
        <div className="flex flex-col items-center justify-center shrink-0 w-10 gap-1 border-y" style={{ borderColor: '#6366f120', background: '#6366f106' }}>
          <div className="flex items-center gap-0.5">
            {[0,1,2,3].map(i => (
              <div key={i} className="flow-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#6366f1', animationDelay: `${i * 0.28}s`, boxShadow: '0 0 4px #6366f1' }} />
            ))}
            <span className="text-[10px] ml-0.5 leading-none" style={{ color: '#6366f1' }}>›</span>
          </div>
        </div>

        {/* ── 理解区 ── */}
        <div className="flex flex-col border-y overflow-hidden" style={{ flex: 1, borderColor: '#a855f740', background: 'linear-gradient(160deg, #a855f710 0%, #020817 60%)' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#a855f725', background: '#a855f715' }}>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#a855f7', background: '#a855f720' }}>02</span>
            <span className="text-sm font-bold text-slate-100">理解</span>
            <span className="text-[10px] text-slate-500 ml-1">结构化归属</span>
          </div>

          <div className="px-4 pt-3 pb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black font-mono leading-none" style={{ color: '#a855f7', textShadow: '0 0 30px #a855f760' }}>{boundSignals.length}</span>
              <div>
                <p className="text-xs text-slate-400 font-medium">已归属</p>
                <p className="text-[10px] text-slate-600">/ {signals.length} 总量</p>
              </div>
            </div>
          </div>

          <div className="px-4 pb-3 flex-1">
            <p className="text-[10px] text-slate-600 mb-2 uppercase tracking-wider">归属进度</p>
            {/* 主进度条 */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">归属率</span>
                <span className="text-slate-300 font-medium font-mono">{signals.length > 0 ? Math.round(boundSignals.length / signals.length * 100) : 0}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: signals.length > 0 ? `${Math.round(boundSignals.length / signals.length * 100)}%` : '0%', background: 'linear-gradient(to right, #6366f1, #a855f7)', boxShadow: '0 0 8px #a855f760' }} />
              </div>
            </div>
            {/* 高优先级商机归属 */}
            <div className="space-y-1.5">
              {data.highRiskWorkspaces.slice(0, 3).map(w => (
                <div key={w.id} className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 truncate max-w-[60%]">{w.name}</span>
                  <span className={`text-[10px] font-mono font-medium ${w.healthScore >= 70 ? 'text-emerald-400' : w.healthScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{Math.round(w.healthScore)}</span>
                </div>
              ))}
            </div>
          </div>

          <Link href="/inbox" className="flex items-center justify-between px-4 py-2.5 border-t text-xs font-medium transition-all hover:bg-purple-500/10 group" style={{ borderColor: '#a855f725', color: '#a855f7aa' }}>
            <span>归属确认</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>

        {/* 流动箭头 02→03 */}
        <div className="flex flex-col items-center justify-center shrink-0 w-10 gap-1 border-y" style={{ borderColor: '#a855f720', background: '#a855f706' }}>
          <div className="flex items-center gap-0.5">
            {[0,1,2,3].map(i => (
              <div key={i} className="flow-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#a855f7', animationDelay: `${i * 0.28 + 0.15}s`, boxShadow: '0 0 4px #a855f7' }} />
            ))}
            <span className="text-[10px] ml-0.5 leading-none" style={{ color: '#a855f7' }}>›</span>
          </div>
        </div>

        {/* ── 决策中枢（最宽）── */}
        <div className="flex flex-col border-y overflow-hidden" style={{ flex: 1.6, borderColor: '#8b5cf640', background: 'linear-gradient(160deg, #8b5cf612 0%, #020817 55%)' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#8b5cf625', background: '#8b5cf615' }}>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#8b5cf6', background: '#8b5cf620' }}>03</span>
            <span className="text-sm font-bold text-slate-100">决策中枢</span>
            <span className="text-[10px] text-slate-500 ml-1">AI 分析与协调</span>
            <span className="ml-auto text-[10px] font-medium font-mono" style={{ color: '#8b5cf6' }}>{data.acceptRate}% 采纳</span>
          </div>

          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black font-mono leading-none" style={{ color: '#8b5cf6', textShadow: '0 0 25px #8b5cf660' }}>{acceptedCount}</span>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">建议已采纳</p>
                    <p className="text-[10px] text-slate-600">/ {data.feedbackCount} 总反馈</p>
                  </div>
                </div>
              </div>
              {data.runningAgentCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border" style={{ borderColor: '#8b5cf650', background: '#8b5cf618' }}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
                  </span>
                  <span className="text-xs text-violet-400">{data.runningAgentCount} 运行中</span>
                </div>
              )}
            </div>
          </div>

          {/* Agent 网格 */}
          <div className="px-4 pb-2 flex-1">
            <p className="text-[10px] text-slate-600 mb-2 uppercase tracking-wider">数字员工矩阵</p>
            <div className="grid grid-cols-4 gap-1.5">
              {ALL_AGENT_NODES.map((agent, i) => {
                const isActive = i === agentPulseIdx
                const agentData = data.agentEffectiveness.find(a => a.agentLabel === agent.label)
                return (
                  <div key={agent.label}
                    className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg border transition-all"
                    style={{
                      borderColor: isActive ? agent.color + '80' : agent.color + '25',
                      backgroundColor: isActive ? agent.color + '18' : agent.color + '06',
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isActive ? agent.color : agent.color + '60', boxShadow: isActive ? `0 0 5px ${agent.color}` : 'none' }} />
                      <span className="text-[10px] truncate font-medium" style={{ color: isActive ? agent.color : '#64748b' }}>{agent.label}</span>
                    </div>
                    {agentData && agentData.totalRuns > 0 ? (
                      <span className="text-[9px] font-mono" style={{ color: isActive ? agent.color + 'aa' : '#475569' }}>{agentData.acceptRate}% 采纳</span>
                    ) : (
                      <span className="text-[9px]" style={{ color: '#334155' }}>待命</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 规则注入状态 */}
          <div className="mx-4 mb-3 flex items-center gap-3 px-3 py-2 rounded-lg border" style={{ borderColor: '#8b5cf625', background: '#8b5cf60a' }}>
            <span className="text-[10px] text-slate-500">规则注入</span>
            <span className="text-xs font-medium font-mono" style={{ color: '#f59e0b' }}>{data.activeRulesCount} 条</span>
            <span className="text-slate-700">·</span>
            <span className="text-[10px] text-slate-500">知识资产</span>
            <span className="text-xs font-medium font-mono" style={{ color: '#6366f1' }}>{assetCount} 条</span>
            <span className="text-slate-700">·</span>
            <span className="text-[10px] text-slate-500">技能</span>
            <span className="text-xs font-medium font-mono" style={{ color: '#8b5cf6' }}>{skillCount} 个</span>
          </div>

          <Link href="/intervention" className="flex items-center justify-between px-4 py-2.5 border-t text-xs font-medium transition-all hover:bg-violet-500/10 group" style={{ borderColor: '#8b5cf625', color: '#8b5cf6aa' }}>
            <span>查看 Agent 建议</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>

        {/* 流动箭头 03→04 */}
        <div className="flex flex-col items-center justify-center shrink-0 w-10 gap-1 border-y" style={{ borderColor: '#14b8a620', background: '#14b8a606' }}>
          <div className="flex items-center gap-0.5">
            {[0,1,2,3].map(i => (
              <div key={i} className="flow-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#14b8a6', animationDelay: `${i * 0.28 + 0.3}s`, boxShadow: '0 0 4px #14b8a6' }} />
            ))}
            <span className="text-[10px] ml-0.5 leading-none" style={{ color: '#14b8a6' }}>›</span>
          </div>
        </div>

        {/* ── 行动产出区 ── */}
        <div className="flex flex-col rounded-r-xl border-y border-r overflow-hidden" style={{ flex: 1.2, borderColor: '#14b8a640', background: 'linear-gradient(160deg, #14b8a610 0%, #020817 60%)' }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#14b8a625', background: '#14b8a615' }}>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#14b8a6', background: '#14b8a620' }}>04</span>
            <span className="text-sm font-bold text-slate-100">行动产出</span>
            <span className="text-[10px] text-slate-500 ml-1">自动执行</span>
          </div>

          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black font-mono leading-none" style={{ color: '#f59e0b', textShadow: '0 0 25px #f59e0b60' }}>{pendingApproval}</span>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">待审批</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono" style={{ color: '#22c55e' }}>{completedActions}</span>
                <p className="text-[10px] text-slate-500">已完成</p>
              </div>
            </div>
          </div>

          <div className="px-4 pb-2 flex-1">
            {/* 动作进度 */}
            <p className="text-[10px] text-slate-600 mb-2 uppercase tracking-wider">执行状态</p>
            {[
              { label: '待审批', count: pendingApproval, color: '#f59e0b' },
              { label: '已完成', count: completedActions, color: '#22c55e' },
              { label: '执行失败', count: data.actionsByStatus['failed'] ?? 0, color: '#ef4444' },
            ].map(({ label, count, color }) => (
              <div key={label} className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-mono font-medium" style={{ color }}>{count}</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: totalActions > 0 ? `${Math.round(count / totalActions * 100)}%` : '0%', backgroundColor: color, boxShadow: `0 0 4px ${color}60` }} />
                </div>
              </div>
            ))}

            {/* 产出类型 */}
            <p className="text-[10px] text-slate-600 mt-3 mb-1.5 uppercase tracking-wider">产出文件类型</p>
            <div className="flex flex-wrap gap-1">
              {ACTION_OUTPUTS.map(o => (
                <div key={o.label} className="flex items-center gap-1 rounded px-1.5 py-0.5 border border-slate-800" style={{ background: o.color + '08' }}>
                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: o.color }} />
                  <span className="text-[9px] text-slate-500">{o.label}</span>
                </div>
              ))}
            </div>
          </div>

          {pendingApproval > 0 && (
            <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: '#f59e0b30', background: '#f59e0b08' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
              </span>
              <span className="text-xs text-amber-400">{pendingApproval} 个动作等待审批</span>
            </div>
          )}

          <Link href="/intervention" className="flex items-center justify-between px-4 py-2.5 border-t text-xs font-medium transition-all hover:bg-teal-500/10 group" style={{ borderColor: '#14b8a625', color: '#14b8a6aa' }}>
            <span>审批动作</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>
      </div>

      {/* 赋能底座 */}
      <div className="shrink-0 rounded-xl border overflow-hidden" style={{ borderColor: '#f59e0b35', background: 'linear-gradient(to right, #f59e0b08, #8b5cf608, #6366f108)' }}>
        <div className="px-5 py-2 border-b flex items-center gap-3" style={{ borderColor: '#f59e0b20' }}>
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">赋能底座</span>
          <span className="text-[10px] text-slate-700">· 注入 Agent 决策知识</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-800/50">
          {[
            { label: '知识资产', value: assetCount, color: '#6366f1', href: '/assets', sub: '产品 · 方案 · 案例 · 话术', detail: '注入 AI 决策弹药' },
            { label: '生效规则', value: data.activeRulesCount, color: '#f59e0b', href: '/evolution', sub: `已纠偏 ${correctedCount} 次`, detail: '规则治理与训练' },
            { label: '上架技能', value: skillCount, color: '#8b5cf6', href: '/evolution', sub: `总反馈 ${totalFeedback} 条`, detail: '工具调试与装载' },
          ].map(item => (
            <Link key={item.label} href={item.href} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-800/30 transition-colors group">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono" style={{ color: item.color, textShadow: `0 0 20px ${item.color}50` }}>{item.value}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200">{item.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.sub}</p>
                <p className="text-[10px] text-slate-700 mt-0.5">{item.detail}</p>
              </div>
              <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: item.color }}>进入 →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
    )
  }

  // ─── 右侧战场面板（两种模式共用） ──────────────────────────────────────────

  const BattlePanel = () => (
    <div className="w-72 shrink-0 border-l border-slate-800 overflow-y-auto bg-slate-950 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 tracking-widest uppercase">实时战场</span>
        <button onClick={() => setBattleOpen(o => !o)} className="text-slate-600 hover:text-slate-400 text-xs">
          {battleOpen ? '收起' : '展开'}
        </button>
      </div>
      {battleOpen && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 全局健康度 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">全局商机健康度</p>
            <p className={`text-4xl font-bold font-mono ${healthScoreColor(data.avgHealthScore)}`}>
              {Math.round(data.avgHealthScore)}
            </p>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2 mb-3">
              <div className={`h-full rounded-full transition-all ${data.avgHealthScore >= 70 ? 'bg-emerald-500' : data.avgHealthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${Math.round(data.avgHealthScore)}%` }} />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-400 font-medium">{data.wonCount} 赢单</span>
              <span className="text-red-400 font-medium">{data.lostCount} 输单</span>
              <span className="text-blue-400 font-medium">{data.workspaceCount} 活跃</span>
            </div>
          </div>

          {/* 高风险战场 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-400">高风险战场</p>
              <Link href="/workspace" className="text-xs text-slate-600 hover:text-slate-400">全部 →</Link>
            </div>
            {data.highRiskWorkspaces.length === 0 ? (
              <p className="text-xs text-slate-600 py-2 text-center">暂无高风险商机</p>
            ) : data.highRiskWorkspaces.map(w => (
              <Link key={w.id} href={`/workspace/${w.id}`} className="flex items-center justify-between py-1.5 hover:bg-slate-800 rounded px-1 -mx-1 group">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                  </span>
                  <span className="text-xs text-slate-300 truncate max-w-[100px]">{w.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-bold ${healthScoreColor(w.healthScore)}`}>{Math.round(w.healthScore)}</span>
                  <span className="text-xs text-red-400">风险{Math.round(w.riskScore)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* 最新动作流水 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-400">最新动作</p>
              <Link href="/intervention" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">全部 →</Link>
            </div>
            {recentActions.length === 0 ? (
              <p className="text-xs text-slate-600 py-2 text-center">暂无动作记录</p>
            ) : recentActions.map(a => (
              <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-slate-800/60 last:border-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[a.actionStatus] ?? '#64748b' }} />
                <span className="flex-1 text-xs text-slate-400 truncate">{a.actionTitle ?? a.actionType}</span>
                <span className="text-[10px] shrink-0" style={{ color: STATUS_COLORS[a.actionStatus] ?? '#64748b' }}>
                  {STATUS_LABELS[a.actionStatus] ?? a.actionStatus}
                </span>
              </div>
            ))}
          </div>

          {/* 信号快录 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setQuickOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 transition-colors"
            >
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                </span>
                录入信号
              </span>
              <span className="text-slate-600 text-xs">{quickOpen ? '收起' : '展开'}</span>
            </button>
            {quickOpen && (
              <div className="px-4 pb-3 space-y-2 border-t border-slate-800 pt-3">
                <select
                  value={quickType}
                  onChange={e => setQuickType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="demand">需求</option>
                  <option value="risk">风险</option>
                  <option value="opportunity">商机</option>
                  <option value="info">信息</option>
                  <option value="blocker">阻塞</option>
                </select>
                <textarea
                  value={quickText}
                  onChange={e => setQuickText(e.target.value)}
                  placeholder="描述信号内容..."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                />
                <button
                  disabled={!quickText.trim() || quickLoading}
                  onClick={async () => {
                    if (!quickText.trim()) return
                    setQuickLoading(true)
                    await fetch('/api/signals', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sourceType: 'manual', rawContent: `[${quickType}] ${quickText}` }),
                    })
                    setQuickText('')
                    setQuickOpen(false)
                    setQuickLoading(false)
                    loadData()
                  }}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
                >
                  {quickLoading ? '录入中...' : '确认录入'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // ─── 渲染 ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <style>{`
        @keyframes fadein-up {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fadein-up { animation: fadein-up 0.35s ease both; }
        @keyframes layer-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .layer-row { animation: layer-in 0.4s ease both; }
        .layer-row:nth-child(1) { animation-delay: 0.05s; }
        .layer-row:nth-child(2) { animation-delay: 0.1s; }
        .layer-row:nth-child(3) { animation-delay: 0.15s; }
        .layer-row:nth-child(4) { animation-delay: 0.2s; }
        .layer-row:nth-child(5) { animation-delay: 0.25s; }
        .layer-row:nth-child(6) { animation-delay: 0.3s; }
        @keyframes flow-dot {
          0%   { opacity: 0.15; transform: scale(0.6); }
          50%  { opacity: 1;    transform: scale(1.15); }
          100% { opacity: 0.15; transform: scale(0.6); }
        }
        .flow-dot { animation: flow-dot 1.2s ease-in-out infinite; }
      `}</style>

      {/* 顶部标题栏 */}
      <div className="shrink-0 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">经营概览</h1>
          <p className="text-xs text-slate-600 mt-0.5">管理层 · 商机健康 × AI 效率 × 知识沉淀</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 系统状态 */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </div>
            <span className="text-xs text-emerald-400">系统运行中</span>
          </div>
          {/* Ticker */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs max-w-xs overflow-hidden">
            <span className="text-slate-700">›</span>
            <span key={tickerIdx} className="fadein-up truncate text-slate-500">{TICKER_ITEMS[tickerIdx]}</span>
          </div>
          {/* 模式切换 */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setMode('control')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${mode === 'control' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              控制台
            </button>
            <button
              onClick={() => setMode('scene')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${mode === 'scene' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              场景图
            </button>
          </div>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden">

        {/* ═══════════════ 控制台模式 ═══════════════ */}
        {mode === 'control' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

              {/* 运转链路横向仪表 */}
              <div className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="px-5 py-2.5 border-b border-slate-800 flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">系统运转链路</span>
                  <span className="text-[10px] text-slate-700">· 实时状态</span>
                </div>
                <div className="flex divide-x divide-slate-800">
                  {/* 感知节点 */}
                  <div className="flex-1 px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-mono text-indigo-500/70">01</span>
                      <span className="text-sm font-semibold text-slate-200">感知</span>
                      <span className="text-[10px] text-slate-600 ml-1">原始信号捕捉</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-3xl font-black font-mono text-indigo-400">{signals.length}</span>
                      <span className="text-xs text-slate-500">条信号</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {Object.entries(data.signalsByType).slice(0,3).map(([type, count]) => (
                        <span key={type} className="text-[10px] text-slate-500">
                          {SIGNAL_LABELS[type] ?? type} <span style={{ color: SIGNAL_COLORS[type] ?? '#64748b' }} className="font-medium">{count}</span>
                        </span>
                      ))}
                    </div>
                    {unboundSignals.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                        </span>
                        <span className="text-[10px] text-amber-400">{unboundSignals.length} 待归属</span>
                      </div>
                    )}
                  </div>

                  {/* 箭头 */}
                  <div className="flex items-center justify-center w-8 shrink-0 bg-slate-900/40">
                    <div className="flex items-center gap-0.5">
                      {[0,1,2].map(i => (
                        <div key={i} className="flow-dot w-1 h-1 rounded-full bg-indigo-500/60" style={{ animationDelay: `${i * 0.3}s` }} />
                      ))}
                      <span className="text-[10px] text-indigo-500/60 ml-0.5">›</span>
                    </div>
                  </div>

                  {/* 理解节点 */}
                  <div className="flex-1 px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-mono text-purple-500/70">02</span>
                      <span className="text-sm font-semibold text-slate-200">理解</span>
                      <span className="text-[10px] text-slate-600 ml-1">归属分析</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-3xl font-black font-mono text-purple-400">{boundSignals.length}</span>
                      <span className="text-xs text-slate-500">/ {signals.length} 已归属</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                        style={{ width: signals.length > 0 ? `${Math.round(boundSignals.length / signals.length * 100)}%` : '0%' }} />
                    </div>
                    <span className="text-[10px] text-slate-600 mt-1 block">
                      归属率 {signals.length > 0 ? Math.round(boundSignals.length / signals.length * 100) : 0}%
                    </span>
                  </div>

                  {/* 箭头 */}
                  <div className="flex items-center justify-center w-8 shrink-0 bg-slate-900/40">
                    <div className="flex items-center gap-0.5">
                      {[0,1,2].map(i => (
                        <div key={i} className="flow-dot w-1 h-1 rounded-full bg-purple-500/60" style={{ animationDelay: `${i * 0.3 + 0.15}s` }} />
                      ))}
                      <span className="text-[10px] text-purple-500/60 ml-0.5">›</span>
                    </div>
                  </div>

                  {/* 决策节点 */}
                  <div className="flex-1 px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-mono text-violet-500/70">03</span>
                      <span className="text-sm font-semibold text-slate-200">决策</span>
                      <span className="text-[10px] text-slate-600 ml-1">Agent 分析</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-3xl font-black font-mono text-violet-400">{data.acceptRate}%</span>
                      <span className="text-xs text-slate-500">建议采纳率</span>
                    </div>
                    {data.runningAgentCount > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500" />
                        </span>
                        <span className="text-[10px] text-violet-400">{data.runningAgentCount} Agent 运行中</span>
                      </div>
                    )}
                  </div>

                  {/* 箭头 */}
                  <div className="flex items-center justify-center w-8 shrink-0 bg-slate-900/40">
                    <div className="flex items-center gap-0.5">
                      {[0,1,2].map(i => (
                        <div key={i} className="flow-dot w-1 h-1 rounded-full bg-teal-500/60" style={{ animationDelay: `${i * 0.3 + 0.3}s` }} />
                      ))}
                      <span className="text-[10px] text-teal-500/60 ml-0.5">›</span>
                    </div>
                  </div>

                  {/* 行动节点 */}
                  <div className="flex-1 px-5 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-mono text-teal-500/70">04</span>
                      <span className="text-sm font-semibold text-slate-200">行动</span>
                      <span className="text-[10px] text-slate-600 ml-1">执行产出</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-3xl font-black font-mono text-amber-400">{pendingApproval}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">待审批</p>
                      </div>
                      <div>
                        <span className="text-2xl font-bold font-mono text-emerald-400">{completedActions}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">已完成</p>
                      </div>
                    </div>
                    {pendingApproval > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                        </span>
                        <span className="text-[10px] text-amber-400">需要审批</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 三大管理指标 */}
              <div className="grid grid-cols-3 gap-4 flex-1">

                {/* 商机管道 */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">商机管道</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className={`text-4xl font-black font-mono ${healthScoreColor(data.avgHealthScore)}`}>{Math.round(data.avgHealthScore)}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">全局健康均分</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${data.avgHealthScore >= 70 ? 'bg-emerald-500' : data.avgHealthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.round(data.avgHealthScore)}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div><span className="text-slate-300 font-bold">{data.workspaceCount}</span> <span className="text-slate-600">活跃商机</span></div>
                    <div><span className="text-emerald-400 font-bold">{data.wonCount}</span> <span className="text-slate-600">赢单</span></div>
                    <div><span className="text-red-400 font-bold">{data.lostCount}</span> <span className="text-slate-600">输单</span></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-600 mb-2">高风险商机</p>
                    {data.highRiskWorkspaces.length === 0 ? (
                      <p className="text-xs text-slate-700">暂无高风险商机</p>
                    ) : data.highRiskWorkspaces.slice(0,4).map(w => (
                      <Link key={w.id} href={`/workspace/${w.id}`} className="flex items-center justify-between py-1 hover:bg-slate-800/50 rounded px-1 -mx-1 group">
                        <span className="text-xs text-slate-400 truncate max-w-[120px]">{w.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold ${healthScoreColor(w.healthScore)}`}>{Math.round(w.healthScore)}</span>
                          <span className="text-xs text-red-400">风险{Math.round(w.riskScore)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* AI 效率 */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">AI 效率</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-4xl font-black font-mono text-violet-400">{data.acceptRate}%</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">建议采纳率</p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-2xl font-bold font-mono text-amber-400">{pendingApproval}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">待审批</p>
                      <p className="text-lg font-bold font-mono text-emerald-400 mt-1">{completedActions}</p>
                      <p className="text-[10px] text-slate-500">已完成</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-600 mb-2">各 Agent 采纳率</p>
                    <div className="space-y-1.5">
                      {data.agentEffectiveness.filter(a => a.totalRuns > 0).slice(0,5).map(a => (
                        <div key={a.agentType} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-16 shrink-0 truncate">{a.agentLabel}</span>
                          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500/60" style={{ width: `${a.acceptRate}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-violet-400 shrink-0">{a.acceptRate}%</span>
                        </div>
                      ))}
                      {data.agentEffectiveness.filter(a => a.totalRuns > 0).length === 0 && (
                        <p className="text-xs text-slate-700">暂无运行数据</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 知识沉淀 */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">知识沉淀</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-4xl font-black font-mono text-amber-400">{data.activeRulesCount}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">生效规则</p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-2xl font-bold font-mono text-teal-400">{assetCount}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">知识资产</p>
                      <p className="text-lg font-bold font-mono text-rose-400 mt-1">{correctedCount}</p>
                      <p className="text-[10px] text-slate-500">纠偏次数</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-600 mb-2">反馈分布（共 {totalFeedback} 条）</p>
                    {totalFeedback > 0 ? (
                      <div className="space-y-1.5">
                        {Object.entries(data.feedbackByLabel).map(([label, count]) => {
                          const pct = Math.round((count as number) / totalFeedback * 100)
                          const color = label === 'approved' ? '#22c55e' : label === 'modified' ? '#f59e0b' : label === 'rejected' ? '#ef4444' : '#64748b'
                          const labelText = label === 'approved' ? '采纳' : label === 'modified' ? '修改' : label === 'rejected' ? '驳回' : label
                          return (
                            <div key={label} className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 w-8 shrink-0">{labelText}</span>
                              <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                              <span className="text-[10px] font-mono shrink-0" style={{ color }}>{count as number}</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-700">暂无反馈数据</p>
                    )}
                  </div>
                </div>

              </div>

            </div>
            <BattlePanel />
          </>
        )}

        {/* ═══════════════ 场景图模式 ═══════════════ */}
        {mode === 'scene' && (
          <>
            <SceneView />
            <BattlePanel />
          </>
        )}

      </div>
    </div>
  )
}
