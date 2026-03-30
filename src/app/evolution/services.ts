/**
 * Agent 能力中心 — 统一服务层
 *
 * 原则：
 * 1. 所有页面组件通过本文件调用数据，不直接调原始 API
 * 2. 真实接口部分已接入（feedback/rules/agent-prompts/settings/sandbox）
 * 3. 暂用 mock 的部分（decision results/evaluations/params/adapters/bindings）
 *    保留真实函数签名，后续只需替换实现体
 * 4. testActionSkill 复用 /api/sandbox/run，由本层封装
 */

import type {
  CapabilityMode,
  EvolutionStats,
  FeedbackSample,
  FeedbackType,
  WritebackTarget,
  GovernanceRule,
  DecisionResult,
  DecisionEvaluation,
  RefinementParam,
  CapabilityConfig,
  EffectTrackingStats,
  ActionSkill,
  SkillSourceType,
  SkillStatus,
  SkillAdapter,
  SkillTestCase,
  SkillEvaluation,
  SkillBinding,
  SkillExecutionLog,
  SKILL_STATUS_TRANSITIONS,
  SkillRecommendation,
  RecommendationStatus,
  SkillLoadCandidate,
  CandidateStatus,
  RiskLevel,
} from './types'
import { SKILL_STATUS_TRANSITIONS as TRANSITIONS } from './types'

// ─── 工具 ────────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

function now() {
  return new Date().toISOString()
}

// ─── Mock 数据源（按真实结构，可替换）───────────────────────────────────────

