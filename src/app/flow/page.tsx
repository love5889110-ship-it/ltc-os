'use client'

import { useState, useEffect } from 'react'
import {
  Mic, Cpu, GitBranch, Zap, Bot, Radio, BookOpen,
  ArrowRight, Shield, TrendingUp, Database,
  CheckCircle, ExternalLink,
  Wrench, ChevronDown, ChevronUp, Users,
  AlertTriangle, Activity, FileText, Package,
  HardHat, BarChart2,
} from 'lucide-react'
import { PageGuide } from '@/components/ui/page-guide'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import Link from 'next/link'

// ─── 数据常量 ──────────────────────────────────────────────────────────────

const SIGNAL_FLOW = [
  { id: 'connectors', label: '连接器', sublabel: '6种来源', icon: Radio, role: 'human', desc: 'Get笔记录音、钉钉群、文件OCR、录音上传、微信代理、手动输入' },
  { id: 'input', label: '录入', sublabel: '30秒~2分钟', icon: Mic, role: 'human', desc: '销售沟通后任意连接器录入，这是唯一高频人工操作' },
  { id: 'normalize', label: 'AI 理解', sublabel: '全自动', icon: Cpu, role: 'ai', desc: '识别信号类型、优先级、实体（客户/竞品/金额/节点）、风险标记' },
  { id: 'bind', label: '归属商机', sublabel: '3秒确认', icon: GitBranch, role: 'hybrid', desc: '置信度 ≥92% 全自动绑定；低于92% 才需要你 3 秒点确认' },
  { id: 'trigger', label: '触发分析', sublabel: '全自动', icon: Zap, role: 'ai', desc: '信号绑定后自动触发 Agent，另有阶段变更/定时/执行回调触发' },
]

const AGENTS_DATA = [
  { type: 'sales_copilot',      label: '销售 Agent',     color: 'bg-blue-500',   textColor: 'text-blue-300',   lightBg: 'bg-blue-950/60',   border: 'border-blue-700' },
  { type: 'presales_assistant', label: '解决方案 Agent', color: 'bg-indigo-500', textColor: 'text-indigo-300', lightBg: 'bg-indigo-950/60', border: 'border-indigo-700' },
  { type: 'tender_assistant',   label: '招标 Agent',     color: 'bg-cyan-500',   textColor: 'text-cyan-300',   lightBg: 'bg-cyan-950/60',   border: 'border-cyan-700' },
  { type: 'commercial',         label: '商务 Agent',     color: 'bg-teal-500',   textColor: 'text-teal-300',   lightBg: 'bg-teal-950/60',   border: 'border-teal-700' },
  { type: 'handover',           label: '交付 Agent',     color: 'bg-green-500',  textColor: 'text-green-300',  lightBg: 'bg-green-950/60',  border: 'border-green-700' },
  { type: 'service_triage',     label: '服务 Agent',     color: 'bg-orange-500', textColor: 'text-orange-300', lightBg: 'bg-orange-950/60', border: 'border-orange-700' },
  { type: 'asset_governance',   label: '资产管理 Agent', color: 'bg-rose-500',   textColor: 'text-rose-300',   lightBg: 'bg-rose-950/60',   border: 'border-rose-700' },
]

const KNOWLEDGE_BASES = [
  { id: 'rules', icon: Shield, label: '规则库', color: 'amber', note: '每次运行前注入' },
  { id: 'assets', icon: BookOpen, label: '资产库', color: 'green', note: '按阶段 top-5 注入' },
  { id: 'cross', icon: Bot, label: '跨Agent上下文', color: 'cyan', note: '其他Agent最新摘要' },
]

// 执行层完整产出定义
const EXECUTION_OUTPUTS = [
  {
    stage: '需求/方案阶段', color: 'indigo',
    outputs: ['解决方案文稿（AI 生成，含案例背书）', '差异化对比文档', '立项建议报告'],
    agent: '解决方案 Agent',
  },
  {
    stage: '招投标阶段', color: 'cyan',
    outputs: ['投标响应文件（AI 生成全文）', '技术方案章节', '合规性检查报告'],
    agent: '招标 Agent',
  },
  {
    stage: '商务阶段', color: 'teal',
    outputs: ['报价邮件草稿', '合同条款风险清单', '价格谈判策略建议'],
    agent: '商务 Agent',
  },
  {
    stage: '合同/交付阶段', color: 'green',
    outputs: ['项目交接包（销售→交付完整信息）', '交付风险清单', '硬件部署确认单'],
    agent: '交付 Agent',
  },
]

