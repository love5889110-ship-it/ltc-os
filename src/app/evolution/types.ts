/**
 * Agent 能力中心 — 完整类型定义
 * 所有 mock 数据源均按此类型组织，后续替换真实接口时无需改类型
 */

// ─── 页面级 Tab ────────────────────────────────────────────────────────────────

export type CapabilityMode = 'decision' | 'action'
export type EvolutionTab = 'correction' | 'feedback' | 'rules' | 'params' | 'config' | 'tracking'

// ─── 统计卡 ────────────────────────────────────────────────────────────────────

export interface EvolutionStats {
  feedbackCount: number
  adoptionRate: number   // 0-1
  adoptedCount: number
}

// ─── 反馈样本 ──────────────────────────────────────────────────────────────────

export type SampleType =
  | 'task_understanding'
  | 'rule_match'
  | 'action_recommendation'
  | 'skill_routing'
  | 'risk_assessment'
  | 'execution'

export type FeedbackType = 'adopted' | 'rejected' | 'pending'

export type WritebackTarget =
  | 'rule'
  | 'param'
  | 'routing'
  | 'review_gate'
  | 'action_skill'
  | 'config'
  | 'none'

export interface FeedbackSample {
  id: string
  capabilityType: CapabilityMode
  sampleType?: SampleType
  agentName: string
  taskId?: string
  ruleId?: string
  skillId?: string
  decisionId?: string
  actionName?: string
  inputSnapshot: string
  outputSnapshot: string
  feedbackType: FeedbackType
  feedbackComment?: string
  writebackTarget?: WritebackTarget
  createdAt: string
}

// ─── 决策结果 ──────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export interface DecisionResult {
  id: string
  taskType: string
  stage?: string
  recognizedGoal: string
  matchedRules: string[]
  recommendedAction?: string
  recommendedSkillIds?: string[]
  riskLevel: RiskLevel
  requiresHumanReview: boolean
  reason: string
  createdAt: string
}

// ─── 决策评测 ──────────────────────────────────────────────────────────────────

export interface DecisionEvaluation {
  id: string
  decisionId: string
  taskRecognitionScore: number   // 0-100
  ruleMatchScore: number
  actionRecommendationScore: number
  skillRoutingScore: number
  riskAssessmentScore: number
  overallScore: number
  reviewedAt: string
}

// ─── 规则治理 ──────────────────────────────────────────────────────────────────

export interface GovernanceRule {
  id: string
  name: string
  capabilityType: CapabilityMode
  status: 'active' | 'inactive'
  targetAgent?: string
  ruleType?: 'forbid' | 'require' | 'prefer'
  condition?: string
  instruction?: string
  hitCount: number
  updatedAt: string
  source: 'manual' | 'feedback'
}

// ─── 提炼参数 ──────────────────────────────────────────────────────────────────

export interface RefinementParam {
  id: string
  name: string
  capabilityType: CapabilityMode
  description?: string
  value: string | number | boolean
  status: 'active' | 'inactive'
  updatedAt: string
  updatedBy?: string
}

// ─── 配置项 ────────────────────────────────────────────────────────────────────

export interface CapabilityConfig {
  id: string
  key: string
  label: string
  capabilityType: CapabilityMode
  value: string | number | boolean
  valueType: 'string' | 'number' | 'boolean' | 'select'
  options?: string[]
  description?: string
  updatedAt: string
}

// ─── 效果追踪 ──────────────────────────────────────────────────────────────────

export interface EffectTrackingStats {
  totalRuns: number
  acceptRate: number
  avgDecisionsPerRun: number
  topAgents: Array<{ agentType: string; agentLabel: string; acceptRate: number; totalRuns: number }>
  trendData: Array<{ date: string; acceptRate: number; runCount: number }>
}

// ─── 行动技能 ──────────────────────────────────────────────────────────────────

export type SkillSourceType = 'internal' | 'employee_built' | 'external'

export type SkillStatus = 'draft' | 'testing' | 'validated' | 'callable' | 'disabled'

export interface ActionSkill {
  id: string
  name: string
  description: string
  sourceType: SkillSourceType
  sourceName?: string
  type: string
  status: SkillStatus
  sandboxId?: string          // 关联的 skillSandbox id，用于真实测试
  toolSource?: string         // 'http' | 'builtin' | 'code' | 'skill_json' | 'stub'
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  applicableTaskTypes: string[]
  requiresHumanReview: boolean
  successRate: number   // 0-1
  avgDurationMs?: number
  lastTestedAt?: string
  updatedAt: string
}

// ─── 技能适配层 ────────────────────────────────────────────────────────────────

export interface SkillAdapter {
  id: string
  skillId: string
  normalizedInputSchema: Record<string, unknown>
  normalizedOutputSchema: Record<string, unknown>
  permissionScope: string[]
  needsFineTuning: boolean
  needsReviewGate: boolean
  adaptedAt: string
}

// ─── 技能测试样例 ──────────────────────────────────────────────────────────────

export interface SkillTestCase {
  id: string
  skillId: string
  input: string
  expectedOutput?: string
  actualOutput?: string
  status: 'pass' | 'fail' | 'pending'
  errorMessage?: string
}

// ─── 技能评测 ──────────────────────────────────────────────────────────────────