const MOCK_DECISION_RESULTS: DecisionResult[] = [
  {
    id: 'dr-001',
    taskType: 'action_recommendation',
    stage: '需求确认',
    recognizedGoal: '识别竞品威胁并建议应对策略',
    matchedRules: ['rule-001', 'rule-002'],
    recommendedAction: 'send_draft',
    recommendedSkillIds: ['sk-001'],
    riskLevel: 'high',
    requiresHumanReview: true,
    reason: '竞品已进场演示，价格低18%，需立即介入',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'dr-002',
    taskType: 'risk_assessment',
    stage: '方案设计',
    recognizedGoal: '评估招标资质缺口风险',
    matchedRules: ['rule-003'],
    recommendedSkillIds: ['sk-002'],
    riskLevel: 'medium',
    requiresHumanReview: false,
    reason: '煤矿安标资质状态不明，需核查',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'dr-003',
    taskType: 'skill_routing',
    stage: '商务谈判',
    recognizedGoal: '路由至报价生成技能',
    matchedRules: [],
    recommendedSkillIds: ['sk-003'],
    riskLevel: 'low',
    requiresHumanReview: false,
    reason: '根据阶段和任务类型，路由至商务报价技能',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

const MOCK_DECISION_EVALUATIONS: DecisionEvaluation[] = [
  {
    id: 'eval-001',
    decisionId: 'dr-001',
    taskRecognitionScore: 92,
    ruleMatchScore: 85,
    actionRecommendationScore: 78,
    skillRoutingScore: 90,
    riskAssessmentScore: 88,
    overallScore: 87,
    reviewedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'eval-002',
    decisionId: 'dr-002',
    taskRecognitionScore: 75,
    ruleMatchScore: 70,
    actionRecommendationScore: 65,
    skillRoutingScore: 80,
    riskAssessmentScore: 82,
    overallScore: 74,
    reviewedAt: new Date(Date.now() - 3600000).toISOString(),
  },
]

const MOCK_PARAMS: RefinementParam[] = [
  {
    id: 'param-001',
    name: '风险预警置信度阈值',
    capabilityType: 'decision',
    description: '触发风险预警所需的最低置信度',
    value: 0.75,
    status: 'active',
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    updatedBy: '系统',
  },
  {
    id: 'param-002',
    name: '最大决策深度',
    capabilityType: 'decision',
    description: '决策链最大递归层数',
    value: 3,
    status: 'active',
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
    updatedBy: '系统',
  },
  {
    id: 'param-003',
    name: '技能调用超时（ms）',
    capabilityType: 'action',
    description: '单次技能调用的最大等待时间',
    value: 5000,
    status: 'active',
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    updatedBy: '系统',
  },
  {
    id: 'param-004',
    name: '自动重试次数',
    capabilityType: 'action',
    description: '技能执行失败后自动重试次数',
    value: 2,
    status: 'inactive',
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    updatedBy: '系统',
  },
]

const MOCK_CONFIGS: CapabilityConfig[] = [
  {
    id: 'cfg-001',
    key: 'decision_depth',
    label: '决策分析深度',
    capabilityType: 'decision',
    value: 'standard',
    valueType: 'select',
    options: ['standard', 'deep'],
    description: 'standard: 快速决策；deep: 多轮推理',
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'cfg-002',
    key: 'auto_execute_threshold',
    label: '自动执行置信度阈值',
    capabilityType: 'action',
    value: 0.9,
    valueType: 'number',
    description: '高于此置信度时，技能可跳过人工审核自动执行',
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
]

const MOCK_ACTION_SKILLS: ActionSkill[] = [
  {
    id: 'sk-001',
    name: '竞品应对草稿生成',
    description: '根据竞品信息和客户阶段，自动生成针对性沟通草稿',
    sourceType: 'internal',
    type: 'document',
    status: 'callable',
    inputSchema: { competitorName: 'string', stage: 'string', customerIndustry: 'string' },
    outputSchema: { draft: 'string', keyPoints: 'string[]' },
    applicableTaskTypes: ['send_draft', 'action_recommendation'],
    requiresHumanReview: true,
    successRate: 0.91,
    avgDurationMs: 2300,
    lastTestedAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'sk-002',
    name: '招标资质核查',
    description: '检查企业资质文件是否满足招标要求',
    sourceType: 'employee_built',
    sourceName: '李工（商务团队）',
    type: 'data',
    status: 'validated',
    inputSchema: { tenderRequirements: 'string[]', companyProfile: 'object' },
    outputSchema: { gaps: 'string[]', recommendations: 'string[]' },
    applicableTaskTypes: ['create_task'],
    requiresHumanReview: true,
    successRate: 0.84,
    avgDurationMs: 1800,
    lastTestedAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'sk-003',
    name: '报价策略生成',
    description: '根据竞品报价和客户预算，生成差异化报价策略',
    sourceType: 'internal',
    type: 'document',
    status: 'testing',
    inputSchema: { competitorPrice: 'number', customerBudget: 'number', valuePoints: 'string[]' },
    outputSchema: { pricingStrategy: 'string', justification: 'string' },
    applicableTaskTypes: ['send_draft', 'create_collab'],
    requiresHumanReview: true,
    successRate: 0.72,
    avgDurationMs: 3100,
    lastTestedAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'sk-004',
    name: 'OpenClaw 竞品情报抓取',
    description: '从外部数据源抓取竞品最新动态',
    sourceType: 'external',
    sourceName: 'OpenClaw v2.1',
    type: 'browse',
    status: 'draft',
    inputSchema: { competitorName: 'string', keywords: 'string[]' },
    outputSchema: { intel: 'string', sources: 'string[]' },
    applicableTaskTypes: [],
    requiresHumanReview: true,
    successRate: 0,
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'sk-005',
    name: '投标文件 AI 辅助',
    description: '基于招标文件自动填写投标响应文件',
    sourceType: 'employee_built',
    sourceName: '王工（售前团队）',
    type: 'document',
    status: 'draft',
    inputSchema: { tenderDoc: 'string', companyProfile: 'object' },
    outputSchema: { response: 'string', checklist: 'string[]' },
    applicableTaskTypes: [],
    requiresHumanReview: true,
    successRate: 0,
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
]

const MOCK_ADAPTERS: SkillAdapter[] = [
  {
    id: 'adp-001',
    skillId: 'sk-002',
    normalizedInputSchema: { requirements: 'string[]', profile: 'object' },
    normalizedOutputSchema: { gapList: 'string[]', suggestions: 'string[]' },
    permissionScope: ['read:company_profile', 'read:tender_docs'],
    needsFineTuning: false,
    needsReviewGate: true,
    adaptedAt: new Date(Date.now() - 172800000).toISOString(),
  },
]

const MOCK_BINDINGS: SkillBinding[] = [
  { id: 'bind-001', taskType: 'send_draft', skillId: 'sk-001', priority: 1, enabled: true },
  { id: 'bind-002', taskType: 'create_task', skillId: 'sk-002', priority: 1, enabled: true },
  { id: 'bind-003', taskType: 'send_draft', skillId: 'sk-003', priority: 2, enabled: false },
]

// ─── 决策能力 Services ────────────────────────────────────────────────────────

/**
 * 获取统计卡数据（从真实反馈 API 聚合）
 */
export async function getEvolutionStats(_mode: CapabilityMode): Promise<EvolutionStats> {
  const res = await fetch('/api/feedback')
  if (!res.ok) return { feedbackCount: 0, adoptionRate: 0, adoptedCount: 0 }
  const data = await res.json()
  const samples: Array<{ feedbackLabel: string }> = data.samples ?? []
  const total = samples.length
  const adopted = samples.filter((s) => s.feedbackLabel === 'accepted').length
  return {
    feedbackCount: total,
    adoptedCount: adopted,
    adoptionRate: total > 0 ? adopted / total : 0,
  }
}

export interface FeedbackFilters {
  capabilityType?: CapabilityMode | 'all'
  agentName?: string
  feedbackType?: FeedbackType | 'all'
  sampleType?: string
}

/**
 * 获取反馈样本列表（真实 API，映射为 FeedbackSample 结构）
 */
export async function getFeedbackSamples(filters: FeedbackFilters = {}): Promise<FeedbackSample[]> {
  const res = await fetch('/api/feedback')
  if (!res.ok) return []
  const data = await res.json()
  const raw: Array<{
    id: string
    agentType: string | null
    scenarioType: string | null
    feedbackLabel: string
    feedbackReasonCode: string | null
    originalOutputJson: Record<string, unknown>
    correctedOutputJson: Record<string, unknown>
    reusableFlag: boolean | null
    createdAt: string | null
  }> = data.samples ?? []

  let mapped: FeedbackSample[] = raw.map((s) => ({
    id: s.id,
    capabilityType: (s.scenarioType?.startsWith('action_') ? 'action' : 'decision') as CapabilityMode,
    sampleType: s.scenarioType as FeedbackSample['sampleType'],
    agentName: s.agentType ?? '未知',
    inputSnapshot: JSON.stringify(s.originalOutputJson ?? {}).slice(0, 200),
    outputSnapshot: JSON.stringify(s.correctedOutputJson ?? {}).slice(0, 200),
    feedbackType: (
      s.feedbackLabel === 'accepted' ? 'adopted'
      : s.feedbackLabel === 'rejected' ? 'rejected'
      : 'pending'
    ) as FeedbackType,
    feedbackComment: s.feedbackReasonCode ?? undefined,
    writebackTarget: 'none' as WritebackTarget,
    createdAt: s.createdAt ?? now(),
  }))

  // 客户端过滤
  if (filters.feedbackType && filters.feedbackType !== 'all') {
    mapped = mapped.filter((s) => s.feedbackType === filters.feedbackType)
  }
  if (filters.agentName && filters.agentName !== 'all') {
    mapped = mapped.filter((s) => s.agentName === filters.agentName)
  }
  if (filters.sampleType && filters.sampleType !== 'all') {
    mapped = mapped.filter((s) => s.sampleType === filters.sampleType)
  }

  return mapped
}

/**
 * 更新反馈状态（采纳/驳回）+ 写回目标（本地 state 层面，写回逻辑在 page.tsx）
 * 真实端只写入 feedback API（目前接口尚无 PATCH，先只本地更新）
 */
export async function updateFeedbackStatus(
  _id: string,
  _status: FeedbackType,
  _writebackTarget?: WritebackTarget
): Promise<void> {
  // TODO: 接入 PATCH /api/feedback/:id 后替换
  // 当前：纯本地 state 更新，由 page.tsx 的 setState 处理
}

/**
 * 获取规则治理列表（真实 API，映射为 GovernanceRule）
 */
export async function getGovernanceRules(_mode: CapabilityMode): Promise<GovernanceRule[]> {
  const res = await fetch('/api/rules')
  if (!res.ok) return []
  const data = await res.json()
  const raw: Array<{
    id: string
    agentType: string
    ruleType: 'forbid' | 'require' | 'prefer'
    condition: string
    instruction: string
    createdFrom: string
    enabled: boolean
    updatedAt: string | null
  }> = data.rules ?? []

  return raw.map((r) => ({
    id: r.id,
    name: r.instruction.slice(0, 40),
    capabilityType: 'decision' as CapabilityMode,
    status: r.enabled ? 'active' : 'inactive',
    targetAgent: r.agentType,
    ruleType: r.ruleType,
    condition: r.condition,
    instruction: r.instruction,
    hitCount: Math.floor(Math.random() * 50),   // TODO: 接入真实命中统计
    updatedAt: r.updatedAt ?? now(),
    source: (r.createdFrom === 'manual' ? 'manual' : 'feedback') as 'manual' | 'feedback',
  }))
}

/**
 * 启用/停用规则（真实 API）
 */
export async function toggleGovernanceRule(id: string, status: 'active' | 'inactive'): Promise<void> {
  await fetch('/api/rules', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, enabled: status === 'active' }),
  })
}

/**
 * 新建规则（真实 API，用于写回逻辑）
 */
export async function createGovernanceRule(payload: {
  agentType: string
  ruleType: 'forbid' | 'require' | 'prefer'
  condition: string
  instruction: string
  createdFrom?: string
}): Promise<{ id: string }> {
  const res = await fetch('/api/rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

/**
 * 获取决策结果（当前 mock，接口就绪后替换）
 */
export async function getDecisionResults(): Promise<DecisionResult[]> {
  return MOCK_DECISION_RESULTS
}

/**
 * 获取决策评测（当前 mock，接口就绪后替换）
 */
export async function getDecisionEvaluations(): Promise<DecisionEvaluation[]> {
  return MOCK_DECISION_EVALUATIONS
}

/**
 * 获取提炼参数（当前 mock，接口就绪后替换）
 */
export async function getRefinementParams(mode: CapabilityMode): Promise<RefinementParam[]> {
  return MOCK_PARAMS.filter((p) => p.capabilityType === mode)
}

/**
 * 更新提炼参数值（本地 state，接口就绪后替换）
 */
export async function updateRefinementParam(
  _id: string,
  _value: string | number | boolean
): Promise<void> {
  // TODO: 接入 PATCH /api/refinement-params/:id
}

/**
 * 获取配置项（当前 mock）
 */
export async function getCapabilityConfigs(mode?: CapabilityMode): Promise<CapabilityConfig[]> {
  return mode ? MOCK_CONFIGS.filter((c) => c.capabilityType === mode) : MOCK_CONFIGS
}

/**
 * 更新配置项（本地 state，接口就绪后替换）
 */
export async function updateCapabilityConfig(
  _id: string,
  _value: string | number | boolean
): Promise<void> {
  // TODO: 接入 PATCH /api/capability-configs/:id
}

/**
 * 获取效果追踪统计（真实 API）
 */
export async function getEffectTrackingStats(_mode: CapabilityMode): Promise<EffectTrackingStats | null> {
  const res = await fetch('/api/agent-stats')
  if (!res.ok) return null
  const data = await res.json()
  const agentStats: Array<{
    agentType: string
    agentLabel: string
    totalRuns: number
    acceptRate: number
  }> = data.agentStats ?? []

  const totalRuns = agentStats.reduce((s, a) => s + (a.totalRuns ?? 0), 0)
  const avgAccept = agentStats.length > 0
    ? agentStats.reduce((s, a) => s + (a.acceptRate ?? 0), 0) / agentStats.length
    : 0

  return {
    totalRuns,
    acceptRate: avgAccept,
    avgDecisionsPerRun: data.avgDecisionsPerRun ?? 2.4,
    topAgents: agentStats.slice(0, 5),
    trendData: data.trendData ?? [],
  }
}

// ─── 行动能力 Services ────────────────────────────────────────────────────────

/**
 * 获取行动技能列表（真实 API：skill-templates，映射为 ActionSkill）
 */
export async function getActionSkills(): Promise<ActionSkill[]> {
  const res = await fetch('/api/skill-templates')
  if (!res.ok) return MOCK_ACTION_SKILLS  // fallback to mock

  const data = await res.json()
  const templates: Array<{
    id: string
    name: string
    description: string
    category: string
    toolSource: string
    enabled: boolean
    skillSpecJson: Record<string, unknown>
    createdAt: string
  }> = data.templates ?? []

  // 若真实模板为空，返回 mock
  if (templates.length === 0) return MOCK_ACTION_SKILLS

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    sourceType: 'internal' as SkillSourceType,
    type: t.category,
    toolSource: t.toolSource,
    sandboxId: (t as any).sourceSandboxId ?? undefined,  // 关联沙盘 id，供真实测试用
    status: t.enabled ? 'callable' : 'disabled',
    inputSchema: (t.skillSpecJson as any)?.inputSchema ?? {},
    outputSchema: (t.skillSpecJson as any)?.outputSchema ?? {},
    applicableTaskTypes: (t.skillSpecJson as any)?.applicableTaskTypes ?? [],
    requiresHumanReview: false,
    successRate: 0.85,
    updatedAt: t.createdAt,
  }))
}

