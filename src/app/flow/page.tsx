'use client'

import { useState, useEffect } from 'react'
import {
  Mic, Cpu, GitBranch, Users, Zap, Bot, Radio, BookOpen,
  ArrowRight, Shield, TrendingUp, Database,
  CheckCircle, Layers, ExternalLink,
  Wrench, Package, ChevronDown, ChevronUp,
} from 'lucide-react'
import { PageGuide } from '@/components/ui/page-guide'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import Link from 'next/link'

// ─── 数据常量 ──────────────────────────────────────────────────────────────

const SIGNAL_FLOW = [
  { id: 'connectors', label: '连接器', sublabel: '6种来源', icon: Radio, role: 'human', desc: 'Get笔记录音、钉钉群、文件OCR、录音上传、微信代理、手动输入。持续监听，无需反复操作。' },
  { id: 'input', label: '信息录入', sublabel: '30秒~2分钟', icon: Mic, role: 'human', desc: '销售沟通完成后，任意连接器录入。这是人工的唯一高频操作。' },
  { id: 'normalize', label: 'AI 理解', sublabel: '全自动', icon: Cpu, role: 'ai', desc: 'AI 自动识别：信号类型、优先级、关键实体（客户/竞品/金额/时间节点）、风险标记。' },
  { id: 'bind', label: '归属商机', sublabel: '3秒确认', icon: GitBranch, role: 'hybrid', desc: '置信度 ≥92% 完全自动绑定；低于92% 才需要你 3 秒点确认。' },
  { id: 'trigger', label: '触发分析', sublabel: '全自动', icon: Zap, role: 'ai', desc: '信号绑定后自动触发 Agent。另有：阶段变更触发、每日健康检查、执行回调触发。' },
]

const AGENTS_DATA = [
  { type: 'sales_copilot',      label: '销售 Agent',      stage: '全阶段',    color: 'bg-blue-500',   textColor: 'text-blue-300',   lightBg: 'bg-blue-950/60',   border: 'border-blue-700',   desc: '监控商机健康度，识别停滞和竞品风险，驱动阶段推进' },
  { type: 'presales_assistant', label: '解决方案 Agent',  stage: '需求/方案', color: 'bg-indigo-500', textColor: 'text-indigo-300', lightBg: 'bg-indigo-950/60', border: 'border-indigo-700', desc: '结构化客户需求，推荐行业方案，匹配成功案例' },
  { type: 'tender_assistant',   label: '招标 Agent',      stage: '招投标',    color: 'bg-cyan-500',   textColor: 'text-cyan-300',   lightBg: 'bg-cyan-950/60',   border: 'border-cyan-700',   desc: '解析招标文件，识别控标风险，管理截止时间' },
  { type: 'commercial',         label: '商务 Agent',      stage: '商务谈判',  color: 'bg-teal-500',   textColor: 'text-teal-300',   lightBg: 'bg-teal-950/60',   border: 'border-teal-700',   desc: '报价策略建议，价格谈判辅助，合同条款风险识别' },
  { type: 'handover',           label: '交付 Agent',      stage: '合同/交付', color: 'bg-green-500',  textColor: 'text-green-300',  lightBg: 'bg-green-950/60',  border: 'border-green-700',  desc: '生成交接包，确认交付边界，防止信息断层' },
  { type: 'service_triage',     label: '服务 Agent',      stage: '售后服务',  color: 'bg-orange-500', textColor: 'text-orange-300', lightBg: 'bg-orange-950/60', border: 'border-orange-700', desc: '工单分类，识别续约风险，挖掘增购机会' },
  { type: 'asset_governance',   label: '资产管理 Agent',  stage: '全阶段',    color: 'bg-rose-500',   textColor: 'text-rose-300',   lightBg: 'bg-rose-950/60',   border: 'border-rose-700',   desc: '从赢单/输单案例提炼经验，管理话术资产' },
]