export interface SkillEvaluation {
  skillId: string
  successRate: number
  failureRate: number
  avgDurationMs: number
  errorDistribution: Array<{ errorType: string; count: number }>
  updatedAt: string
}

// ─── 技能绑定 ──────────────────────────────────────────────────────────────────

export interface SkillBinding {
  id: string
  taskType: string
  skillId: string
  priority: number
  enabled: boolean
}

// ─── 执行日志 ──────────────────────────────────────────────────────────────────

export interface SkillExecutionLog {
  id: string
  taskId?: string
  skillId: string
  input: string
  output: string
  status: 'success' | 'failed'
  durationMs: number
  errorMessage?: string
  createdAt: string
}

// ─── 页面聚合 State ────────────────────────────────────────────────────────────

export interface AgentCapabilityPageState {
  stats: EvolutionStats
  feedbackSamples: FeedbackSample[]
  decisionResults: DecisionResult[]
  decisionEvaluations: DecisionEvaluation[]
  rules: GovernanceRule[]
  params: RefinementParam[]
  configs: CapabilityConfig[]
  effectStats: EffectTrackingStats | null
  actionSkills: ActionSkill[]
  skillAdapters: SkillAdapter[]
  skillTestCases: SkillTestCase[]
  skillEvaluations: SkillEvaluation[]
  skillBindings: SkillBinding[]
  executionLogs: SkillExecutionLog[]
  skillRecommendations: SkillRecommendation[]
  skillLoadCandidates: SkillLoadCandidate[]
}

// ─── 状态流转合法映射 ─────────────────────────────────────────────────────────

export const SKILL_STATUS_TRANSITIONS: Record<SkillStatus, SkillStatus[]> = {
  draft: ['testing', 'disabled'],
  testing: ['validated', 'draft', 'disabled'],
  validated: ['callable', 'testing', 'disabled'],
  callable: ['disabled'],
  disabled: ['draft'],
}

// ─── 文案常量 ─────────────────────────────────────────────────────────────────

export const SAMPLE_TYPE_LABELS: Record<SampleType, string> = {
  task_understanding: '任务理解',
  rule_match: '规则命中',
  action_recommendation: '动作推荐',
  skill_routing: '技能路由',
  risk_assessment: '风险判断',
  execution: '执行',
}

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  adopted: '已采纳',
  rejected: '已驳回',
  pending: '待处理',
}

export const SKILL_STATUS_LABELS: Record<SkillStatus, string> = {
  draft: '草稿',
  testing: '测试中',
  validated: '已验证',
  callable: '可调用',
  disabled: '已停用',
}

export const SKILL_SOURCE_LABELS: Record<SkillSourceType, string> = {
  internal: '内生训练',
  employee_built: '员工共创',
  external: '外部生态',
}

export const WRITEBACK_TARGET_LABELS: Record<WritebackTarget, string> = {
  rule: '写回规则库',
  param: '写回提炼参数',
  routing: '更新路由配置',
  review_gate: '加入审核门',
  action_skill: '更新行动技能',
  config: '更新配置',
  none: '不写回',
}

// ─── Skill 推荐 ───────────────────────────────────────────────────────────────

export type RecommendationStatus = 'recommended' | 'sent_to_testing' | 'dismissed'

export interface SkillRecommendation {
  id: string
  skillId?: string               // 关联已有 skillTemplate.id 或 builtin tool id
  title: string
  description: string
  sourceType: SkillSourceType
  sourceName?: string
  recommendedForTaskType?: string
  recommendedForAgent?: string
  recommendationReason: string
  riskLevel: RiskLevel
  requiresAdaptation: boolean
  requiresReviewGate: boolean
  estimatedUsefulness?: number   // 0-1
  status: RecommendationStatus
  createdAt: string
}

export const RECOMMENDATION_STATUS_LABELS: Record<RecommendationStatus, string> = {
  recommended: '待处理',
  sent_to_testing: '已送测',
  dismissed: '已忽略',
}

// ─── 候选装载 ─────────────────────────────────────────────────────────────────

export type CandidateStatus =
  | 'pending_adaptation'
  | 'adapting'
  | 'testing'
  | 'validated'
  | 'callable'
  | 'rejected'

export interface SkillLoadCandidate {
  id: string
  recommendationId?: string
  skillId?: string               // 关联 skillTemplate.id 或 builtin tool id
  sourceType: SkillSourceType
  sourceName?: string
  rawName: string
  description?: string
  rawInputSchema?: Record<string, unknown>
  rawOutputSchema?: Record<string, unknown>
  status: CandidateStatus
  needsSchemaNormalization: boolean
  needsFineTuning: boolean
  needsPermissionReview: boolean
  needsReviewGate: boolean
  targetTaskTypes: string[]
  targetAgents: string[]
  createdAt: string
}

export const CANDIDATE_STATUS_TRANSITIONS: Record<CandidateStatus, CandidateStatus[]> = {
  pending_adaptation: ['adapting', 'rejected'],
  adapting: ['testing', 'pending_adaptation', 'rejected'],
  testing: ['validated', 'adapting', 'rejected'],
  validated: ['callable', 'testing'],
  callable: ['rejected'],
  rejected: ['pending_adaptation'],
}

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  pending_adaptation: '待适配',
  adapting: '适配中',
  testing: '测试中',
  validated: '已验证',
  callable: '可调用',
  rejected: '已拒绝',
}
