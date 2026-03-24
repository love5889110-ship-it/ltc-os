'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Mic, Cpu, GitBranch, Users, Zap, Bot, Radio, BookOpen, RefreshCw,
  Play, Pause, SkipForward, SkipBack, ArrowRight, ArrowLeft,
  Shield, FileText, TrendingUp, ChevronDown, ChevronUp, Database,
  AlertTriangle, CheckCircle, Clock, Layers, ExternalLink, UserCircle,
  FlaskConical, BarChart2, FileEdit, Inbox, Swords, ClipboardList,
  Wrench, Package, Star, Briefcase
} from 'lucide-react'
import { PageGuide } from '@/components/ui/page-guide'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import Link from 'next/link'

// ─── Tab 1: 系统全貌 ───────────────────────────────────────────────────────

const SIGNAL_FLOW = [
  { id: 'connectors', label: '连接器', sublabel: '持续输入', icon: Radio, role: 'human', time: '随时', color: 'purple', desc: '6种信号来源：Get笔记录音、钉钉群、文件OCR、录音上传、微信代理、手动输入。连接器持续监听，无需销售重复操作。' },
  { id: 'input', label: '信息录入', sublabel: '信号创建', icon: Mic, role: 'human', time: '30秒~2分钟', color: 'purple', desc: '销售完成沟通后，通过任意连接器录入原始内容。这是人工介入的第一个（也是最主要的）入口。' },
  { id: 'normalize', label: 'AI 标准化', sublabel: '全自动', icon: Cpu, role: 'ai', time: '自动', color: 'blue', desc: 'AI 自动解析原始内容：识别信号类型（需求/风险/机会/阻塞）、优先级（1-5）、关键实体（客户/竞品/金额/时间节点），生成要点和风险标记。' },
  { id: 'bind', label: '归属确认', sublabel: '3秒操作', icon: GitBranch, role: 'hybrid', time: '~3秒（置信度<92%时）', color: 'indigo', desc: 'AI 自动计算与已有商机的匹配置信度。置信度 ≥92% 时完全自动绑定；低于92%时，销售在信号台 3秒确认候选——这是最轻量的人工操作。' },
  { id: 'trigger', label: '触发分析', sublabel: '全自动', icon: Zap, role: 'ai', time: '自动', color: 'cyan', desc: '信号绑定后，自动触发对应阶段的 AI 数字员工。另有4种触发方式：阶段变更自动触发、每日定时健康检查、人工手动触发、执行回调触发（执行结果驱动新一轮分析）。' },
]

const AI_CORE = {
  input: ['规则库（动态注入）', '资产库（按阶段筛选）', '跨Agent输出（协作）', '商机全量上下文', '最近5条信号'],
  output: ['决策（判断）', '行动（建议）'],
  decisions: ['stage_assessment 阶段评估', 'risk_alert 风险预警', 'opportunity_found 机会识别', 'blocker_identified 阻塞点', 'action_recommended 行动建议'],
  actions: ['create_task 创建任务', 'send_draft 生成草稿', 'update_status 更新状态', 'create_snapshot 状态快照', 'escalate 升级上报', 'notify 发出通知'],
}

const APPROVAL_FLOW = [
  { id: 'approve', label: '人工审批', icon: Users, role: 'human', time: '~1分钟', color: 'amber', desc: '需要对外发出的行动（草稿/任务/升级）必须经人工确认。可以通过、驳回（填写正确做法）、或改写内容。改写内容自动沉淀为反馈样本。' },
  { id: 'execute', label: '自动执行', icon: Zap, role: 'ai', time: '自动', color: 'green', desc: '审批通过后，系统自动执行：创建任务并分配负责人、生成草稿供销售发送、更新商机健康度、生成状态快照。全部留有执行日志。' },
]

const EVOLUTION_FLOW = [
  { id: 'feedback', label: '反馈样本', icon: Database, color: 'rose', desc: '每次人工修改或驳回 AI 建议，系统自动记录原始输出 vs 修正后的对比，作为反馈样本存档。这是知识积累的原材料。' },
  { id: 'review', label: '运营复盘', icon: TrendingUp, color: 'rose', time: '每周~30分钟', role: 'human', desc: '运营/销售总监在进化中心，查看高频被修改的 AI 决策模式，识别"AI 反复犯的错"。' },
  { id: 'rule', label: '提炼规则', icon: Shield, color: 'rose', time: '~5分钟/条', role: 'human', desc: '将识别到的模式提炼为规则（禁止/必须/倾向），填入规则库。规则立即生效，无需改代码。' },
  { id: 'inject', label: '规则注入', icon: Cpu, color: 'blue', role: 'ai', desc: '下次 AI 数字员工运行时，自动从规则库读取所有生效规则，拼入 System Prompt。AI 行为即时改变，越用越懂这家公司。' },
]

const KNOWLEDGE_BASES = [
  {
    id: 'rules', icon: Shield, label: '规则库', color: 'orange',
    items: ['竞品出现 → 立即预警', '需求阶段禁止发报价', '截标 <7天 → 紧急任务', '价格战 → 价值锚定策略'],
    note: '→ 每次 Agent 运行前动态注入',
  },
  {
    id: 'assets', icon: BookOpen, label: '资产库', color: 'green',
    items: ['产品介绍（SafeVR）', '成功案例（山西焦煤等）', '竞品话术（幻威/万特）', '行业方案模板', '投标资质清单'],
    note: '→ 按阶段过滤，top-5 注入',
  },
  {
    id: 'feedback_db', icon: Database, label: '反馈样本库', color: 'rose',
    items: ['人工修改记录', '驳回+正确做法', '草稿改写对比', '归属确认校正'],
    note: '→ 运营提炼规则的原材料',
  },
]

// ─── Tab 2: 信号的旅程 ─────────────────────────────────────────────────────