/**
 * 新建技能（内生训练，从沙盘创建）
 */
export async function createActionSkill(payload: {
  name: string
  description: string
  type: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  applicableTaskTypes: string[]
}): Promise<ActionSkill> {
  // 新建沙盘作为技能草稿
  const res = await fetch('/api/skill-sandbox?action=chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage: `创建技能：${payload.name}。描述：${payload.description}。输入参数：${JSON.stringify(payload.inputSchema)}。输出格式：${JSON.stringify(payload.outputSchema)}`,
    }),
  })

  const sandboxId = res.ok ? (await res.json()).sandboxId : genId()
  const skill: ActionSkill = {
    id: sandboxId,
    name: payload.name,
    description: payload.description,
    sourceType: 'internal',
    type: payload.type,
    status: 'draft',   // 新建总是 draft
    inputSchema: payload.inputSchema,
    outputSchema: payload.outputSchema,
    applicableTaskTypes: payload.applicableTaskTypes,
    requiresHumanReview: false,
    successRate: 0,
    updatedAt: now(),
  }
  return skill
}

/**
 * 导入外部/员工共创技能
 * 强制规则：导入后 status 必须为 draft，禁止直接 callable
 */
export async function importActionSkill(payload: {
  skillJson: Record<string, unknown>
  sourceType: 'employee_built' | 'external'
  sourceName?: string
}): Promise<ActionSkill> {
  const res = await fetch('/api/skill-sandbox?action=import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillJson: payload.skillJson }),
  })

  const spec = res.ok ? (await res.json()).skillSpec ?? payload.skillJson : payload.skillJson
  const skill: ActionSkill = {
    id: genId(),
    name: (spec as any).name ?? '未命名导入技能',
    description: (spec as any).description ?? '',
    sourceType: payload.sourceType,
    sourceName: payload.sourceName,
    type: (spec as any).category ?? 'data',
    status: 'draft',  // ← 强制 draft，禁止跳过适配流程
    inputSchema: (spec as any).parameters?.properties ?? {},
    outputSchema: {},
    applicableTaskTypes: [],
    requiresHumanReview: true,   // 外部/员工共创默认需要人工审核
    successRate: 0,
    updatedAt: now(),
  }
  return skill
}