const ROLE_GUIDES = [
  {
    key: 'sales', label: '销售', icon: Users, color: 'blue',
    actions: ['录入信号（30秒）', '确认信号归属（偶尔3秒）', '审批 AI 建议（1分钟）', '发送草稿'],
    links: [{ label: '信号台', href: '/inbox' }, { label: '战场总览', href: '/workspace' }],
  },
  {
    key: 'presales', label: '售前经理', icon: Package, color: 'indigo',
    actions: ['审批方案相关 AI 建议', '管理知识资产（案例/话术/方案）', '完成方案交付任务'],
    links: [{ label: '战场总览', href: '/workspace' }, { label: '资产库', href: '/assets' }],
  },
  {
    key: 'delivery', label: '交付经理', icon: HardHat, color: 'green',
    actions: ['接收 AI 生成的项目交接包', '确认交付边界和客户承诺', '处理售后工单', '识别续约/增购机会'],
    links: [{ label: '战场总览', href: '/workspace' }, { label: '任务中心', href: '/tasks' }],
  },
  {
    key: 'manager', label: '管理层', icon: BarChart2, color: 'emerald',
    actions: ['每日 5 分钟查看全局健康度', '关注高风险战场介入', '每周复盘规则治理'],
    links: [{ label: '总控台', href: '/flow' }, { label: '进化中心', href: '/evolution' }],
  },
]

// ─── 主组件 ────────────────────────────────────────────────────────────────

interface DashboardData {
  avgHealthScore: number
  runningAgentCount: number
  pendingActionCount: number
  activeRulesCount: number
  acceptRate: number
  highRiskWorkspaces: Array<{ id: string; name: string; healthScore: number; riskScore: number }>
  agentEffectiveness: Array<{ agentType: string; agentLabel: string; totalRuns: number; acceptRate: number }>
}