const KNOWLEDGE_BASES = [
  { id: 'rules', icon: Shield, label: '规则库', color: 'amber', items: ['竞品出现 → 立即预警', '需求阶段禁止发报价', '截标 <7天 → 紧急任务'], note: '每次 Agent 运行前动态注入' },
  { id: 'assets', icon: BookOpen, label: '资产库', color: 'green', items: ['产品介绍（SafeVR）', '行业成功案例 ×12', '竞品应对话术'], note: '按阶段过滤，top-5 注入' },
  { id: 'feedback_db', icon: Database, label: '反馈样本库', color: 'rose', items: ['人工修改记录', '驳回+正确做法', '草稿改写对比'], note: '运营提炼规则的原材料' },
]

type RoleKey = 'sales' | 'solution' | 'manager'

const ROLE_GUIDES: Record<RoleKey, {
  label: string; emoji: string; tagline: string
  color: string; bgColor: string; borderColor: string; iconColor: string
  dailyTime: string
  steps: { step: string; time: string; pageHref: string; pageLabel: string }[]
  aiDoes: string[]
  noDo: string[]
}> = {
  sales: {
    label: '销售', emoji: '🎯', tagline: '只管跑客户，其余交给 AI',
    color: 'text-blue-300', bgColor: 'bg-blue-950/60', borderColor: 'border-blue-700', iconColor: 'text-blue-400',
    dailyTime: '每天 ≤ 10 分钟',
    steps: [
      { step: '录入信号（客户沟通记录）', time: '30秒~2分钟', pageHref: '/inbox', pageLabel: '信号台' },
      { step: '确认信号归属商机（低置信度时才需要）', time: '~3秒', pageHref: '/inbox', pageLabel: '信号台' },
      { step: '审批 AI 建议的任务和草稿', time: '~1分钟', pageHref: '/workspace', pageLabel: '战场总览' },
      { step: '发送草稿 / 完成任务', time: '随时', pageHref: '/drafts', pageLabel: '草稿中心' },
    ],
    aiDoes: ['分析信号优先级和类型', '识别竞品风险和机会点', '生成邮件/方案初稿', '更新商机健康度评分', '跨阶段协同决策'],
    noDo: ['手动整理商机摘要', '主动想下一步怎么做', '填写 CRM 字段', '撰写周报'],
  },
  solution: {
    label: '售前经理', emoji: '📐', tagline: 'AI 做初稿，你来把关和深化',
    color: 'text-indigo-300', bgColor: 'bg-indigo-950/60', borderColor: 'border-indigo-700', iconColor: 'text-indigo-400',
    dailyTime: '每天 ≤ 15 分钟',
    steps: [
      { step: '审批方案相关 AI 建议', time: '~2分钟', pageHref: '/workspace', pageLabel: '战场总览' },
      { step: '管理和更新知识资产', time: '不定期', pageHref: '/assets', pageLabel: '资产库' },
      { step: '完成交接相关任务', time: '随时', pageHref: '/tasks', pageLabel: '任务中心' },
    ],
    aiDoes: ['自动结构化客户需求', '推荐匹配的行业案例和方案', '识别方案竞争力风险', '生成差异化对比文档'],
    noDo: ['每次手动选案例', '从头写方案框架', '跟踪各商机需求状态'],
  },
  manager: {
    label: '管理层', emoji: '📊', tagline: '全局尽在掌握，AI 替你盯着每个商机',
    color: 'text-emerald-300', bgColor: 'bg-emerald-950/60', borderColor: 'border-emerald-700', iconColor: 'text-emerald-400',
    dailyTime: '每天 5 分钟；每周 30 分钟',
    steps: [
      { step: '查看全局商机健康度', time: '5分钟/天', pageHref: '/dashboard', pageLabel: '运行驾驶舱' },
      { step: '关注高风险商机，直接介入', time: '按需', pageHref: '/workspace', pageLabel: '战场总览' },
      { step: '复盘 AI 被纠偏的决策模式', time: '30分钟/周', pageHref: '/evolution', pageLabel: '进化中心' },
      { step: '提炼规则 / 调整 Prompt', time: '5分钟/条', pageHref: '/evolution', pageLabel: '进化中心' },
    ],
    aiDoes: ['7×24小时监控全部商机', '自动计算和更新健康/风险评分', '识别停滞商机并预警', '生成赢单/输单归因分析'],
    noDo: ['逐一检查每个商机', '手动催销售更新进展', '人工汇总周报数据'],
  },
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

export default function FlowPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'roles'>('overview')
  const [selectedRole, setSelectedRole] = useState<RoleKey>('sales')

  // 多粒子信号流动画
  const [animDots, setAnimDots] = useState([0, 3, 6])
  // Agent 运行状态模拟
  const [runningAgentIdxs, setRunningAgentIdxs] = useState<number[]>([0])
  // 展开状态
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null)

  // 实时状态
  const [liveStatus, setLiveStatus] = useState<{
    pendingSignals: number; runningAgents: number; pendingActions: number; skillCount: number
  } | null>(null)
  const [recentLogs, setRecentLogs] = useState<Array<{ agentLabel: string; workspaceName: string; actionTitle: string; status: string }>>([
    { agentLabel: '销售 Agent', workspaceName: '大同煤矿项目', actionTitle: '竞品风险预警', status: 'risk' },
    { agentLabel: '解决方案 Agent', workspaceName: '国能集团项目', actionTitle: '输出技术方案建议', status: 'done' },
    { agentLabel: '招标 Agent', workspaceName: '阳光电源项目', actionTitle: '识别控标风险', status: 'risk' },
    { agentLabel: '商务 Agent', workspaceName: '华润电力项目', actionTitle: '生成报价草稿', status: 'done' },
    { agentLabel: '销售 Agent', workspaceName: '中煤能源项目', actionTitle: '商机健康度更新', status: 'done' },
  ])

  useEffect(() => {
    if (activeTab !== 'overview') return
    const interval = setInterval(() => {
      setAnimDots(prev => prev.map(d => (d + 1) % (SIGNAL_FLOW.length + 3)))
    }, 600)
    return () => clearInterval(interval)
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'overview') return
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
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'overview') return
    const fetch_ = async () => {
      try {
        const [sRes, wRes, skRes] = await Promise.all([
          fetch('/api/signals?status=pending_confirm&limit=100'),
          fetch('/api/workspaces?limit=50'),
          fetch('/api/skill-templates'),
        ])
        const sData = sRes.ok ? await sRes.json() : {}
        const wData = wRes.ok ? await wRes.json() : {}
        const skData = skRes.ok ? await skRes.json() : {}
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
      } catch { /* ignore */ }
    }
    fetch_()
    const interval = setInterval(fetch_, 30000)
    return () => clearInterval(interval)
  }, [activeTab])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <style>{`
        @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes fadeslide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <Breadcrumb items={[{ label: '治理配置' }, { label: '系统地图' }]} />
      <PageGuide storageKey="flow" contents={{ all: { roleLabel: '全员（新人必读）', purpose: 'AI 原生系统运作逻辑全景图', whenToUse: '新人入职，或对系统运作有疑问时来这里', aiAlreadyDid: '已生成完整系统运转示意图', youDecide: '了解整体架构，找到你角色的工作流入口', nextStepLabel: '进入我的工作台', nextStepHref: '/' } }} />

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: 'overview', label: '系统运转地图', icon: Layers },
          { key: 'roles', label: '我的工作流', icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: 系统运转地图 ── */}
      {activeTab === 'overview' && (
        <div className="bg-slate-950 rounded-2xl p-5 space-y-0" style={{ animation: 'fadeslide 0.3s ease-out' }}>

          {/* 顶部状态栏 */}
          <div className="flex items-center gap-5 text-sm mb-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-slate-300 text-xs font-mono">系统运行中</span>
            </div>
            {liveStatus && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${liveStatus.runningAgents > 0 ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-white text-xs">{liveStatus.runningAgents} Agent 运行中</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${liveStatus.pendingSignals > 0 ? 'bg-yellow-400' : 'bg-slate-600'}`} />
                  <span className="text-white text-xs">{liveStatus.pendingSignals} 信号待确认</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${liveStatus.pendingActions > 0 ? 'bg-orange-400' : 'bg-slate-600'}`} />
                  <span className="text-white text-xs">{liveStatus.pendingActions} 动作待审批</span>
                </div>
                {liveStatus.skillCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="text-white text-xs">{liveStatus.skillCount} 技能已上架</span>
                  </div>
                )}
              </>
            )}
            <span className="text-slate-600 text-xs ml-auto">每30秒刷新</span>
          </div>

          {/* 实时日志 ticker */}
          <div className="overflow-hidden bg-slate-900 rounded-lg px-3 py-1.5 flex items-center gap-2 mb-4 border border-slate-800">
            <span className="text-[10px] text-slate-600 flex-shrink-0 font-mono uppercase tracking-wider">实时</span>
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

          {/* ① 感知层 */}
          <LayerBlock
            number="01"
            accentColor="blue"
            title="感知"
            tagline="外部世界发生的事，自动变成 AI 可处理的结构化信号"
            humanLabel="人工录入"
            humanTime="30秒~2分钟"
            aiLabel="全自动标准化"
            expanded={expandedLayer === 'perception'}
            onToggle={() => setExpandedLayer(expandedLayer === 'perception' ? null : 'perception')}
          >
            {/* 信号流横向节点 */}
            <div className="flex items-start gap-0.5 mt-3">
              {SIGNAL_FLOW.map((node, i) => {
                const Icon = node.icon
                const isAnimated = animDots.some(d => d === i)
                const isHuman = node.role === 'human'
                const isHybrid = node.role === 'hybrid'
                const nodeBg = isAnimated ? 'bg-blue-600 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]' : isHuman ? 'bg-slate-800 border-slate-600' : isHybrid ? 'bg-indigo-950 border-indigo-700' : 'bg-slate-800 border-slate-600'
                return (
                  <div key={node.id} className="flex items-start flex-1 min-w-0">
                    <div className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-300 ${nodeBg}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isAnimated ? 'bg-blue-400' : isHuman ? 'bg-slate-600' : isHybrid ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[11px] font-medium text-slate-200 text-center leading-tight">{node.label}</span>
                      <span className={`text-[10px] ${isHuman ? 'text-amber-400' : isHybrid ? 'text-indigo-400' : 'text-cyan-400'}`}>{node.sublabel}</span>
                    </div>
                    {i < SIGNAL_FLOW.length - 1 && (
                      <div className="flex items-center justify-center w-4 pt-4 flex-shrink-0 relative">
                        <ArrowRight className={`w-2.5 h-2.5 transition-colors duration-300 ${animDots.some(d => d === i || d === i + 1) ? 'text-blue-400' : 'text-slate-700'}`} />
                        {animDots.some(d => d === i) && (
                          <span className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" style={{ top: '13px' }} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 展开详情 */}
            {expandedLayer === 'perception' && (
              <div className="mt-3 grid grid-cols-5 gap-1.5" style={{ animation: 'fadeslide 0.2s ease-out' }}>
                {SIGNAL_FLOW.map(node => (
                  <div key={node.id} className="bg-slate-900 rounded-lg p-2 border border-slate-800">
                    <p className="text-[10px] font-semibold text-slate-400 mb-1">{node.label}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{node.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </LayerBlock>

          {/* 层间连接 */}
          <LayerConnector label="信号绑定后自动触发 →" />

          {/* ② 思考层 */}
          <LayerBlock
            number="02"
            accentColor="cyan"
            title="思考"
            tagline="7个专属数字员工，持续分析你的每一个商机"
            humanLabel="无需介入"
            humanTime="全自动"
            aiLabel="并行分析"
            expanded={expandedLayer === 'thinking'}
            onToggle={() => setExpandedLayer(expandedLayer === 'thinking' ? null : 'thinking')}
          >
            <div className="mt-3 grid grid-cols-3 gap-3">
              {/* 知识库注入 */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono">注入上下文</p>
                {KNOWLEDGE_BASES.map(kb => {
                  const Icon = kb.icon
                  const colorMap: Record<string, string> = { amber: 'border-amber-800 bg-amber-950/40', green: 'border-green-800 bg-green-950/40', rose: 'border-rose-800 bg-rose-950/40' }
                  const iconColor: Record<string, string> = { amber: 'text-amber-400', green: 'text-green-400', rose: 'text-rose-400' }
                  return (
                    <div key={kb.id} className={`rounded-lg border p-2 ${colorMap[kb.color]}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`w-3 h-3 ${iconColor[kb.color]}`} />
                        <span className={`text-[10px] font-semibold ${iconColor[kb.color]}`}>{kb.label}</span>
                      </div>
                      {kb.items.slice(0, 2).map(item => (
                        <p key={item} className="text-[10px] text-slate-500 leading-relaxed">· {item}</p>
                      ))}
                      <p className={`text-[10px] mt-1 font-medium ${iconColor[kb.color]}`}>{kb.note}</p>
                    </div>
                  )
                })}
              </div>

              {/* Agent 矩阵 */}
              <div className="bg-gradient-to-b from-cyan-950/80 to-slate-900 rounded-xl border border-cyan-800/60 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Bot className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs font-semibold text-cyan-300">AI 数字员工</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">7个专业Agent并行运行</p>
                <div className="grid grid-cols-2 gap-1">
                  {AGENTS_DATA.slice(0, 6).map((a, idx) => {
                    const isRunning = runningAgentIdxs.includes(idx)
                    return (
                      <div key={a.type} className={`text-[10px] px-1.5 py-1 rounded-lg text-center relative ${a.lightBg} ${a.textColor} border ${a.border} ${isRunning ? 'ring-1 ring-green-500/60' : ''}`}>
                        {isRunning && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                        {a.label}
                      </div>
                    )
                  })}
                </div>
                <div className={`text-[10px] px-1.5 py-1 rounded-lg text-center mt-1 relative ${AGENTS_DATA[6].lightBg} ${AGENTS_DATA[6].textColor} border ${AGENTS_DATA[6].border} ${runningAgentIdxs.includes(6) ? 'ring-1 ring-green-500/60' : ''}`}>
                  {runningAgentIdxs.includes(6) && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  {AGENTS_DATA[6].label}
                </div>
              </div>

              {/* 输出 */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono">分析输出</p>
                <div className="bg-violet-950/50 border border-violet-800/60 rounded-lg p-2">
                  <p className="text-[10px] font-semibold text-violet-300 mb-1">决策判断</p>
                  {['阶段评估', '风险预警', '机会识别', '阻塞点分析'].map(d => (
                    <p key={d} className="text-[10px] text-slate-500">· {d}</p>
                  ))}
                </div>
                <div className="bg-emerald-950/50 border border-emerald-800/60 rounded-lg p-2">
                  <p className="text-[10px] font-semibold text-emerald-300 mb-1">行动建议</p>
                  {['创建任务', '生成草稿', '升级上报', '状态快照'].map(a => (
                    <p key={a} className="text-[10px] text-slate-500">· {a}</p>
                  ))}
                </div>
              </div>
            </div>

            {/* 展开：Agent 详情 */}
            {expandedLayer === 'thinking' && (
              <div className="mt-3 grid grid-cols-2 gap-1.5" style={{ animation: 'fadeslide 0.2s ease-out' }}>
                {AGENTS_DATA.map(a => (
                  <div key={a.type} className={`rounded-lg border p-2 ${a.lightBg} ${a.border}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <div className={`w-4 h-4 rounded-full ${a.color} flex-shrink-0`} />
                      <span className={`text-[11px] font-semibold ${a.textColor}`}>{a.label}</span>
                      <span className="text-[10px] text-slate-500 ml-auto">{a.stage}</span>
                    </div>
                    <p className="text-[10px] text-slate-500">{a.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </LayerBlock>

          {/* 层间连接 */}
          <LayerConnector label="AI 建议 → 送人工审批" />

          {/* ③ 执行层 */}
          <LayerBlock
            number="03"
            accentColor="amber"
            title="执行"
            tagline="AI 建议经你 1 分钟审批，任务草稿自动到位"
            humanLabel="人工审批"
            humanTime="~1 分钟"
            aiLabel="自动执行"
            expanded={expandedLayer === 'execution'}
            onToggle={() => setExpandedLayer(expandedLayer === 'execution' ? null : 'execution')}
          >
            <div className="mt-3 flex items-stretch gap-3">
              {/* AI 建议 */}
              <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono">AI 建议</p>
                {['risk_alert  竞品进场预警', 'create_task 安排总监介入', 'send_draft  差异化方案草稿'].map(item => (
                  <div key={item} className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-1 h-1 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="text-[11px] text-slate-400 font-mono">{item}</span>
                  </div>
                ))}
              </div>

              {/* 人工审批 */}
              <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0">
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <div className="bg-amber-950/60 border border-amber-700 rounded-xl px-3 py-2 text-center">
                  <Users className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-[11px] font-semibold text-amber-300">人工审批</p>
                  <p className="text-[10px] text-amber-500">通过 / 驳回 / 改写</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">~1 分钟</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600" />
              </div>

              {/* 自动执行 */}
              <div className="flex-1 bg-emerald-950/50 border border-emerald-800/60 rounded-xl p-3">
                <p className="text-[10px] text-emerald-500 uppercase tracking-wider mb-2 font-mono">自动执行</p>
                {[
                  { icon: CheckCircle, label: '任务已创建，已分配责任人' },
                  { icon: CheckCircle, label: '草稿已生成，待销售发送' },
                  { icon: CheckCircle, label: '商机健康度已更新' },
                  { icon: CheckCircle, label: '执行日志已记录' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className="text-[11px] text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 改写沉淀提示 */}
            <div className="mt-2 bg-slate-900/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-[10px] text-slate-600">改写内容自动沉淀为反馈样本</span>
              <ArrowRight className="w-3 h-3 text-slate-700" />
              <span className="text-[10px] text-rose-500">进化中心 · 规则原材料</span>
            </div>
          </LayerBlock>

          {/* 层间连接 */}
          <LayerConnector label="每次纠偏沉淀为知识" />

          {/* ④ 进化层 */}
          <LayerBlock
            number="04"
            accentColor="rose"
            title="进化"
            tagline="每次纠偏都让系统更懂你，越用越强"
            humanLabel="运营复盘"
            humanTime="每周 30 分钟"
            aiLabel="规则即时生效"
            expanded={expandedLayer === 'evolution'}
            onToggle={() => setExpandedLayer(expandedLayer === 'evolution' ? null : 'evolution')}
          >
            <div className="mt-3 flex items-center gap-2">
              {[
                { icon: Database, label: '反馈样本', color: 'rose', note: '人工修改/驳回自动记录' },
                { icon: TrendingUp, label: '运营复盘', color: 'rose', note: '识别AI反复犯的错' },
                { icon: Shield, label: '提炼规则', color: 'amber', note: '5分钟写一条规则' },
                { icon: Cpu, label: '即时注入', color: 'blue', note: '下次运行立即生效' },
              ].map((node, i) => {
                const Icon = node.icon
                const colorMap: Record<string, string> = {
                  rose: 'border-rose-800 bg-rose-950/50 text-rose-300',
                  amber: 'border-amber-800 bg-amber-950/50 text-amber-300',
                  blue: 'border-blue-800 bg-blue-950/50 text-blue-300',
                }
                return (
                  <div key={node.label} className="flex items-center flex-1 min-w-0">
                    <div className={`flex-1 flex flex-col items-center gap-1 p-2.5 rounded-xl border ${colorMap[node.color]} text-center`}>
                      <Icon className="w-4 h-4" />
                      <p className="text-[11px] font-semibold">{node.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight">{node.note}</p>
                    </div>
                    {i < 3 && <ArrowRight className="w-3 h-3 text-slate-700 flex-shrink-0 mx-0.5" />}
                  </div>
                )
              })}
              {/* 回环箭头 */}
              <div className="text-[10px] text-slate-600 flex-shrink-0 ml-1 leading-tight text-right">
                ↑<br />规则库<br />更新
              </div>
            </div>

            {/* 技能工坊侧栏 */}
            <div className="mt-2.5 bg-purple-950/50 border border-purple-800/60 rounded-xl p-3 flex items-center gap-3">
              <Wrench className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-purple-300">技能工坊 — 自训练新能力，装载给数字员工</p>
                <p className="text-[10px] text-slate-500 mt-0.5">沙盘训练 → 调试测试 → 封装上架 → 装载 Agent</p>
              </div>
              <Link href="/settings?tab=skills" className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5 flex-shrink-0">
                进入 <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            </div>

            {/* 展开详情 */}
            {expandedLayer === 'evolution' && (
              <div className="mt-3 bg-slate-900 rounded-lg p-3 border border-slate-800" style={{ animation: 'fadeslide 0.2s ease-out' }}>
                <p className="text-[10px] text-slate-500 mb-2 font-mono uppercase tracking-wider">真实案例</p>
                <div className="space-y-2 text-[11px]">
                  <div className="flex gap-2">
                    <span className="text-rose-400 flex-shrink-0">问题发现</span>
                    <span className="text-slate-400">presales_assistant 的邮件开场白连续3次被改写（"尊敬的" → "您好"）</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-amber-400 flex-shrink-0">提炼规则</span>
                    <span className="text-slate-400">【要求】生成对客邮件时，称呼使用"XX总监您好"，不用"尊敬的"</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-blue-400 flex-shrink-0">即时生效</span>
                    <span className="text-slate-400">规则写入后，下次 Agent 运行时自动注入，草稿风格立即改变</span>
                  </div>
                </div>
              </div>
            )}
          </LayerBlock>

          {/* 底部价值总结 */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-400/60" />人工操作
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-cyan-400/60" />AI 自动
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-indigo-400/60" />AI推荐+确认
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">人工介入总时间</p>
              <p className="text-lg font-bold text-white">≤ 10 分钟 / 天</p>
              <p className="text-[10px] text-slate-600">其余全部由 AI 完成</p>
            </div>
          </div>

        </div>
      )}

      {/* ── Tab 2: 我的工作流 ── */}
      {activeTab === 'roles' && (
        <div style={{ animation: 'fadeslide 0.3s ease-out' }}>
          {/* 角色选择 */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {(['sales', 'solution', 'manager'] as RoleKey[]).map(role => {
              const g = ROLE_GUIDES[role]
              const isSelected = selectedRole === role
              return (
                <button key={role} onClick={() => setSelectedRole(role)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${isSelected ? `${g.bgColor} ${g.borderColor}` : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-2xl mb-1.5">{g.emoji}</div>
                  <div className={`text-sm font-bold ${isSelected ? g.color : 'text-gray-700'}`}>{g.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{g.tagline}</div>
                  <div className={`text-xs mt-2 font-medium ${isSelected ? g.iconColor : 'text-gray-400'}`}>{g.dailyTime}</div>
                  {isSelected && (
                    <div className="text-[10px] text-gray-400 mt-1">↓ 查看工作流详情</div>
                  )}
                </button>
              )
            })}
          </div>

          {/* 选中角色详情 */}
          {(() => {
            const g = ROLE_GUIDES[selectedRole]
            return (
              <div key={selectedRole} className="space-y-4" style={{ animation: 'fadeslide 0.25s ease-out' }}>
                <div className={`rounded-xl border-2 p-4 ${g.bgColor} ${g.borderColor}`}>
                  <h3 className={`text-sm font-bold ${g.color} mb-3`}>{g.emoji} {g.label}的每日工作流</h3>
                  <div className="space-y-2">
                    {g.steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/50 rounded-lg px-3 py-2">
                        <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${g.bgColor} ${g.color} border ${g.borderColor}`}>{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-700">{s.step}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{s.time}</p>
                        </div>
                        <Link href={s.pageHref}
                          className={`text-[10px] px-2 py-1 rounded-lg flex items-center gap-0.5 ${g.bgColor} ${g.color} border ${g.borderColor} hover:opacity-80 flex-shrink-0`}>
                          {s.pageLabel} <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* AI 替你做的事 */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-emerald-700 mb-2">✅ AI 替你做的事</p>
                    <div className="space-y-1.5">
                      {g.aiDoes.map(item => (
                        <div key={item} className="flex items-start gap-1.5">
                          <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-600">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 不再需要做 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-500 mb-2">🚫 你不再需要做</p>
                    <div className="space-y-1.5">
                      {g.noDo.map(item => (
                        <div key={item} className="flex items-start gap-1.5">
                          <span className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-300 text-xs">✕</span>
                          <span className="text-xs text-gray-400 line-through">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ─── 子组件 ────────────────────────────────────────────────────────────────

function LayerBlock({
  number, accentColor, title, tagline, humanLabel, humanTime, aiLabel,
  expanded, onToggle, children,
}: {
  number: string
  accentColor: 'blue' | 'cyan' | 'amber' | 'rose'
  title: string
  tagline: string
  humanLabel: string
  humanTime: string
  aiLabel: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const colorMap: Record<string, { border: string; title: string; num: string; hover: string }> = {
    blue:  { border: 'border-blue-800/60',  title: 'text-blue-300',  num: 'text-blue-500',  hover: 'hover:bg-blue-900/20' },
    cyan:  { border: 'border-cyan-800/60',  title: 'text-cyan-300',  num: 'text-cyan-500',  hover: 'hover:bg-cyan-900/20' },
    amber: { border: 'border-amber-800/60', title: 'text-amber-300', num: 'text-amber-500', hover: 'hover:bg-amber-900/20' },
    rose:  { border: 'border-rose-800/60',  title: 'text-rose-300',  num: 'text-rose-500',  hover: 'hover:bg-rose-900/20' },
  }
  const c = colorMap[accentColor]
  return (
    <div className={`bg-slate-900 rounded-xl border ${c.border} p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className={`text-2xl font-black font-mono ${c.num} leading-none mt-0.5`}>{number}</span>
          <div>
            <h3 className={`text-base font-bold ${c.title}`}>{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{tagline}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] bg-amber-900/50 text-amber-400 border border-amber-800/60 px-1.5 py-0.5 rounded-full">{humanLabel} · {humanTime}</span>
              <span className="text-[10px] bg-cyan-900/50 text-cyan-400 border border-cyan-800/60 px-1.5 py-0.5 rounded-full">⚡ {aiLabel}</span>
            </div>
          </div>
        </div>
        <button onClick={onToggle}
          className={`text-[10px] text-slate-500 flex items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${c.hover}`}>
          {expanded ? <><ChevronUp className="w-3 h-3" />收起</> : <><ChevronDown className="w-3 h-3" />展开</>}
        </button>
      </div>
      {children}
    </div>
  )
}

function LayerConnector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1.5">
      <div className="w-px h-4 bg-gradient-to-b from-slate-700 to-slate-600" />
      <span className="text-[10px] text-slate-600 font-mono px-2 py-0.5 bg-slate-900 rounded-full border border-slate-800">{label}</span>
      <div className="w-px h-4 bg-gradient-to-b from-slate-600 to-slate-700" />
    </div>
  )
}