/**
 * 技能调试执行（真实执行）
 * - 有 sandboxId：调 /api/skill-sandbox?action=test（真实 HTTP/builtin 执行）
 * - 无 sandboxId（内置工具）：调 /api/skills/test
 * 返回执行日志，供调用方写入 executionLogs
 */
export async function testActionSkill(
  skill: ActionSkill,
  input: Record<string, unknown>
): Promise<SkillExecutionLog> {
  const start = Date.now()
  const logId = genId()

  try {
    let res: Response

    if (skill.sandboxId) {
      // 自训练技能：通过沙盘真实执行
      res = await fetch('/api/skill-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          sandboxId: skill.sandboxId,
          testParams: input,
        }),
      })
    } else {
      // 内置工具：直接调工具测试接口
      res = await fetch('/api/skills/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: skill.id, toolInput: input }),
      })
    }

    const durationMs = Date.now() - start

    if (!res.ok) {
      const err = await res.text()
      return {
        id: logId, skillId: skill.id,
        input: JSON.stringify(input), output: '',
        status: 'failed', durationMs,
        errorMessage: `HTTP ${res.status}: ${err}`,
        createdAt: now(),
      }
    }

    const data = await res.json()
    const success = data.success !== false
    const output = JSON.stringify(data.data ?? data.result ?? data.message ?? data)

    return {
      id: logId, skillId: skill.id,
      input: JSON.stringify(input), output,
      status: success ? 'success' : 'failed',
      durationMs,
      errorMessage: success ? undefined : (data.message ?? '执行失败'),
      createdAt: now(),
    }
  } catch (err) {
    return {
      id: logId, skillId: skill.id,
      input: JSON.stringify(input), output: '',
      status: 'failed',
      durationMs: Date.now() - start,
      errorMessage: String(err),
      createdAt: now(),
    }
  }
}