export default function FlowPage() {
  const [animDots, setAnimDots] = useState([0, 3, 6])
  const [runningAgentIdxs, setRunningAgentIdxs] = useState<number[]>([0])
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)

  const [liveStatus, setLiveStatus] = useState<{
    pendingSignals: number; runningAgents: number; pendingActions: number; skillCount: number
  } | null>(null)
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [recentLogs, setRecentLogs] = useState<Array<{ agentLabel: string; workspaceName: string; actionTitle: string; status: string }>>([
    { agentLabel: '销售 Agent', workspaceName: '大同煤矿项目', actionTitle: '竞品风险预警', status: 'risk' },
    { agentLabel: '解决方案 Agent', workspaceName: '国能集团项目', actionTitle: '输出技术方案文稿', status: 'done' },
    { agentLabel: '招标 Agent', workspaceName: '阳光电源项目', actionTitle: '生成投标响应文件', status: 'done' },
    { agentLabel: '商务 Agent', workspaceName: '华润电力项目', actionTitle: '生成报价草稿', status: 'done' },
    { agentLabel: '交付 Agent', workspaceName: '中煤能源项目', actionTitle: '生成项目交接包', status: 'done' },
  ])

  // 多粒子动画
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimDots(prev => prev.map(d => (d + 1) % (SIGNAL_FLOW.length + 3)))
    }, 600)
    return () => clearInterval(interval)
  }, [])

  // Agent 脉冲
  useEffect(() => {
    const interval = setInterval(() => {
      const total = AGENTS_DATA.length
      const count = Math.random() > 0.4 ? 2 : 1
      const idxs: number[] = []
      while (idxs.length < count) {
        const r = Math.floor(Math.random() * total)
        if (!idxs.includes(r)) idxs.push(r)
      }
      setRunningAgentIdxs(idxs)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // 数据加载
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [sRes, wRes, skRes, dRes] = await Promise.all([
          fetch('/api/signals?status=pending_confirm&limit=100'),
          fetch('/api/workspaces?limit=50'),
          fetch('/api/skill-templates'),
          fetch('/api/dashboard'),
        ])
        const sData = sRes.ok ? await sRes.json() : {}
        const wData = wRes.ok ? await wRes.json() : {}
        const skData = skRes.ok ? await skRes.json() : {}
        const dData = dRes.ok ? await dRes.json() : null

        const workspaces = wData.workspaces ?? []
        const AGENT_LABELS: Record<string, string> = {
          sales_copilot: '销售 Agent', presales_assistant: '解决方案 Agent',
          tender_assistant: '招标 Agent', commercial: '商务 Agent',
          handover: '交付 Agent', service_triage: '服务 Agent', asset_governance: '资产管理 Agent',
        }
        const logs = workspaces.flatMap((w: any) =>
          (w.recentCompletedActions ?? []).map((a: any) => ({
            agentLabel: AGENT_LABELS[a.agentType] ?? a.agentType,
            workspaceName: w.name ?? '未知项目',
            actionTitle: a.title ?? a.actionType,
            status: a.actionStatus === 'failed' ? 'risk' : 'done',
          }))
        ).slice(0, 10)
        if (logs.length > 0) setRecentLogs(logs)

        setLiveStatus({
          pendingSignals: sData.total ?? 0,
          runningAgents: workspaces.reduce((s: number, w: any) => s + (w.runningAgentCount ?? 0), 0),
          pendingActions: workspaces.reduce((s: number, w: any) => s + (w.pendingActionCount ?? 0), 0),
          skillCount: (skData.templates ?? []).filter((t: any) => t.enabled).length,
        })

        if (dData) setDashData(dData)
      } catch { /* ignore */ }
    }
    loadAll()
    const interval = setInterval(loadAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const healthColor = (score: number) =>
    score >= 70 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
  const healthBarColor = (score: number) =>
    score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      <style>{`
        @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fadeslide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <Breadcrumb items={[{ label: '治理配置' }, { label: '系统总控台' }]} />
      <PageGuide storageKey="flow" contents={{ all: { roleLabel: '全员', purpose: 'AI 原生系统总控台 — 运转全景 + 实时战场', whenToUse: '了解系统运作逻辑，或需要快速定位高风险战场', aiAlreadyDid: '实时汇总全局商机健康度、Agent运行状态、执行日志', youDecide: '从高风险战场下钻介入，或查看各角色工作流', nextStepLabel: '进入战场总览', nextStepHref: '/workspace' } }} />

      <div className="bg-slate-950 rounded-2xl p-4 space-y-3" style={{ animation: 'fadeslide 0.3s ease-out' }}>

        {/* 顶部状态栏 */}
        <div className="flex items-center gap-4 flex-wrap pb-3 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-slate-300 text-xs font-mono font-semibold">系统运行中</span>
          </div>
          {liveStatus ? (
            <>
              <Stat dot="green" value={liveStatus.runningAgents} label="Agent 运行中" pulse />
              <Stat dot="yellow" value={liveStatus.pendingSignals} label="信号待确认" />
              <Stat dot="orange" value={liveStatus.pendingActions} label="动作待审批" />
              {liveStatus.skillCount > 0 && <Stat dot="purple" value={liveStatus.skillCount} label="技能已上架" />}
            </>
          ) : (
            <span className="text-slate-600 text-xs">加载中...</span>
          )}
          {dashData && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-slate-500">全局健康度</span>
              <span className={`text-xl font-black font-mono ${healthColor(Math.round(dashData.avgHealthScore))}`}>
                {Math.round(dashData.avgHealthScore)}
              </span>
              <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${healthBarColor(Math.round(dashData.avgHealthScore))}`} style={{ width: `${dashData.avgHealthScore}%` }} />
              </div>
            </div>
          )}
          <span className="text-slate-700 text-xs">每30秒刷新</span>
          <Link href="/dashboard" className="ml-auto flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded-lg transition-colors">
            进入总控台 →
          </Link>
        </div>

        {/* 执行日志 ticker */}
        <div className="overflow-hidden bg-slate-900 rounded-lg px-3 py-1.5 flex items-center gap-2 border border-slate-800">
          <span className="text-[10px] text-slate-600 flex-shrink-0 font-mono uppercase tracking-wider">实时执行</span>
          <div className="overflow-hidden flex-1 relative h-4">
            <div className="flex gap-8 absolute whitespace-nowrap" style={{ animation: 'ticker-scroll 30s linear infinite' }}>
              {[...recentLogs, ...recentLogs].map((log, idx) => (
                <span key={idx} className="text-[11px] flex-shrink-0">
                  <span className="text-cyan-400">{log.agentLabel}</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className="text-slate-400">{log.workspaceName}</span>
                  <span className="text-slate-600 mx-1">·</span>
                  <span className={log.status === 'risk' ? 'text-orange-400' : 'text-green-400'}>
                    {log.actionTitle} {log.status === 'risk' ? '⚡' : '✓'}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 主体：左右两栏 */}
        <div className="grid grid-cols-5 gap-4">

          {/* 左侧：系统运转主干 (3/5) */}
          <div className="col-span-3 space-y-0">

            {/* ① 感知层 */}
            <LayerBlock number="01" color="blue" title="感知" tagline="外部信号 → AI自动理解 → 绑定商机"
              humanBadge="录入 30秒" aiBadge="全自动标准化"
              expanded={expandedLayer === 'perception'} onToggle={() => setExpandedLayer(expandedLayer === 'perception' ? null : 'perception')}>
              <div className="flex items-start gap-0.5 mt-2.5">
                {SIGNAL_FLOW.map((node, i) => {
                  const Icon = node.icon
                  const isAnim = animDots.some(d => d === i)
                  const isHuman = node.role === 'human'; const isHybrid = node.role === 'hybrid'
                  return (
                    <div key={node.id} className="flex items-start flex-1 min-w-0">
                      <div className={`flex-1 flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all duration-300 ${isAnim ? 'bg-blue-600/80 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]' : 'bg-slate-800 border-slate-700'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isAnim ? 'bg-blue-400' : isHuman ? 'bg-slate-600' : isHybrid ? 'bg-indigo-700' : 'bg-slate-600'}`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-[10px] font-medium text-slate-200 text-center leading-tight">{node.label}</span>
                        <span className={`text-[9px] ${isHuman ? 'text-amber-400' : isHybrid ? 'text-indigo-400' : 'text-cyan-400'}`}>{node.sublabel}</span>
                      </div>
                      {i < SIGNAL_FLOW.length - 1 && (
                        <div className="flex items-center justify-center w-3 pt-3 flex-shrink-0 relative">
                          <ArrowRight className={`w-2.5 h-2.5 transition-colors ${animDots.some(d => d === i || d === i + 1) ? 'text-blue-400' : 'text-slate-700'}`} />
                          {animDots.some(d => d === i) && <span className="absolute w-1 h-1 bg-blue-400 rounded-full animate-ping" style={{ top: '11px' }} />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {expandedLayer === 'perception' && (
                <div className="mt-2 grid grid-cols-5 gap-1" style={{ animation: 'fadeslide 0.2s ease-out' }}>
                  {SIGNAL_FLOW.map(node => (
                    <div key={node.id} className="bg-slate-900 rounded-lg p-1.5 border border-slate-800">
                      <p className="text-[9px] font-semibold text-slate-400 mb-0.5">{node.label}</p>
                      <p className="text-[9px] text-slate-500 leading-relaxed">{node.desc}</p>
                    </div>
                  ))}
                </div>
              )}
            </LayerBlock>

            <Connector label="信号绑定 → 自动触发 Agent 分析" />

            {/* ② 思考层 */}
            <LayerBlock number="02" color="cyan" title="思考" tagline="7个数字员工并行分析，3类知识库实时注入"
              humanBadge="无需介入" aiBadge="全自动并行"
              expanded={expandedLayer === 'thinking'} onToggle={() => setExpandedLayer(expandedLayer === 'thinking' ? null : 'thinking')}>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {/* 知识库 */}
                <div className="space-y-1">
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono mb-1">注入上下文</p>
                  {KNOWLEDGE_BASES.map(kb => {
                    const Icon = kb.icon
                    const c: Record<string, string> = { amber: 'border-amber-800/60 bg-amber-950/30 text-amber-400', green: 'border-green-800/60 bg-green-950/30 text-green-400', cyan: 'border-cyan-800/60 bg-cyan-950/30 text-cyan-400' }
                    return (
                      <div key={kb.id} className={`rounded-lg border p-1.5 ${c[kb.color]}`}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <Icon className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-semibold">{kb.label}</span>
                        </div>
                        <p className="text-[9px] text-slate-500">{kb.note}</p>
                      </div>
                    )
                  })}
                </div>
                {/* Agent 矩阵 */}
                <div className="bg-gradient-to-b from-cyan-950/80 to-slate-900 rounded-xl border border-cyan-800/60 p-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Bot className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                    <span className="text-[11px] font-semibold text-cyan-300">AI 数字员工</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {AGENTS_DATA.slice(0, 6).map((a, idx) => {
                      const isR = runningAgentIdxs.includes(idx)
                      return (
                        <div key={a.type} className={`text-[9px] px-1 py-0.5 rounded text-center relative ${a.lightBg} ${a.textColor} border ${a.border} ${isR ? 'ring-1 ring-green-500/50' : ''}`}>
                          {isR && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                          {a.label}
                        </div>
                      )
                    })}
                  </div>
                  <div className={`text-[9px] px-1 py-0.5 rounded text-center mt-1 relative ${AGENTS_DATA[6].lightBg} ${AGENTS_DATA[6].textColor} border ${AGENTS_DATA[6].border} ${runningAgentIdxs.includes(6) ? 'ring-1 ring-green-500/50' : ''}`}>
                    {runningAgentIdxs.includes(6) && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                    {AGENTS_DATA[6].label}
                  </div>
                </div>
                {/* 输出类型 */}
                <div className="space-y-1">
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono mb-1">分析输出</p>
                  <div className="bg-violet-950/50 border border-violet-800/60 rounded-lg p-1.5">
                    <p className="text-[9px] font-semibold text-violet-300 mb-0.5">决策判断</p>
                    {['阶段评估', '风险预警', '机会识别', '阻塞点分析'].map(d => <p key={d} className="text-[9px] text-slate-500">· {d}</p>)}
                  </div>
                  <div className="bg-emerald-950/50 border border-emerald-800/60 rounded-lg p-1.5">
                    <p className="text-[9px] font-semibold text-emerald-300 mb-0.5">行动建议</p>
                    {['生成文稿/方案/标书', '创建任务', '升级上报'].map(a => <p key={a} className="text-[9px] text-slate-500">· {a}</p>)}
                  </div>
                </div>
              </div>
            </LayerBlock>

            <Connector label="AI 建议 → 人工 1 分钟审批 → 自动执行" />

            {/* ③ 执行层 */}
            <LayerBlock number="03" color="amber" title="执行" tagline="AI 按阶段自动产出文稿、任务、快照，审批后立即执行"
              humanBadge="人工审批 ~1分钟" aiBadge="按阶段自动产出"
              expanded={expandedLayer === 'execution'} onToggle={() => setExpandedLayer(expandedLayer === 'execution' ? null : 'execution')}>
              <div className="mt-2.5 space-y-1.5">
                {/* 产出分类 */}
                <div className="grid grid-cols-2 gap-1.5">
                  {EXECUTION_OUTPUTS.map(group => {
                    const colorMap: Record<string, string> = {
                      indigo: 'border-indigo-800/60 bg-indigo-950/40',
                      cyan: 'border-cyan-800/60 bg-cyan-950/40',
                      teal: 'border-teal-800/60 bg-teal-950/40',
                      green: 'border-green-800/60 bg-green-950/40',
                    }
                    const textMap: Record<string, string> = {
                      indigo: 'text-indigo-300', cyan: 'text-cyan-300', teal: 'text-teal-300', green: 'text-green-300',
                    }
                    return (
                      <div key={group.stage} className={`rounded-lg border p-2 ${colorMap[group.color]}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[9px] font-semibold ${textMap[group.color]}`}>{group.stage}</span>
                          <span className="text-[9px] text-slate-600">{group.agent}</span>
                        </div>
                        {group.outputs.map(o => (
                          <div key={o} className="flex items-start gap-1">
                            <FileText className="w-2.5 h-2.5 text-slate-600 mt-0.5 flex-shrink-0" />
                            <span className="text-[9px] text-slate-400">{o}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
                {/* 通用产出 + 技能扩展 */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2">
                    <p className="text-[9px] font-semibold text-slate-400 mb-1">通用产出（所有阶段）</p>
                    {['任务创建（分配责任人/截止日）', '商机状态快照', '升级上报通知', '执行日志记录'].map(o => (
                      <div key={o} className="flex items-start gap-1">
                        <CheckCircle className="w-2.5 h-2.5 text-slate-600 mt-0.5 flex-shrink-0" />
                        <span className="text-[9px] text-slate-400">{o}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/settings?tab=skills" className="bg-purple-950/50 border border-purple-700/60 rounded-lg p-2 hover:bg-purple-900/50 transition-colors block">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wrench className="w-3 h-3 text-purple-400" />
                      <span className="text-[9px] font-semibold text-purple-300">技能工坊扩展</span>
                    </div>
                    <p className="text-[9px] text-slate-500">默认只能 创建任务/生成草稿</p>
                    <p className="text-[9px] text-purple-400 mt-0.5">训练技能后：可调用 CRM / ERP / 飞书 / 任意外部 API</p>
                    <p className="text-[9px] text-slate-600 mt-1 flex items-center gap-0.5">进入训练 <ExternalLink className="w-2 h-2" /></p>
                  </Link>
                </div>
              </div>
            </LayerBlock>

            <Connector label="每次纠偏沉淀为知识，规则即时生效" />

            {/* ④ 进化层 */}
            <LayerBlock number="04" color="rose" title="进化" tagline="每次纠偏让系统更懂你 — 越用越强"
              humanBadge="运营复盘 30分钟/周" aiBadge="规则即时生效"
              expanded={expandedLayer === 'evolution'} onToggle={() => setExpandedLayer(expandedLayer === 'evolution' ? null : 'evolution')}>
              <div className="mt-2.5 flex items-center gap-1.5">
                {[
                  { icon: Database, label: '反馈样本', note: '改写/驳回自动记录', color: 'rose' },
                  { icon: TrendingUp, label: '运营复盘', note: '识别 AI 反复犯的错', color: 'rose' },
                  { icon: Shield, label: '提炼规则', note: '5分钟写一条规则', color: 'amber' },
                  { icon: Cpu, label: '即时注入', note: '下次运行立即生效', color: 'blue' },
                ].map((node, i) => {
                  const Icon = node.icon
                  const c: Record<string, string> = { rose: 'border-rose-800 bg-rose-950/50 text-rose-300', amber: 'border-amber-800 bg-amber-950/50 text-amber-300', blue: 'border-blue-800 bg-blue-950/50 text-blue-300' }
                  return (
                    <div key={node.label} className="flex items-center flex-1 min-w-0">
                      <div className={`flex-1 flex flex-col items-center gap-0.5 p-2 rounded-xl border ${c[node.color]} text-center`}>
                        <Icon className="w-3.5 h-3.5" />
                        <p className="text-[10px] font-semibold">{node.label}</p>
                        <p className="text-[9px] text-slate-500 leading-tight">{node.note}</p>
                      </div>
                      {i < 3 && <ArrowRight className="w-2.5 h-2.5 text-slate-700 flex-shrink-0 mx-0.5" />}
                    </div>
                  )
                })}
                <div className="text-[9px] text-slate-700 flex-shrink-0 ml-1 leading-tight text-center">↑<br />规则库<br />更新</div>
              </div>
            </LayerBlock>

            {/* 各角色工作流折叠 */}
            <div className="mt-3 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <button onClick={() => setExpandedLayer(expandedLayer === 'roles' ? null : 'roles')}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-400">各角色工作流 — 你只需做什么</span>
                </div>
                {expandedLayer === 'roles' ? <ChevronUp className="w-3.5 h-3.5 text-slate-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600" />}
              </button>
              {expandedLayer === 'roles' && (
                <div className="px-3 pb-3 space-y-2" style={{ animation: 'fadeslide 0.2s ease-out' }}>
                  {ROLE_GUIDES.map(role => {
                    const Icon = role.icon
                    const colorMap: Record<string, string> = { blue: 'text-blue-300 border-blue-800', indigo: 'text-indigo-300 border-indigo-800', green: 'text-green-300 border-green-800', emerald: 'text-emerald-300 border-emerald-800' }
                    const isExp = expandedRole === role.key
                    return (
                      <div key={role.key} className="bg-slate-800/50 rounded-lg overflow-hidden border border-slate-700/50">
                        <button onClick={() => setExpandedRole(isExp ? null : role.key)}
                          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-700/30 transition-colors text-left">
                          <Icon className={`w-3.5 h-3.5 ${colorMap[role.color].split(' ')[0]}`} />
                          <span className={`text-xs font-semibold ${colorMap[role.color].split(' ')[0]}`}>{role.label}</span>
                          <span className="text-[10px] text-slate-500 ml-1">{role.actions.slice(0, 2).join(' · ')}...</span>
                          <div className="ml-auto flex items-center gap-1">
                            {role.links.map(l => (
                              <Link key={l.href} href={l.href} onClick={e => e.stopPropagation()}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 hover:text-white transition-colors">
                                {l.label}
                              </Link>
                            ))}
                          </div>
                        </button>
                        {isExp && (
                          <div className="px-3 pb-2 space-y-1" style={{ animation: 'fadeslide 0.15s ease-out' }}>
                            {role.actions.map((a, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[role.color].split(' ')[0]} bg-slate-800 border ${colorMap[role.color].split(' ')[1]}`}>{i + 1}</span>
                                <span className="text-[10px] text-slate-400">{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 底部价值总结 */}
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-800">
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-amber-400/50" />人工操作</span>
                <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-cyan-400/50" />AI 自动</span>
                <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 rounded-full bg-indigo-400/50" />AI推荐+确认</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500">人工介入总时间</p>
                <p className="text-base font-black text-white">≤ 10 分钟 / 天</p>
              </div>
            </div>
          </div>

          {/* 右侧：实时战场面板 (2/5) */}
          <div className="col-span-2 space-y-3">
            {/* 高风险战场 */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-semibold text-slate-300">高风险战场</span>
                <Link href="/workspace" className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5">
                  全部 <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
              {dashData && dashData.highRiskWorkspaces.length > 0 ? (
                <div className="space-y-1.5">
                  {dashData.highRiskWorkspaces.slice(0, 5).map(ws => (
                    <Link key={ws.id} href={`/workspace/${ws.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:border-orange-700/60 hover:bg-slate-800 transition-all group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-slate-300 truncate group-hover:text-white">{ws.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-500">健康</span>
                            <span className={`text-[9px] font-bold ${healthColor(ws.healthScore ?? 0)}`}>{ws.healthScore ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-500">风险</span>
                            <span className="text-[9px] font-bold text-orange-400">{ws.riskScore ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden flex-shrink-0">
                        <div className={`h-full rounded-full ${healthBarColor(ws.healthScore ?? 0)}`} style={{ width: `${ws.healthScore ?? 0}%` }} />
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-orange-400 flex-shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-slate-600">
                  <CheckCircle className="w-5 h-5 mb-1 text-green-600" />
                  <span className="text-[10px]">暂无高风险战场</span>
                </div>
              )}
            </div>

            {/* 全局统计 */}
            {dashData && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-300">系统运行指标</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="AI 接受率" value={`${Math.round(dashData.acceptRate * 100)}%`} color="green" />
                  <StatCard label="生效规则数" value={String(dashData.activeRulesCount)} color="amber" />
                  <StatCard label="待审批动作" value={String(dashData.pendingActionCount)} color={dashData.pendingActionCount > 0 ? 'orange' : 'slate'} />
                  <StatCard label="运行中 Agent" value={String(dashData.runningAgentCount)} color={dashData.runningAgentCount > 0 ? 'cyan' : 'slate'} pulse={dashData.runningAgentCount > 0} />
                </div>
              </div>
            )}

            {/* Agent 效率 */}
            {dashData && dashData.agentEffectiveness && dashData.agentEffectiveness.length > 0 && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-slate-300">数字员工效率</span>
                </div>
                <div className="space-y-1.5">
                  {dashData.agentEffectiveness.slice(0, 4).map(ae => (
                    <div key={ae.agentType} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-20 truncate flex-shrink-0">{ae.agentLabel}</span>
                      <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round(ae.acceptRate * 100)}%` }} />
                      </div>
                      <span className="text-[9px] text-slate-500 w-8 text-right flex-shrink-0">{Math.round(ae.acceptRate * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 快捷导航 */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-3">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono mb-2">快速导航</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: '信号台', href: '/inbox', color: 'yellow' },
                  { label: '战场总览', href: '/workspace', color: 'blue' },
                  { label: '任务中心', href: '/tasks', color: 'green' },
                  { label: '草稿中心', href: '/drafts', color: 'indigo' },
                  { label: '资产库', href: '/assets', color: 'orange' },
                  { label: '进化中心', href: '/evolution', color: 'rose' },
                ].map(nav => {
                  const c: Record<string, string> = { yellow: 'hover:border-yellow-700/60 hover:text-yellow-300', blue: 'hover:border-blue-700/60 hover:text-blue-300', green: 'hover:border-green-700/60 hover:text-green-300', indigo: 'hover:border-indigo-700/60 hover:text-indigo-300', orange: 'hover:border-orange-700/60 hover:text-orange-300', rose: 'hover:border-rose-700/60 hover:text-rose-300' }
                  return (
                    <Link key={nav.href} href={nav.href}
                      className={`text-[10px] px-2 py-1.5 rounded-lg border border-slate-700 text-slate-400 flex items-center justify-between transition-all ${c[nav.color]}`}>
                      {nav.label}
                      <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 子组件 ────────────────────────────────────────────────────────────────

function Stat({ dot, value, label, pulse }: { dot: string; value: number; label: string; pulse?: boolean }) {
  const dotColors: Record<string, string> = { green: 'bg-green-400', yellow: 'bg-yellow-400', orange: 'bg-orange-400', purple: 'bg-purple-400', cyan: 'bg-cyan-400' }
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[dot] ?? 'bg-slate-500'} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-white text-xs font-medium">{value}</span>
      <span className="text-slate-500 text-xs">{label}</span>
    </div>
  )
}

function StatCard({ label, value, color, pulse }: { label: string; value: string; color: string; pulse?: boolean }) {
  const c: Record<string, string> = { green: 'text-green-400 bg-green-950/40 border-green-800/60', amber: 'text-amber-400 bg-amber-950/40 border-amber-800/60', orange: 'text-orange-400 bg-orange-950/40 border-orange-800/60', cyan: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60', slate: 'text-slate-500 bg-slate-800/40 border-slate-700' }
  return (
    <div className={`rounded-lg border p-2 ${c[color] ?? c.slate}`}>
      <p className="text-[9px] text-slate-500 mb-0.5">{label}</p>
      <p className={`text-base font-black ${c[color]?.split(' ')[0]} ${pulse ? 'animate-pulse' : ''}`}>{value}</p>
    </div>
  )
}

function LayerBlock({ number, color, title, tagline, humanBadge, aiBadge, expanded, onToggle, children }: {
  number: string; color: string; title: string; tagline: string
  humanBadge: string; aiBadge: string; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  const c: Record<string, { border: string; title: string; num: string; hover: string }> = {
    blue:  { border: 'border-blue-800/60',  title: 'text-blue-300',  num: 'text-blue-600',  hover: 'hover:bg-blue-900/20' },
    cyan:  { border: 'border-cyan-800/60',  title: 'text-cyan-300',  num: 'text-cyan-600',  hover: 'hover:bg-cyan-900/20' },
    amber: { border: 'border-amber-800/60', title: 'text-amber-300', num: 'text-amber-600', hover: 'hover:bg-amber-900/20' },
    rose:  { border: 'border-rose-800/60',  title: 'text-rose-300',  num: 'text-rose-600',  hover: 'hover:bg-rose-900/20' },
  }
  const col = c[color] ?? c.blue
  return (
    <div className={`bg-slate-900 rounded-xl border ${col.border} p-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          <span className={`text-xl font-black font-mono ${col.num} leading-none mt-0.5`}>{number}</span>
          <div>
            <h3 className={`text-sm font-bold ${col.title}`}>{title}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">{tagline}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] bg-amber-900/40 text-amber-400 border border-amber-800/50 px-1.5 py-0.5 rounded-full">{humanBadge}</span>
              <span className="text-[9px] bg-cyan-900/40 text-cyan-400 border border-cyan-800/50 px-1.5 py-0.5 rounded-full">⚡ {aiBadge}</span>
            </div>
          </div>
        </div>
        <button onClick={onToggle} className={`text-[9px] text-slate-500 flex items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors ${col.hover}`}>
          {expanded ? <><ChevronUp className="w-3 h-3" />收起</> : <><ChevronDown className="w-3 h-3" />展开</>}
        </button>
      </div>
      {children}
    </div>
  )
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0 py-1">
      <div className="w-px h-3 bg-gradient-to-b from-slate-700 to-slate-600" />
      <span className="text-[9px] text-slate-600 font-mono px-2 py-0.5 bg-slate-900 rounded-full border border-slate-800">{label}</span>
      <div className="w-px h-3 bg-gradient-to-b from-slate-600 to-slate-700" />
    </div>
  )
}