const JOURNEY_STEPS = [
  {
    id: 'record', label: '录入信号', role: 'human', time: '约1分钟',
    icon: Mic, color: 'purple',
    story: '渠道李总拜访大同煤矿后…',
    detail: '李总打开 Get笔记 录音，说："赵总监反馈竞品幻威已演示，报价低18%，需要煤矿行业案例，下周要见安全总监。"',
    dbState: 'signalEvents: rawContent 已录入\nstatus: unbound\nsourceType: get_notes',
    pageHref: '/inbox',
    pageLabel: '信号台',
  },
  {
    id: 'ai_parse', label: 'AI 解析', role: 'ai', time: '自动（~2秒）',
    icon: Cpu, color: 'blue',
    story: 'AI 自动读取录音转文字，提炼结构化信息…',
    detail: '信号类型: risk（竞品风险）\n优先级: 5（最高）\n关键要点: [竞品幻威已演示, 报价低18%, 需煤矿案例, 下周安全总监]\n风险标记: [竞品进场, 价格压力]\n实体: 客户=大同煤矿, 竞品=幻威, 决策人=赵总监/安全总监',
    dbState: 'signalEvents: contentSummary, keyPoints, riskFlags\nparsedEntitiesJson: {customer, competitor, contact}\nsignalType: risk, priority: 5',
    pageHref: null,
    pageLabel: '后台自动（signal-processor.ts）',
  },
  {
    id: 'bind', label: '归属确认', role: 'hybrid', time: '~3秒',
    icon: GitBranch, color: 'indigo',
    story: 'AI 推荐：此信号 92% 属于"大同煤矿 VR 项目"商机…',
    detail: 'AI 计算置信度 92% → 推荐绑定到"大同煤矿井下采掘VR安全培训"商机\n因置信度 <92%，送人工确认\n李总在信号台点击"批准 AI 归属"（3秒），信号绑定完成',
    dbState: 'signalBindings: status: confirmed\nopportunityId: opp_001\nbindingConfidence: 0.92\nsignalEvents.status: bound',
    pageHref: '/inbox',
    pageLabel: '信号台',
  },
  {
    id: 'agent_run', label: 'AI 数字员工分析', role: 'ai', time: '自动（~5-10秒）',
    icon: Bot, color: 'cyan',
    story: 'sales_copilot 自动启动，注入规则库+资产库+其他Agent输出…',
    detail: 'System Prompt 注入：\n  ● 规则：出现竞品名称时必须发出 risk_alert\n  ● 资产：幻威竞品应对话术、煤矿行业VR成功案例×3\n  ● 其他Agent：tender_assistant 最新分析（无招标风险）\n\nAI 输出：\n  [risk_alert] 竞品幻威已演示，建议立即控标\n  [action] create_task: 安排销售总监介入（priority:5）\n  [action] send_draft: 生成差异化方案邮件草稿',
    dbState: 'agentRuns: status: completed\nagentDecisions: risk_alert, severity:5\nagentActions: create_task(pending_approval)\n              send_draft(pending_approval)',
    pageHref: null,
    pageLabel: '后台自动（agent-runtime.ts）',
  },
  {
    id: 'approve', label: '人工审批', role: 'human', time: '约1分钟',
    icon: Users, color: 'amber',
    story: '张总监在战场总览看到 AI 建议，快速审批…',
    detail: '张总监看到：\n  ✓ 通过"安排销售总监介入"任务\n  ✏ 修改差异化方案邮件草稿（改写了开场白措辞）\n    → 系统自动记录改写内容为反馈样本\n    → feedbackLabel: modified',
    dbState: 'agentActions: status: approved\napprovalTasks: status: approved\nfeedbackSamples: originalOutputJson vs correctedOutputJson\nhumanInterventions: interventionType: modify_output',
    pageHref: '/workspace',
    pageLabel: '战场总览',
  },
  {
    id: 'execute', label: '自动执行', role: 'ai', time: '自动',
    icon: Zap, color: 'green',
    story: '审批通过后，系统自动执行所有动作…',
    detail: '已执行：\n  ✅ 任务创建：「安排销售总监拜访大同煤矿」，分配给张总监，截止3天内\n  ✅ 草稿生成：差异化方案邮件（已入对客草稿，待李总发送）\n  ✅ 状态快照：当前商机健康度60%，风险分70%，已记录',
    dbState: 'tasks: title, assignee, dueDate\ndrafts: contentText（修改后版本）\nstateSnapshots: healthScore:60, riskScore:70\nexecutionLogs: status: completed',
    pageHref: '/tasks',
    pageLabel: '任务执行 / 对客草稿',
  },
  {
    id: 'evolve', label: '进化沉淀', role: 'human', time: '每周~30分钟',
    icon: TrendingUp, color: 'rose',
    story: '运营发现 AI 草稿开场白总被改写，提炼为新规则…',
    detail: '运营在进化中心发现：presales_assistant 的邮件草稿开场白连续3次被改写\n识别模式：AI 写"尊敬的XX总监"，销售总改为"XX总监您好"（更简洁）\n\n提炼规则：\n  适用：sales_copilot / presales_assistant\n  类型：要求\n  条件：生成对客邮件草稿时\n  规则：称呼使用"XX总监您好"，不用"尊敬的"',
    dbState: 'agentRules: ruleType: require\ncondition: 生成对客邮件草稿时\ninstruction: 称呼使用"XX总监您好"，不用"尊敬的"\ncreatedFrom: manual（来自反馈样本）\nenabled: true',
    pageHref: '/evolution',
    pageLabel: '进化中心',
  },
]

// ─── Tab 3: 多Agent协作 ───────────────────────────────────────────────────