/**
 * 获取技能测试样例（本地 state）
 */
export async function getSkillTestCases(skillId?: string): Promise<SkillTestCase[]> {
  // In-memory only; populated by ActionSkillTestCasePanel
  void skillId
  return []
}

/**
 * 批量运行测试样例
 */
export async function runActionSkillCases(
  skill: ActionSkill,
  testCases: SkillTestCase[]
): Promise<{ updatedCases: SkillTestCase[]; logs: SkillExecutionLog[] }> {
  const updatedCases: SkillTestCase[] = []
  const logs: SkillExecutionLog[] = []
  for (const tc of testCases) {
    let input: Record<string, unknown> = {}
    try { input = JSON.parse(tc.input) } catch { input = { raw: tc.input } }

    const log = await testActionSkill(skill, input)
    logs.push(log)
    updatedCases.push({
      ...tc,
      actualOutput: log.output,
      status: log.status === 'success' ? 'pass' : 'fail',
      errorMessage: log.errorMessage,
    })
  }
  return { updatedCases, logs }
}

/**
 * 技能状态流转（含合法性校验）
 */
export async function updateActionSkillStatus(
  skillId: string,
  currentStatus: SkillStatus,
  newStatus: SkillStatus
): Promise<{ success: boolean; error?: string }> {
  const allowed = TRANSITIONS[currentStatus]
  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `不允许从「${currentStatus}」直接变为「${newStatus}」`,
    }
  }

  // 调真实 API（skill-templates PATCH）
  const res = await fetch('/api/skill-templates', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: skillId, enabled: newStatus === 'callable' }),
  })

  if (!res.ok) {
    // fallback: 本地 state 层面更新
    console.warn('[updateActionSkillStatus] API failed, local update only')
  }

  return { success: true }
}

/**
 * 从执行日志聚合技能评测数据
 */
export function computeSkillEvaluation(
  skillId: string,
  logs: SkillExecutionLog[]
): SkillEvaluation {
  const skillLogs = logs.filter((l) => l.skillId === skillId)
  if (skillLogs.length === 0) {
    return {
      skillId,
      successRate: 0,
      failureRate: 0,
      avgDurationMs: 0,
      errorDistribution: [],
      updatedAt: now(),
    }
  }

  const success = skillLogs.filter((l) => l.status === 'success').length
  const failed = skillLogs.filter((l) => l.status === 'failed').length
  const avgDuration = skillLogs.reduce((s, l) => s + l.durationMs, 0) / skillLogs.length

  // 统计错误分布
  const errorMap: Record<string, number> = {}
  skillLogs
    .filter((l) => l.status === 'failed' && l.errorMessage)
    .forEach((l) => {
      const errType = l.errorMessage!.split(':')[0].trim()
      errorMap[errType] = (errorMap[errType] ?? 0) + 1
    })

  return {
    skillId,
    successRate: success / skillLogs.length,
    failureRate: failed / skillLogs.length,
    avgDurationMs: Math.round(avgDuration),
    errorDistribution: Object.entries(errorMap).map(([errorType, count]) => ({ errorType, count })),
    updatedAt: now(),
  }
}

/**
 * 获取技能适配器（当前 mock）
 */
export async function getSkillAdapters(skillId?: string): Promise<SkillAdapter[]> {
  if (skillId) return MOCK_ADAPTERS.filter((a) => a.skillId === skillId)
  return MOCK_ADAPTERS
}

/**
 * 保存技能适配器（本地 state，接口就绪后替换）
 */
export async function saveSkillAdapter(payload: Omit<SkillAdapter, 'id' | 'adaptedAt'>): Promise<SkillAdapter> {
  return { ...payload, id: genId(), adaptedAt: now() }
}

/**
 * 获取技能绑定（真实 API：/api/skills）
 */
export async function getSkillBindings(skillId?: string): Promise<SkillBinding[]> {
  const res = await fetch('/api/skills')
  if (!res.ok) return MOCK_BINDINGS.filter((b) => !skillId || b.skillId === skillId)
  const data = await res.json()
  const agentSkills: Array<{ id: string; toolId: string; agentType: string; enabled: boolean }> = data.skills ?? []
  const bindings: SkillBinding[] = agentSkills.map((s, i) => ({
    id: s.id,
    taskType: s.agentType,
    skillId: s.toolId,
    priority: i + 1,
    enabled: s.enabled,
  }))
  return skillId ? bindings.filter((b) => b.skillId === skillId) : bindings
}

/**
 * 保存技能绑定（真实 API：/api/skills）
 */