const AGENTS_DATA = [
  { type: 'sales_copilot',    label: '销售 Agent',      stage: '全阶段',   color: 'bg-blue-500',   textColor: 'text-blue-700',   lightBg: 'bg-blue-50',   border: 'border-blue-200',   desc: '监控商机健康度，识别停滞和竞品风险，驱动阶段推进',                         triggers: ['信号绑定', '阶段变更', '每日定时'] },
  { type: 'presales_assistant', label: '解决方案 Agent', stage: '需求/方案', color: 'bg-indigo-500', textColor: 'text-indigo-700', lightBg: 'bg-indigo-50', border: 'border-indigo-200', desc: '结构化客户需求，推荐行业方案，匹配成功案例',                             triggers: ['需求信号', '方案评审'] },
  { type: 'tender_assistant',  label: '招标 Agent',      stage: '招投标',   color: 'bg-cyan-500',   textColor: 'text-cyan-700',   lightBg: 'bg-cyan-50',   border: 'border-cyan-200',   desc: '解析招标文件，检查投标资质，识别控标风险，管理截止时间',                     triggers: ['招标文件', '截标预警'] },
  { type: 'commercial',        label: '商务 Agent',      stage: '商务谈判', color: 'bg-teal-500',   textColor: 'text-teal-700',   lightBg: 'bg-teal-50',   border: 'border-teal-200',   desc: '报价策略建议，价格谈判辅助，合同条款风险识别',                             triggers: ['价格信号', '合同阶段'] },
  { type: 'handover',          label: '交付 Agent',      stage: '合同/交付', color: 'bg-green-500', textColor: 'text-green-700',  lightBg: 'bg-green-50',  border: 'border-green-200',  desc: '生成项目交接包，确认交付边界和所有承诺，防止信息断层',                       triggers: ['合同签订'] },
  { type: 'service_triage',    label: '服务 Agent',      stage: '售后服务', color: 'bg-orange-500', textColor: 'text-orange-700', lightBg: 'bg-orange-50', border: 'border-orange-200', desc: '工单分类和优先级，识别续约风险，挖掘增购机会',                             triggers: ['售后工单', '定时巡检'] },
  { type: 'asset_governance',  label: '资产管理 Agent',  stage: '全阶段',   color: 'bg-rose-500',   textColor: 'text-rose-700',   lightBg: 'bg-rose-50',   border: 'border-rose-200',   desc: '从赢单/输单案例提炼经验，管理话术资产，清理过时资料',                       triggers: ['商机关闭', '手动触发'] },
]

const CROSS_AGENT_EXAMPLES = [
  { from: 'sales_copilot', to: 'presales_assistant', desc: '销售 Agent 识别到"方案竞争力被质疑"→ 解决方案 Agent 收到预警，主动加强案例背书' },
  { from: 'tender_assistant', to: 'sales_copilot', desc: '招标 Agent 发现"技术参数疑似控标"→ 销售 Agent 收到 severity:5 风险，立即建议销售总监介入' },
  { from: 'commercial', to: 'sales_copilot', desc: '商务 Agent 识别"价格战风险"→ 销售 Agent 同步预警，建议从关系层面补救' },
  { from: 'presales_assistant', to: 'commercial', desc: '解决方案 Agent 输出"差异化方案要点"→ 商务 Agent 据此构建价值锚定，支撑报价策略' },
]

// ─── Tab 4: 角色导航 ───────────────────────────────────────────────────────

type RoleKey = 'sales' | 'solution' | 'manager'

const ROLE_GUIDES: Record<RoleKey, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  iconColor: string
  tagColor: string
  dailyTime: string
  steps: { step: string; time: string; pageHref: string; pageLabel: string }[]
  aiDoes: string[]
  noDo: string[]
}> = {
  sales: {
    label: '销售', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200',
    iconColor: 'text-blue-500', tagColor: 'bg-blue-100 text-blue-700',
    dailyTime: '每天累计约 10 分钟',
    steps: [
      { step: '在战场总览录入信号（客户沟通记录）', time: '30秒~2分钟', pageHref: '/workspace', pageLabel: '战场总览' },
      { step: '确认信号归属商机（低置信度时）', time: '~3秒', pageHref: '/workspace', pageLabel: '战场总览' },
      { step: '进入战场 → 待你决策 Tab 审批 AI 建议', time: '~1分钟', pageHref: '/workspace', pageLabel: '战场总览' },
      { step: '在战场「草稿与任务」Tab 发送草稿/完成任务', time: '随时', pageHref: '/workspace', pageLabel: '战场总览' },
    ],
    aiDoes: ['分析信号优先级和类型', '识别竞品风险和机会点', '生成邮件/方案初稿', '更新商机健康度评分', '跨阶段协同决策'],
    noDo: ['不需要手动整理商机摘要', '不需要主动想下一步怎么做', '不需要填写 CRM 字段'],
  },
  solution: {
    label: '售前经理', color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200',
    iconColor: 'text-indigo-500', tagColor: 'bg-indigo-100 text-indigo-700',
    dailyTime: '每天累计约 15 分钟',
    steps: [
      { step: '进入战场 → 审批方案相关 AI 建议', time: '~2分钟', pageHref: '/workspace', pageLabel: '战场总览' },
      { step: '管理和更新知识资产', time: '不定期', pageHref: '/assets', pageLabel: '知识资产' },
      { step: '在战场完成交接相关任务', time: '随时', pageHref: '/workspace', pageLabel: '战场总览' },
    ],
    aiDoes: ['自动结构化客户需求', '推荐匹配的行业案例和方案', '识别方案竞争力风险', '生成差异化对比文档', '自动提取成功案例要素'],
    noDo: ['不需要每次手动选案例', '不需要从头写方案框架', '不需要跟踪各商机需求状态'],
  },
  manager: {
    label: '管理层', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200',
    iconColor: 'text-emerald-500', tagColor: 'bg-emerald-100 text-emerald-700',
    dailyTime: '每天 5 分钟；每周 30 分钟深度复盘',
    steps: [
      { step: '查看全局商机健康度', time: '5分钟/天', pageHref: '/dashboard', pageLabel: '运行驾驶舱' },
      { step: '关注高风险商机，直接介入', time: '按需', pageHref: '/workspace', pageLabel: '战场总览' },
      { step: '复盘 AI 被纠偏的决策模式', time: '30分钟/周', pageHref: '/evolution', pageLabel: '进化中心' },
      { step: '提炼规则 / 调整 Prompt', time: '5分钟/条', pageHref: '/evolution', pageLabel: '进化中心' },
      { step: '管理连接器和大模型配置', time: '不定期', pageHref: '/settings', pageLabel: '连接器与模型' },
    ],
    aiDoes: ['7×24小时监控全部商机', '自动计算和更新健康/风险评分', '识别停滞商机并预警', '生成赢单/输单归因分析', '追踪数字员工执行效果'],
    noDo: ['不需要逐一检查每个商机', '不需要手动催销售更新进展', '不需要人工汇总周报数据'],
  },
}