export async function saveSkillBinding(
  payload: Partial<SkillBinding> & { taskType: string; skillId: string; priority: number; enabled: boolean }
): Promise<SkillBinding> {
  if (payload.id) {
    // 更新已有绑定
    await fetch('/api/skills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillId: payload.id, enabled: payload.enabled }),
    })
    return payload as SkillBinding
  }
  // 新建绑定
  const res = await fetch('/api/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentType: payload.taskType, toolId: payload.skillId, enabled: payload.enabled }),
  })
  const data = await res.json()
  return { ...payload, id: data.skillId ?? genId() } as SkillBinding
}

/**
 * 删除技能绑定（真实 API：/api/skills）
 */
export async function deleteSkillBinding(id: string): Promise<void> {
  await fetch('/api/skills', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId: id }),
  })
}

/**
 * 将执行日志写入反馈样本候选（真实 API）
 */
export async function addLogToFeedbackCandidate(
  log: SkillExecutionLog,
  skillName: string
): Promise<void> {
  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceType: 'skill_execution_log',
      sourceObjectId: log.id,
      agentType: null,
      scenarioType: 'execution',
      originalOutputJson: { input: log.input, output: log.output, skillName },
      correctedOutputJson: {},
      feedbackLabel: 'rejected',
      feedbackReasonCode: log.errorMessage ?? '执行失败',
      reusableFlag: true,
    }),
  })
}

// ─── Skill 推荐中心 Services ──────────────────────────────────────────────────

// 内置工具基础信息（与 tool-registry 保持同步，前端不能直接 import server 模块）
const BUILTIN_TOOL_DEFS = [
  { id: 'wecom.send_message', name: '发送企业微信消息', description: '向企业微信用户发送文本消息', requiresConnector: 'wecom' },
  { id: 'dingtalk.send_message', name: '发送钉钉群消息', description: '向钉钉群发送通知消息', requiresConnector: 'dingtalk' },
  { id: 'email.send', name: '发送邮件', description: '向指定邮箱发送邮件', requiresConnector: null },
  { id: 'web.browse', name: '浏览网页', description: '访问指定 URL 并提取内容，适合竞品调研和招标信息查询', requiresConnector: null },
  { id: 'document.create_ppt', name: '生成 PPT 大纲', description: '根据标题和主题 AI 生成演示文稿大纲', requiresConnector: null },
]

/**
 * 获取 Skill 推荐列表（真实数据：从 skillTemplates 读取未装载技能 + 内置工具）
 */
export async function getSkillRecommendations(): Promise<SkillRecommendation[]> {
  // 获取已发布的 skillTemplates
  let templates: Array<{ id: string; name: string; description: string; category: string; toolSource: string }> = []
  try {
    const res = await fetch('/api/skill-templates')
    if (res.ok) {
      const data = await res.json()
      templates = data.templates ?? []
    }
  } catch { /* fallback to empty */ }

  // 获取已装载给 Agent 的技能（避免重复推荐）
  let loadedToolIds = new Set<string>()
  try {
    const res = await fetch('/api/skills')
    if (res.ok) {
      const data = await res.json()
      const agentSkillsList: Array<{ toolId: string }> = data.skills ?? []
      loadedToolIds = new Set(agentSkillsList.map((s) => s.toolId))
    }
  } catch { /* ignore */ }

  const recommendations: SkillRecommendation[] = []

  // 预置技能库（skillTemplates）中未装载的 → 推荐
  for (const t of templates) {
    if (!loadedToolIds.has(t.id)) {
      recommendations.push({
        id: `rec-tpl-${t.id}`,
        skillId: t.id,
        title: t.name,
        description: t.description,
        sourceType: 'internal',
        recommendationReason: '平台预置技能，覆盖商机推进常用场景，尚未装载给任何 Agent',
        riskLevel: 'low',
        requiresAdaptation: false,
        requiresReviewGate: false,
        estimatedUsefulness: 0.85,
        status: 'recommended',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // 内置工具中未装载的 → 推荐
  for (const tool of BUILTIN_TOOL_DEFS) {
    if (!loadedToolIds.has(tool.id)) {
      recommendations.push({
        id: `rec-builtin-${tool.id}`,
        skillId: tool.id,
        title: tool.name,
        description: tool.description,
        sourceType: 'internal',
        recommendationReason: tool.requiresConnector
          ? `内置工具，需先在「连接器与模型」中配置 ${tool.requiresConnector}，配置后可直接装载给 Agent`
          : '内置工具，无需额外配置，可直接装载给 Agent',
        riskLevel: 'low',
        requiresAdaptation: false,
        requiresReviewGate: false,
        estimatedUsefulness: 0.9,
        status: 'recommended',
        createdAt: new Date().toISOString(),
      })
    }
  }

  return recommendations
}

/**
 * 更新推荐状态（本地 state，无需持久化）
 */
export async function updateRecommendationStatus(
  _id: string,
  _status: RecommendationStatus
): Promise<void> {
  // 前端 state 层面操作，不需要后端
}

/**
 * 将推荐项送入测试装载区（创建候选对象）
 */
export async function sendRecommendationToTesting(
  rec: SkillRecommendation
): Promise<SkillLoadCandidate> {
  // 如果推荐的是已有 skillTemplate，查询其 inputSchema
  let rawInputSchema: Record<string, unknown> | undefined
  if (rec.skillId) {
    try {
      const res = await fetch(`/api/skill-sandbox?id=${rec.skillId}`)
      if (res.ok) {
        const sandbox = await res.json()
        rawInputSchema = (sandbox.skillSpecJson as any)?.inputSchema
      }
    } catch { /* ignore */ }
  }

  const candidate: SkillLoadCandidate = {
    id: `cand-${genId()}`,
    recommendationId: rec.id,
    skillId: rec.skillId,
    sourceType: rec.sourceType,
    sourceName: rec.sourceName,
    rawName: rec.title,
    description: rec.description,
    rawInputSchema: rawInputSchema ?? {},
    rawOutputSchema: {},
    status: 'pending_adaptation',
    needsSchemaNormalization: rec.requiresAdaptation,
    needsFineTuning: false,
    needsPermissionReview: rec.riskLevel !== 'low',
    needsReviewGate: rec.requiresReviewGate,
    targetTaskTypes: [],
    targetAgents: [],
    createdAt: new Date().toISOString(),
  }
  return candidate
}

/**
 * 获取技能装载候选列表（本地 state，初始为空，由推荐中心或手动导入添加）
 */
export async function getSkillLoadCandidates(): Promise<SkillLoadCandidate[]> {
  return []
}

/**
 * 更新候选状态（本地 state）
 */
export async function updateCandidateStatus(
  _id: string,
  _status: CandidateStatus
): Promise<void> {
  // 前端 state 操作
}

/**
 * 发布候选为可调用技能（写入 agentSkills 表）
 * 需提供：候选对象、已完成的适配器、目标 Agent 类型列表
 */
export async function publishCandidateAsCallable(
  candidate: SkillLoadCandidate,
  _adapter: SkillAdapter | null,
  targetAgents: string[]
): Promise<ActionSkill> {
  const skillId = candidate.skillId ?? candidate.id

  // 逐个 Agent 写入 agentSkills
  for (const agentType of targetAgents) {
    await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentType, toolId: skillId }),
    })
  }

  const skill: ActionSkill = {
    id: skillId,
    name: candidate.rawName,
    description: candidate.description ?? '',
    sourceType: candidate.sourceType,
    sourceName: candidate.sourceName,
    type: 'data',
    status: 'callable',
    inputSchema: candidate.rawInputSchema ?? {},
    outputSchema: candidate.rawOutputSchema ?? {},
    applicableTaskTypes: candidate.targetTaskTypes,
    requiresHumanReview: candidate.needsReviewGate,
    successRate: 0,
    updatedAt: new Date().toISOString(),
  }
  return skill
}

// ─── 候选适配工具 ────────────────────────────────────────────────────────────

/**
 * 将装载候选转换为临时 ActionSkill，供 ActionSkillAdapterPanel/TestPanel 等复用。
 * 关键约定：
 * - skill.id = candidate.id（适配器/日志都以 candidateId 为 key，自动匹配）
 * - skill.sandboxId = candidate.skillId（若有关联沙盘，用于真实执行）
 * - skill.status 固定 'draft'（不触发面板内状态流转按钮）
 */
export function candidateToSkill(candidate: SkillLoadCandidate): ActionSkill {
  return {
    id: candidate.id,
    name: candidate.rawName,
    description: candidate.description ?? '',
    sourceType: candidate.sourceType,
    sourceName: candidate.sourceName,
    type: 'data',
    status: 'draft',
    sandboxId: candidate.skillId,
    inputSchema: candidate.rawInputSchema ?? {},
    outputSchema: candidate.rawOutputSchema ?? {},
    applicableTaskTypes: candidate.targetTaskTypes,
    requiresHumanReview: candidate.needsReviewGate,
    successRate: 0,
    updatedAt: candidate.createdAt,
  }
}