export default function FlowPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'journey' | 'agents' | 'roles'>('roles')
  // Overview state
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  // [P1-13] Live system status
  const [liveStatus, setLiveStatus] = useState<{
    pendingSignals: number
    runningAgents: number
    pendingActions: number
    failedActions: number
    skillCount: number
  } | null>(null)
  // Recent execution logs for ticker
  const [recentLogs, setRecentLogs] = useState<Array<{ agentLabel: string; workspaceName: string; actionTitle: string; status: string }>>([
    { agentLabel: '销售 Agent', workspaceName: '大同煤矿项目', actionTitle: '生成差异化方案草稿', status: 'done' },
    { agentLabel: '招标 Agent', workspaceName: '阳光电源项目', actionTitle: '识别控标风险', status: 'risk' },
    { agentLabel: '解决方案 Agent', workspaceName: '国能集团项目', actionTitle: '输出技术方案建议', status: 'done' },
    { agentLabel: '商务 Agent', workspaceName: '华润电力项目', actionTitle: '生成报价草稿', status: 'done' },
    { agentLabel: '销售 Agent', workspaceName: '中煤能源项目', actionTitle: '竞争对手动态分析', status: 'risk' },
  ])
  // Journey state
  const [journeyStep, setJourneyStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Agents state
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  // Role guide state
  const [selectedRole, setSelectedRole] = useState<RoleKey>('sales')
  // Multi-particle animation for signal flow (3 particles staggered)
  const [animDots, setAnimDots] = useState([0, 3, 6])
  // Random running agent simulation
  const [runningAgentIdxs, setRunningAgentIdxs] = useState<number[]>([0])

  useEffect(() => {
    if (!isPlaying) return
    timerRef.current = setTimeout(() => {
      if (journeyStep < JOURNEY_STEPS.length - 1) {
        setJourneyStep((s) => s + 1)
      } else {
        setIsPlaying(false)
      }
    }, 3000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [isPlaying, journeyStep])

  // Multi-particle signal flow animation (3 particles staggered across SIGNAL_FLOW.length+3 positions)
  useEffect(() => {
    if (activeTab !== 'overview') return
    const interval = setInterval(() => {
      setAnimDots(prev => prev.map(d => (d + 1) % (SIGNAL_FLOW.length + 3)))
    }, 600)
    return () => clearInterval(interval)
  }, [activeTab])

  // Agent running state simulation (rotate 1-2 agents every 4 seconds)
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

  // [P1-13] Fetch live system status when on overview tab
  useEffect(() => {
    if (activeTab !== 'overview') return
    const fetchStatus = async () => {
      try {
        const [signalsRes, workspacesRes, skillsRes] = await Promise.all([
          fetch('/api/signals?status=pending_confirm&limit=100'),
          fetch('/api/workspaces?limit=50'),
          fetch('/api/skill-templates'),
        ])
        const signalsData = signalsRes.ok ? await signalsRes.json() : {}
        const wsData = workspacesRes.ok ? await workspacesRes.json() : {}
        const skillsData = skillsRes.ok ? await skillsRes.json() : {}
        const workspaces = wsData.workspaces ?? []
        const runningAgents = workspaces.reduce((sum: number, w: any) => sum + (w.runningAgentCount ?? 0), 0)
        const pendingActions = workspaces.reduce((sum: number, w: any) => sum + (w.pendingActionCount ?? 0), 0)
        const skillCount = (skillsData.templates ?? []).filter((t: any) => t.enabled).length
        setLiveStatus({
          pendingSignals: signalsData.total ?? 0,
          runningAgents,
          pendingActions,
          failedActions: 0,
          skillCount,
        })
        // Extract recent execution logs for ticker
        const AGENT_LABELS: Record<string, string> = {
          sales: '销售 Agent', presales_assistant: '解决方案 Agent',
          tender_assistant: '招标 Agent', handover: '交付 Agent',
          risk_monitor: '风险 Agent', renewal_manager: '续约 Agent', general_assistant: '通用 Agent',
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
      } catch { /* ignore */ }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [activeTab])

  const goJourneyTo = (i: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setIsPlaying(false)
    setJourneyStep(i)
  }

  const currentStep = JOURNEY_STEPS[journeyStep]
  const guide = ROLE_GUIDES[selectedRole]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes fadeslide {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Breadcrumb items={[{ label: '治理配置' }, { label: '系统地图' }]} />
      <PageGuide
        storageKey="flow"
        contents={{
          all: {
            roleLabel: '全员（新人必读）',
            purpose: 'AI 原生系统运作逻辑全景图',
            whenToUse: '新人入职，或对系统运作有疑问时来这里',
            aiAlreadyDid: '已生成完整系统运转示意图',
            youDecide: '了解整体架构，找到你角色的工作流入口',
            nextStepLabel: '进入我的工作台',
            nextStepHref: '/',
          },
        }}
      />

      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold">系统地图</h1>
          </div>
          <p className="text-xs text-gray-400 ml-8 mt-0.5">云艺化AI原生LTC人机协作系统</p>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'roles', label: '角色导航', icon: UserCircle },
            { key: 'overview', label: '系统全貌', icon: Layers },
            { key: 'journey', label: '信号的旅程', icon: ArrowRight },
            { key: 'agents', label: '多Agent协作', icon: Bot },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === key ? 'bg-white shadow font-medium' : 'text-gray-500 hover:text-gray-700'
              } ${key === 'roles' && activeTab !== 'roles' ? 'text-blue-500 font-medium' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {key === 'roles' && activeTab !== 'roles' && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab 4: 角色导航 ── */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {/* Role selector */}
          <div className="flex gap-2">
            {(Object.keys(ROLE_GUIDES) as RoleKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRole(r)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  selectedRole === r
                    ? `${ROLE_GUIDES[r].bgColor} ${ROLE_GUIDES[r].borderColor} ${ROLE_GUIDES[r].color}`
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {ROLE_GUIDES[r].label}
              </button>
            ))}
          </div>

          <div className={`rounded-xl border-2 p-5 ${guide.bgColor} ${guide.borderColor}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-base font-semibold ${guide.color}`}>{guide.label}的工作方式</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {guide.dailyTime}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${guide.tagColor}`}>
                人机协作 · 极致减负
              </span>
            </div>

            <div className="grid grid-cols-2 gap-5">
              {/* Steps with links */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">你的日常工作流</p>
                <div className="space-y-2">
                  {guide.steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/70 rounded-lg px-3 py-2.5 border border-white">
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0 ${guide.tagColor}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{s.step}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />{s.time}
                        </p>
                      </div>
                      <Link
                        href={s.pageHref}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium flex-shrink-0 hover:opacity-80 transition-opacity ${guide.tagColor}`}
                      >
                        {s.pageLabel}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI does + No-do */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">AI 替你做的（无需操作）</p>
                  <div className="space-y-1.5">
                    {guide.aiDoes.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">不需要你做的事</p>
                  <div className="space-y-1.5">
                    {guide.noDo.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-500">
                        <span className="text-red-400 flex-shrink-0 mt-0.5 text-base leading-none">✗</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick start tip */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-800">新手推荐路径</p>
              <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                先看「系统全貌」了解整体逻辑 → 再看「信号的旅程」跟随真实案例感受流程 → 然后按上方工作流开始操作
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 1: 系统全貌 ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* [P1-13] Live system status bar */}
          {liveStatus && (
            <>
            <div className="bg-gray-900 rounded-xl px-4 py-3 flex items-center gap-6 text-sm">
              <span className="text-gray-400 text-xs font-medium">实时运行状态</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${liveStatus.runningAgents > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-white font-medium">{liveStatus.runningAgents}</span>
                <span className="text-gray-400 text-xs">Agent 运行中</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${liveStatus.pendingSignals > 0 ? 'bg-yellow-400' : 'bg-gray-500'}`} />
                <span className="text-white font-medium">{liveStatus.pendingSignals}</span>
                <span className="text-gray-400 text-xs">信号待确认</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${liveStatus.pendingActions > 0 ? 'bg-orange-400' : 'bg-gray-500'}`} />
                <span className="text-white font-medium">{liveStatus.pendingActions}</span>
                <span className="text-gray-400 text-xs">动作待审批</span>
              </div>
              {liveStatus.failedActions > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-red-300 font-medium">{liveStatus.failedActions}</span>
                  <span className="text-gray-400 text-xs">执行失败</span>
                </div>
              )}
              {liveStatus.skillCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="text-white font-medium">{liveStatus.skillCount}</span>
                  <span className="text-gray-400 text-xs">个技能已上架</span>
                </div>
              )}
              <span className="text-gray-600 text-xs ml-auto">每30秒刷新</span>
            </div>
            {/* 执行日志滚动条 */}
            {recentLogs.length > 0 && (
              <div className="overflow-hidden bg-gray-900/80 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="text-[10px] text-gray-500 flex-shrink-0 font-mono">实时日志</span>
                <div className="overflow-hidden flex-1 relative h-4">
                  <div
                    className="flex gap-6 absolute whitespace-nowrap"
                    style={{ animation: 'ticker-scroll 28s linear infinite' }}
                  >
                    {[...recentLogs, ...recentLogs].map((log, idx) => (
                      <span key={idx} className="text-[11px] flex-shrink-0">
                        <span className="text-cyan-400">{log.agentLabel}</span>
                        <span className="text-gray-500 mx-1">·</span>
                        <span className="text-gray-300">{log.workspaceName}</span>
                        <span className="text-gray-500 mx-1">·</span>
                        <span className={log.status === 'risk' ? 'text-orange-400' : 'text-green-400'}>
                          {log.actionTitle} {log.status === 'risk' ? '⚡' : '✓'}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </>
          )}

          {/* 角色图例 */}
          <div className="flex items-center gap-5 text-xs text-gray-500 mb-1">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />人工操作（显示耗时）</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />AI 自动</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-400 inline-block" />AI推荐+人工确认</div>
          </div>

          {/* 第一层：信号流 */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">第一层 · 信号流</span>
              <span className="text-xs text-gray-400">信号从外部持续流入，经过 AI 标准化和归属，触发 Agent 分析</span>
            </div>
            <div className="flex items-start gap-1">
              {SIGNAL_FLOW.map((node, i) => {
                const Icon = node.icon
                const isExpanded = expandedNode === node.id
                const isHuman = node.role === 'human'
                const isHybrid = node.role === 'hybrid'
                const bgColor = isHuman ? 'bg-amber-50 border-amber-200' : isHybrid ? 'bg-indigo-50 border-indigo-200' : 'bg-blue-50 border-blue-200'
                const iconBg = isHuman ? 'bg-amber-400' : isHybrid ? 'bg-indigo-500' : 'bg-blue-500'
                const isAnimated = animDots.some(d => d === i)
                return (
                  <div key={node.id} className="flex items-start flex-1 min-w-0">
                    <button
                      onClick={() => setExpandedNode(isExpanded ? null : node.id)}
                      className={`flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${isExpanded ? bgColor + ' shadow-sm' : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'} ${isAnimated ? 'ring-2 ring-offset-1 ring-blue-300 shadow-md' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full ${iconBg} flex items-center justify-center transition-transform ${isAnimated ? 'scale-110' : ''}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{node.label}</span>
                      <span className="text-xs text-gray-400">{node.sublabel}</span>
                      {node.time !== '自动' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isHuman || isHybrid ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isHuman || isHybrid ? <Clock className="w-2.5 h-2.5 inline mr-0.5" /> : null}
                          {node.time}
                        </span>
                      )}
                      {node.time === '自动' && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">⚡ 自动</span>
                      )}
                    </button>
                    {i < SIGNAL_FLOW.length - 1 && (
                      <div className="flex items-center justify-center w-5 pt-4 flex-shrink-0 relative">
                        <ArrowRight className={`w-3 h-3 transition-colors duration-300 ${animDots.some(d => d === i || d === i + 1) ? 'text-blue-400' : 'text-gray-300'}`} />
                        {animDots.some(d => d === i) && (
                          <span className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" style={{ top: '14px' }} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {expandedNode && SIGNAL_FLOW.find(n => n.id === expandedNode) && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed border">
                {SIGNAL_FLOW.find(n => n.id === expandedNode)!.desc}
              </div>
            )}
          </div>

          {/* 第二层：AI 协作核心 */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">第二层 · AI 协作核心</span>
              <span className="text-xs text-gray-400">7个数字员工并行分析，三大知识库实时注入</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* 知识库输入 */}
              <div className="space-y-2">
                {KNOWLEDGE_BASES.map((kb) => {
                  const Icon = kb.icon
                  const colorMap: Record<string, string> = { orange: 'bg-orange-50 border-orange-200', green: 'bg-green-50 border-green-200', rose: 'bg-rose-50 border-rose-200' }
                  const iconColorMap: Record<string, string> = { orange: 'bg-orange-400', green: 'bg-green-500', rose: 'bg-rose-500' }
                  const textColorMap: Record<string, string> = { orange: 'text-orange-700', green: 'text-green-700', rose: 'text-rose-700' }
                  return (
                    <div key={kb.id} className={`rounded-lg border p-2.5 ${colorMap[kb.color]}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className={`w-5 h-5 rounded ${iconColorMap[kb.color]} flex items-center justify-center`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <span className={`text-xs font-semibold ${textColorMap[kb.color]}`}>{kb.label}</span>
                      </div>
                      {kb.items.slice(0, 3).map(item => (
                        <div key={item} className="text-xs text-gray-500 py-0.5">· {item}</div>
                      ))}
                      <div className={`text-xs mt-1.5 font-medium ${textColorMap[kb.color]}`}>{kb.note}</div>
                    </div>
                  )
                })}
              </div>

              {/* Agent 核心 */}
              <div className="bg-gradient-to-b from-cyan-50 to-blue-50 rounded-xl border-2 border-cyan-200 p-3 flex flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bot className="w-5 h-5 text-cyan-600 animate-pulse" />
                  <span className="text-sm font-semibold text-cyan-700">AI 数字员工</span>
                </div>
                <div className="text-xs text-gray-400 mb-1">7个专业Agent并行运行</div>
                <div className="grid grid-cols-2 gap-1.5 w-full">
                  {AGENTS_DATA.slice(0, 6).map((a, idx) => {
                    const isRunning = runningAgentIdxs.includes(idx)
                    return (
                      <div key={a.type} className={`text-xs px-2 py-1 rounded-lg text-center relative ${a.lightBg} ${a.textColor} border ${a.border} ${isRunning ? 'ring-1 ring-green-300' : ''}`}>
                        {isRunning && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                        {a.label}
                      </div>
                    )
                  })}
                </div>
                <div className={`text-xs px-2 py-1 rounded-lg text-center w-full relative ${AGENTS_DATA[6].lightBg} ${AGENTS_DATA[6].textColor} border ${AGENTS_DATA[6].border} ${runningAgentIdxs.includes(6) ? 'ring-1 ring-green-300' : ''}`}>
                  {runningAgentIdxs.includes(6) && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                  {AGENTS_DATA[6].label}
                </div>
                <div className="flex gap-1 mt-1">
                  <ArrowLeft className="w-3 h-3 text-cyan-400" />
                  <span className="text-xs text-gray-400">3个知识库实时注入</span>
                </div>
              </div>

              {/* 输出 */}
              <div className="space-y-2">
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-2.5">
                  <div className="text-xs font-semibold text-violet-700 mb-1.5">决策输出（Decisions）</div>
                  {AI_CORE.decisions.map(d => (
                    <div key={d} className="text-xs text-gray-500 py-0.5">· {d}</div>
                  ))}
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                  <div className="text-xs font-semibold text-emerald-700 mb-1.5">行动输出（Actions）</div>
                  {AI_CORE.actions.map(a => (
                    <div key={a} className="text-xs text-gray-500 py-0.5">· {a}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* 审批→执行 */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <div className="flex-1 flex items-center gap-2">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2 flex-1">
                  <Users className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-amber-700">人工审批</div>
                    <div className="text-xs text-amber-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> ~1分钟</div>
                  </div>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2 flex-1">
                  <Zap className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-medium text-green-700">自动执行</div>
                    <div className="text-xs text-green-600">任务/草稿/快照</div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 text-right max-w-[160px]">改写内容→反馈样本<br/>驳回+说明→规则原材料</div>
            </div>
          </div>

          {/* 技能工坊层（第2.5层，插在AI协作核心与进化闭环之间） */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">技能工坊</span>
              <span className="text-xs text-gray-400">自训练行动技能，构建数字员工的能力边界</span>
              <Link href="/settings?tab=skills" className="ml-auto text-[10px] text-purple-400 hover:text-purple-600 flex items-center gap-0.5">
                进入技能工坊 <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              {[
                { label: '沙盘训练', sublabel: '对话驱动构建', icon: FlaskConical, desc: '用自然语言描述需求，AI 自动构建技能规格和执行配置' },
                { label: '调试测试', sublabel: '真实执行验证', icon: Zap, desc: '用真实参数测试技能，查看 HTTP 响应或工具调用结果' },
                { label: '封装上架', sublabel: '技能入库', icon: Package, desc: '测试通过后一键封装为标准技能，进入技能库' },
                { label: '装载 Agent', sublabel: '分配给数字员工', icon: Bot, desc: '从技能库选择并分配给指定 Agent 角色，立即生效' },
              ].map((node, i) => (
                <div key={node.label} className="flex items-start flex-1 min-w-0">
                  <Link
                    href="/settings?tab=skills"
                    className="flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors text-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <node.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-medium text-purple-700">{node.label}</span>
                    <span className="text-[10px] text-purple-400">{node.sublabel}</span>
                  </Link>
                  {i < 3 && <ArrowRight className="w-3 h-3 text-purple-300 flex-shrink-0 mt-4 mx-0.5" />}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2.5">支持：HTTP API 调用 / 导入 OpenAI Function Calling 格式 / 引用内置工具 — 训练好的技能可装载给任意数字员工</p>
          </div>

          {/* 第三层：进化闭环 */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">第三层 · 进化闭环</span>
              <span className="text-xs text-gray-400">人工修改→反馈沉淀→规则提炼→自动注入，系统越用越懂这家公司</span>
              <RefreshCw className="w-3 h-3 text-rose-400 ml-auto animate-spin" style={{ animationDuration: '4s' }} />
            </div>
            <div className="flex items-center gap-1">
              {EVOLUTION_FLOW.map((node, i) => {
                const Icon = node.icon
                const isHuman = node.role === 'human'
                return (
                  <div key={node.id} className="flex items-center flex-1 min-w-0">
                    <div className={`flex-1 flex flex-col items-center gap-1 p-2.5 rounded-xl border ${isHuman ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'}`}>
                      <div className={`w-7 h-7 rounded-full ${isHuman ? 'bg-rose-500' : 'bg-blue-500'} flex items-center justify-center`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className={`text-xs font-medium text-center ${isHuman ? 'text-rose-700' : 'text-blue-700'}`}>{node.label}</span>
                      {node.time && <span className="text-xs text-gray-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{node.time}</span>}
                      {!node.time && <span className="text-xs text-blue-500">⚡ 自动</span>}
                    </div>
                    {i < EVOLUTION_FLOW.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mx-0.5" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 汇总：人工耗时 */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-800 mb-1">人的负担有多轻？</p>
                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3 text-amber-500" />信息录入 30秒~2分钟</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3 text-amber-500" />归属确认 ~3秒（低置信度时）</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3 text-amber-500" />行动审批 ~1分钟</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3 text-amber-500" />规则提炼 ~30分钟/周</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-700">90%+</div>
                <div className="text-xs text-blue-500">分析和执行由 AI 自动完成</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: 信号的旅程 ── */}
      {activeTab === 'journey' && (
        <div>
          {/* 进度条 */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => goJourneyTo(Math.max(0, journeyStep - 1))} disabled={journeyStep === 0}
              className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50 disabled:opacity-30">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { if (isPlaying) { setIsPlaying(false) } else { if (journeyStep === JOURNEY_STEPS.length - 1) setJourneyStep(0); setIsPlaying(true) } }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isPlaying ? 'bg-amber-100 text-amber-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? '暂停' : '播放演示'}
            </button>
            <button onClick={() => goJourneyTo(Math.min(JOURNEY_STEPS.length - 1, journeyStep + 1))} disabled={journeyStep === JOURNEY_STEPS.length - 1}
              className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50 disabled:opacity-30">
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1 bg-gray-200 rounded-full h-1.5 mx-2">
              <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${((journeyStep + 1) / JOURNEY_STEPS.length) * 100}%` }} />
            </div>
            <span className="text-xs text-gray-400">{journeyStep + 1} / {JOURNEY_STEPS.length}</span>
          </div>

          {/* 步骤节点列表 */}
          <div className="flex gap-1 mb-4">
            {JOURNEY_STEPS.map((step, i) => {
              const Icon = step.icon
              const isActive = i === journeyStep
              const isPast = i < journeyStep
              const colorMap: Record<string, string> = { purple: 'bg-purple-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500', cyan: 'bg-cyan-500', amber: 'bg-amber-500', green: 'bg-green-500', rose: 'bg-rose-500' }
              const lightMap: Record<string, string> = { purple: 'bg-purple-50 border-purple-300', blue: 'bg-blue-50 border-blue-300', indigo: 'bg-indigo-50 border-indigo-300', cyan: 'bg-cyan-50 border-cyan-300', amber: 'bg-amber-50 border-amber-300', green: 'bg-green-50 border-green-300', rose: 'bg-rose-50 border-rose-300' }
              return (
                <button key={step.id} onClick={() => goJourneyTo(i)}
                  className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${isActive ? lightMap[step.color] + ' shadow-sm' : isPast ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isActive ? colorMap[step.color] : isPast ? 'bg-gray-300' : 'bg-gray-200'}`}>
                    {isPast && !isActive ? <CheckCircle className="w-4 h-4 text-white" /> : <Icon className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="text-xs text-center leading-tight text-gray-600">{step.label}</span>
                </button>
              )
            })}
          </div>

          {/* 当前步骤详情 */}
          <div key={journeyStep} className={`rounded-xl border-2 p-5 transition-all duration-300 animate-[fadeslide_0.25s_ease-out] ${
            currentStep.role === 'human' ? 'bg-amber-50 border-amber-200' :
            currentStep.role === 'ai' ? 'bg-blue-50 border-blue-200' :
            'bg-indigo-50 border-indigo-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <currentStep.icon className={`w-5 h-5 ${currentStep.role === 'human' ? 'text-amber-600' : currentStep.role === 'ai' ? 'text-blue-600' : 'text-indigo-600'}`} />
                <h3 className={`text-sm font-semibold ${currentStep.role === 'human' ? 'text-amber-800' : currentStep.role === 'ai' ? 'text-blue-800' : 'text-indigo-800'}`}>
                  {currentStep.label}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  currentStep.role === 'human' ? 'bg-amber-200 text-amber-800' :
                  currentStep.role === 'ai' ? 'bg-blue-200 text-blue-800' :
                  'bg-indigo-200 text-indigo-800'
                }`}>
                  {currentStep.role === 'human' ? '人工操作' : currentStep.role === 'ai' ? '⚡ AI 自动' : 'AI推荐 + 人工确认'}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{currentStep.time}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <p className="text-xs font-medium text-gray-500 mb-1">场景故事</p>
                <p className="text-xs text-gray-500 italic mb-2">{currentStep.story}</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{currentStep.detail}</p>
                <div className="mt-3">
                  {currentStep.pageHref ? (
                    <Link
                      href={currentStep.pageHref}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      前往 {currentStep.pageLabel}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400 font-mono">{currentStep.pageLabel}</span>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-gray-500 mb-1">数据库状态变化</p>
                <pre className="text-xs text-gray-600 bg-white/70 rounded-lg px-3 py-2.5 border border-white/80 whitespace-pre-wrap leading-relaxed font-mono">
                  {currentStep.dbState}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: 多Agent协作 ── */}
      {activeTab === 'agents' && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 text-sm text-blue-700">
            同一个商机的7个数字员工<strong>并行运行</strong>——每个Agent都能读取其他Agent的最新分析结果，形成协同判断。三类知识库在每次运行前动态注入。
          </div>

          {/* 注入机制 */}
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">每次 Agent 运行前，自动注入三类知识</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Shield, label: '规则库注入', color: 'orange', desc: '从 agentRules 表读取当前生效的所有规则，拼入 System Prompt 尾部。规则立即生效，无需改代码。', example: '【禁止】当真实需求分析阶段时，不要推荐发送报价单\n【必须】出现竞品名称时，必须发出 risk_alert' },
                { icon: BookOpen, label: '资产库注入', color: 'green', desc: '按当前商机阶段筛选，从资产库取使用频率最高的 top-5 素材，附带内容摘录注入到 prompt 中。', example: '- 【案例】山西焦煤VR培训：煤矿行业成功案例背书\n- 【话术】幻威竞品应对：差异化对比要点' },
                { icon: Bot, label: '跨Agent上下文', color: 'cyan', desc: '读取同一商机的其他6个Agent的最新一次运行摘要和决策标签，让当前Agent了解全局状态。', example: 'tender_assistant: "无招标风险"\npresales_assistant: "已有方案，等客户回复"' },
              ].map(({ icon: Icon, label, color, desc, example }) => {
                const colorMap: Record<string, string> = { orange: 'bg-orange-50 border-orange-200', green: 'bg-green-50 border-green-200', cyan: 'bg-cyan-50 border-cyan-200' }
                const iconColorMap: Record<string, string> = { orange: 'bg-orange-400', green: 'bg-green-500', cyan: 'bg-cyan-500' }
                const textColorMap: Record<string, string> = { orange: 'text-orange-700', green: 'text-green-700', cyan: 'text-cyan-700' }
                return (
                  <div key={label} className={`rounded-xl border p-3 ${colorMap[color]}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className={`w-6 h-6 rounded ${iconColorMap[color]} flex items-center justify-center`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className={`text-xs font-semibold ${textColorMap[color]}`}>{label}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{desc}</p>
                    <pre className="text-xs text-gray-500 bg-white/60 rounded px-2 py-1.5 whitespace-pre-wrap font-mono border border-white/80">{example}</pre>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 7个Agent列表 */}
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">7个数字员工 — 点击展开详情</p>
            <div className="grid grid-cols-2 gap-2">
              {AGENTS_DATA.map((agent) => (
                <button
                  key={agent.type}
                  onClick={() => setActiveAgent(activeAgent === agent.type ? null : agent.type)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${activeAgent === agent.type ? `${agent.lightBg} ${agent.border}` : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-7 h-7 rounded-lg ${agent.color} flex items-center justify-center`}>
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-800">{agent.label}</span>
                      <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 rounded">{agent.stage}</span>
                    </div>
                  </div>
                  {activeAgent === agent.type && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs text-gray-600 leading-relaxed">{agent.desc}</p>
                      <div>
                        <span className="text-xs text-gray-400">触发方式：</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {agent.triggers.map(t => (
                            <span key={t} className="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-600">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Agent 协作案例 */}
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">跨Agent协作实例：一个Agent的输出影响另一个Agent的决策</p>
            <div className="space-y-2">
              {CROSS_AGENT_EXAMPLES.map((ex, i) => (
                <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{AGENTS_DATA.find(a => a.type === ex.from)?.label}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className="text-xs bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded font-medium">{AGENTS_DATA.find(a => a.type === ex.to)?.label}</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{ex.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 页面底部 CTA */}
      <div className="mt-8 pt-6 border-t border-gray-200 flex justify-center">
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          立即进入我的主工作台
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
