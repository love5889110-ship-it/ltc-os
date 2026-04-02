import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  boolean,
  pgEnum,
  primaryKey,
} from 'drizzle-orm/pg-core'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const connectorTypeEnum = pgEnum('connector_type', [
  'get_note', 'recording', 'dingtalk', 'file_ocr', 'wechat_proxy', 'manual', 'wecom',
])

export const authStatusEnum = pgEnum('auth_status', ['pending', 'authorized', 'expired', 'error'])
export const healthStatusEnum = pgEnum('health_status', ['healthy', 'degraded', 'down'])

export const signalTypeEnum = pgEnum('signal_type', [
  'demand', 'risk', 'opportunity', 'blocker', 'escalation', 'info',
])

export const signalStatusEnum = pgEnum('signal_status', [
  'unbound', 'pending_confirm', 'bound', 'triggered', 'closed',
])

export const bindingStatusEnum = pgEnum('binding_status', [
  'candidate', 'confirmed', 'rejected', 'auto_bound',
])

export const agentTypeEnum = pgEnum('agent_type', [
  'coordinator', 'sales', 'presales_assistant', 'tender_assistant',
  'handover', 'service_triage', 'asset_governance',
])

export const triggerTypeEnum = pgEnum('trigger_type', [
  'signal', 'stage_change', 'scheduled', 'manual', 'execution_callback',
])

export const runStatusEnum = pgEnum('run_status', [
  'running', 'completed', 'failed', 'cancelled',
])

export const actionTypeEnum = pgEnum('action_type', [
  'create_task', 'create_collab', 'update_status', 'send_draft',
  'escalate', 'create_snapshot', 'notify', 'call_tool',
  // 预置能力类型（AI内容生成）
  'generate_solution_ppt', 'generate_scene_render', 'generate_tender_doc',
  'parse_tender_document', 'extract_contract_risks',
  'generate_quotation', 'generate_safety_proposal', 'generate_after_sales_report',
])

export const executionModeEnum = pgEnum('execution_mode', [
  'auto', 'approval_required', 'manual',
])

export const actionStatusEnum = pgEnum('action_status', [
  'pending', 'pending_approval', 'approved', 'rejected', 'executing',
  'completed', 'failed', 'cancelled',
])

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending', 'approved', 'rejected', 'escalated',
])

export const interventionTypeEnum = pgEnum('intervention_type', [
  'correct_binding', 'modify_output', 'reject_action', 'add_context', 'override_decision',
])

export const feedbackLabelEnum = pgEnum('feedback_label', [
  'accepted', 'modified', 'rejected',
])

export const workspaceStatusEnum = pgEnum('workspace_status', [
  'active', 'paused', 'closed',
])

export const threadStatusEnum = pgEnum('thread_status', [
  'idle', 'running', 'error', 'paused',
])

// ─── Master Data (stubs — real tables would be in existing system) ───────────

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  industry: text('industry'),
  region: text('region'),
  profileJson: jsonb('profile_json').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  name: text('name').notNull(),
  role: text('role'),
  phone: text('phone'),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const channelPartners = pgTable('channel_partners', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  region: text('region'),
  profileJson: jsonb('profile_json').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const opportunities = pgTable('opportunities', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  name: text('name').notNull(),
  stage: text('stage').notNull().default('初接触'),
  amount: real('amount'),
  ownerUserId: text('owner_user_id'),
  channelPartner: text('channel_partner'),
  channelPartnerId: text('channel_partner_id').references(() => channelPartners.id),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Runtime Core ─────────────────────────────────────────────────────────────

export const connectorInstances = pgTable('connector_instances', {
  id: text('id').primaryKey(),
  connectorType: connectorTypeEnum('connector_type').notNull(),
  connectorName: text('connector_name').notNull(),
  authStatus: authStatusEnum('auth_status').notNull().default('pending'),
  healthStatus: healthStatusEnum('health_status').notNull().default('healthy'),
  configJson: jsonb('config_json').default({}),
  lastSyncAt: timestamp('last_sync_at'),
  cursorToken: text('cursor_token'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const signalEvents = pgTable('signal_events', {
  id: text('id').primaryKey(),
  sourceType: connectorTypeEnum('source_type').notNull(),
  sourceInstanceId: text('source_instance_id').references(() => connectorInstances.id),
  externalEventId: text('external_event_id'),
  rawContent: text('raw_content'),
  normalizedContent: text('normalized_content'),
  contentSummary: text('content_summary'),
  eventTime: timestamp('event_time').defaultNow(),
  signalType: signalTypeEnum('signal_type'),
  priority: integer('priority').default(3),
  confidenceScore: real('confidence_score'),
  parsedEntitiesJson: jsonb('parsed_entities_json').default({}),
  status: signalStatusEnum('status').notNull().default('unbound'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const signalBindings = pgTable('signal_bindings', {
  id: text('id').primaryKey(),
  signalEventId: text('signal_event_id').notNull().references(() => signalEvents.id),
  customerId: text('customer_id').references(() => customers.id),
  contactId: text('contact_id').references(() => contacts.id),
  opportunityId: text('opportunity_id').references(() => opportunities.id),
  bindingStatus: bindingStatusEnum('binding_status').notNull().default('candidate'),
  bindingConfidence: real('binding_confidence'),
  bindingCandidatesJson: jsonb('binding_candidates_json').default([]),
  confirmedBy: text('confirmed_by'),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const opportunityWorkspaces = pgTable('opportunity_workspaces', {
  id: text('id').primaryKey(),
  opportunityId: text('opportunity_id').notNull().references(() => opportunities.id),
  workspaceStatus: workspaceStatusEnum('workspace_status').notNull().default('active'),
  currentStage: text('current_stage'),
  stageConfidence: real('stage_confidence'),
  healthScore: real('health_score').default(100),
  riskScore: real('risk_score').default(0),
  blockScore: real('block_score').default(0),
  lastSnapshotId: text('last_snapshot_id'),
  ownerUserId: text('owner_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const agentThreads = pgTable('agent_threads', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => opportunityWorkspaces.id),
  agentType: agentTypeEnum('agent_type').notNull(),
  threadStatus: threadStatusEnum('thread_status').notNull().default('idle'),
  contextScopeJson: jsonb('context_scope_json').default({}),
  latestRunId: text('latest_run_id'),
  lastActiveAt: timestamp('last_active_at'),
  assignedHumanOwner: text('assigned_human_owner'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const agentRuns = pgTable('agent_runs', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => agentThreads.id),
  triggerType: triggerTypeEnum('trigger_type').notNull(),
  triggerSignalId: text('trigger_signal_id').references(() => signalEvents.id),
  inputContextJson: jsonb('input_context_json').default({}),
  reasoningSummary: text('reasoning_summary'),
  outputSummary: text('output_summary'),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  runStatus: runStatusEnum('run_status').notNull().default('running'),
  modelVersion: text('model_version'),
  promptVersion: text('prompt_version'),
})

export const agentDecisions = pgTable('agent_decisions', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => agentRuns.id),
  decisionType: text('decision_type').notNull(),
  decisionLabel: text('decision_label').notNull(),
  decisionPayloadJson: jsonb('decision_payload_json').default({}),
  confidenceScore: real('confidence_score'),
  severityLevel: integer('severity_level').default(1),
  rationaleSummary: text('rationale_summary'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const agentActions = pgTable('agent_actions', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => agentRuns.id),
  workspaceId: text('workspace_id').notNull().references(() => opportunityWorkspaces.id),
  actionType: actionTypeEnum('action_type').notNull(),
  actionPayloadJson: jsonb('action_payload_json').default({}),
  actionPriority: integer('action_priority').default(3),
  executionMode: executionModeEnum('execution_mode').notNull().default('approval_required'),
  approvalRequired: boolean('approval_required').notNull().default(true),
  actionStatus: actionStatusEnum('action_status').notNull().default('pending'),
  // 执行分类：authorization=授权类（需人决策）, execution=执行类（AI自动执行）, collaboration=协作类（人执行+AI准备材料）
  executorCategory: text('executor_category').notNull().default('execution'),
  dedupHash: text('dedup_hash'),  // workspaceId+actionType+title 去重
  executorType: text('executor_type'),
  scheduledAt: timestamp('scheduled_at'),
  executedAt: timestamp('executed_at'),
  failedAt: timestamp('failed_at'),
  retryCount: integer('retry_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const approvalTasks = pgTable('approval_tasks', {
  id: text('id').primaryKey(),
  actionId: text('action_id').notNull().references(() => agentActions.id),
  approvalType: text('approval_type').notNull(),
  approverUserId: text('approver_user_id'),
  taskStatus: approvalStatusEnum('task_status').notNull().default('pending'),
  decision: text('decision'),
  comments: text('comments'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const humanInterventions = pgTable('human_interventions', {
  id: text('id').primaryKey(),
  relatedObjectType: text('related_object_type').notNull(),
  relatedObjectId: text('related_object_id').notNull(),
  interventionType: interventionTypeEnum('intervention_type').notNull(),
  beforeJson: jsonb('before_json').default({}),
  afterJson: jsonb('after_json').default({}),
  reasonCode: text('reason_code'),
  reasonText: text('reason_text'),
  operatorUserId: text('operator_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const executionLogs = pgTable('execution_logs', {
  id: text('id').primaryKey(),
  actionId: text('action_id').notNull().references(() => agentActions.id),
  runId: text('run_id').references(() => agentRuns.id),           // 溯源：来自哪个 Agent Run
  signalId: text('signal_id').references(() => signalEvents.id), // 溯源：来自哪个信号
  executorType: text('executor_type').notNull(),
  requestPayloadJson: jsonb('request_payload_json').default({}),
  responsePayloadJson: jsonb('response_payload_json').default({}),
  executionStatus: text('execution_status').notNull(),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  executedAt: timestamp('executed_at').defaultNow(),
})

export const feedbackSamples = pgTable('feedback_samples', {
  id: text('id').primaryKey(),
  sourceType: text('source_type').notNull(),
  sourceObjectId: text('source_object_id').notNull(),
  agentType: agentTypeEnum('agent_type'),
  scenarioType: text('scenario_type'),
  workspaceId: text('workspace_id').references(() => opportunityWorkspaces.id),
  originalOutputJson: jsonb('original_output_json').default({}),
  correctedOutputJson: jsonb('corrected_output_json').default({}),
  feedbackLabel: feedbackLabelEnum('feedback_label').notNull(),
  feedbackReasonCode: text('feedback_reason_code'),
  reusableFlag: boolean('reusable_flag').default(true),
  versionTag: text('version_tag'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const stateSnapshots = pgTable('state_snapshots', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => opportunityWorkspaces.id),
  snapshotType: text('snapshot_type').notNull().default('auto'),
  stage: text('stage'),
  healthScore: real('health_score'),
  riskSummary: text('risk_summary'),
  nextActionsJson: jsonb('next_actions_json').default([]),
  blockersJson: jsonb('blockers_json').default([]),
  createdAt: timestamp('created_at').defaultNow(),
})

// ─── Agent Rules（规则治理）────────────────────────────────────────────────────

export const ruleTypeEnum = pgEnum('rule_type', ['forbid', 'require', 'prefer'])

export const agentRules = pgTable('agent_rules', {
  id: text('id').primaryKey(),
  agentType: agentTypeEnum('agent_type').notNull(),
  ruleType: ruleTypeEnum('rule_type').notNull(),
  condition: text('condition').notNull(),       // 触发条件（自然语言）
  instruction: text('instruction').notNull(),   // 规则内容
  createdFrom: text('created_from').default('manual'), // 'manual' | feedback_sample_id
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Asset Library（资产库）────────────────────────────────────────────────────

export const assetTypeEnum = pgEnum('asset_type', [
  'product', 'solution', 'case', 'template', 'script', 'knowledge',
])

export const assetStatusEnum = pgEnum('asset_status', ['active', 'archived'])

export const assets = pgTable('assets', {
  id: text('id').primaryKey(),
  assetType: assetTypeEnum('asset_type').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  fullContent: text('full_content'),           // Markdown 正文
  tags: jsonb('tags').default([]),             // string[]
  industries: jsonb('industries').default([]), // string[]
  stages: jsonb('stages').default([]),         // 适用销售阶段 string[]
  usageCount: integer('usage_count').default(0),
  qualityScore: real('quality_score').default(0.5),
  sourceAgentType: agentTypeEnum('source_agent_type'), // 来源数字员工
  workspaceId: text('workspace_id').references(() => opportunityWorkspaces.id),
  status: assetStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const assetUsages = pgTable('asset_usages', {
  id: text('id').primaryKey(),
  assetId: text('asset_id').notNull().references(() => assets.id),
  workspaceId: text('workspace_id').references(() => opportunityWorkspaces.id),
  runId: text('run_id').references(() => agentRuns.id),
  usedBy: agentTypeEnum('used_by'),
  usageContext: text('usage_context'),
  feedbackLabel: text('feedback_label'), // 'helpful' | 'not_helpful'
  createdAt: timestamp('created_at').defaultNow(),
})

// ─── Tasks（任务记录）─────────────────────────────────────────────────────────

export const taskStatusEnum = pgEnum('task_status', ['pending', 'in_progress', 'done', 'cancelled'])

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => opportunityWorkspaces.id),
  runId: text('run_id').references(() => agentRuns.id),
  actionId: text('action_id').references(() => agentActions.id),
  title: text('title').notNull(),
  description: text('description'),
  assignedTo: text('assigned_to'),
  priority: integer('priority').default(3),
  taskStatus: taskStatusEnum('task_status').notNull().default('pending'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Drafts（草稿队列）───────────────────────────────────────────────────────

export const draftTypeEnum = pgEnum('draft_type', [
  'email', 'proposal_section', 'tender_response', 'wechat', 'report',
])

export const draftStatusEnum = pgEnum('draft_status', [
  'pending_review', 'approved', 'sent', 'archived',
])

export const drafts = pgTable('drafts', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => opportunityWorkspaces.id),
  runId: text('run_id').references(() => agentRuns.id),
  actionId: text('action_id').references(() => agentActions.id),
  draftType: draftTypeEnum('draft_type').notNull().default('email'),
  title: text('title').notNull(),
  recipientInfo: jsonb('recipient_info').default({}), // { to, subject, channel }
  content: text('content').notNull(),                 // Markdown 全文
  draftStatus: draftStatusEnum('draft_status').notNull().default('pending_review'),
  assetReferences: jsonb('asset_references').default([]), // string[] assetId
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const agentPrompts = pgTable('agent_prompts', {
  id: text('id').primaryKey(),
  agentType: agentTypeEnum('agent_type').notNull().unique(),
  systemPrompt: text('system_prompt').notNull(),
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id'),
  actionId: text('action_id'),
  channel: text('channel').notNull(),          // 'feishu' | 'internal'
  title: text('title').notNull(),
  content: text('content'),
  sentAt: timestamp('sent_at').defaultNow(),
  deliveryStatus: text('delivery_status').notNull().default('sent'), // 'sent' | 'failed'
  errorMessage: text('error_message'),
})

// Key-value settings store (replaces local ai-settings.json for Vercel compatibility)
export const kvSettings = pgTable('kv_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Agent Memory（跨会话记忆）────────────────────────────────────────────────
// 每次 Agent 运行后提炼关键结论，下次运行时注入 system prompt

export const agentMemory = pgTable('agent_memory', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => opportunityWorkspaces.id),
  agentType: agentTypeEnum('agent_type').notNull(),
  memorySummary: text('memory_summary').notNull(),  // 1-3句关键结论
  sourceRunId: text('source_run_id').references(() => agentRuns.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ─── Agent Skills（技能装载）──────────────────────────────────────────────────
// 记录每个数字员工装载了哪些工具技能（对应 tool-registry.ts 中的 ToolDef.id）

export const agentSkills = pgTable('agent_skills', {
  id: text('id').primaryKey(),
  agentType: agentTypeEnum('agent_type').notNull(),
  toolId: text('tool_id').notNull(),   // 对应 tool-registry.ts 中的 ToolDef.id
  enabled: boolean('enabled').default(true).notNull(),
  config: jsonb('config'),             // 覆盖参数（如指定钉钉群 ID、企业微信 agentId）
  skillTemplateId: text('skill_template_id'),  // 关联上架技能（可选）
  defaultParamsJson: jsonb('default_params_json').default({}),  // 沙盘训练出的默认参数
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ── 技能沙盘（训练会话）────────────────────────────────────────────────────────

export const skillSandboxes = pgTable('skill_sandboxes', {
  id: text('id').primaryKey(),
  name: text('name'),
  toolSource: text('tool_source').notNull().default('http'),  // 'http'|'code'|'skill_json'|'builtin'
  skillSpecJson: jsonb('skill_spec_json').default({}),        // 技能规格（name/description/inputSchema）
  executionConfigJson: jsonb('execution_config_json').default({}),  // 执行配置
  chatHistoryJson: jsonb('chat_history_json').default([]),    // 对话历史
  testRoundsJson: jsonb('test_rounds_json').default([]),      // 测试记录
  bestParamsJson: jsonb('best_params_json'),                  // 标记最优的参数
  status: text('status').notNull().default('drafting'),       // 'drafting'|'published'
  publishedSkillId: text('published_skill_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ── 技能库（已上架技能）──────────────────────────────────────────────────────

export const skillTemplates = pgTable('skill_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull().default('data'),
  toolSource: text('tool_source').notNull().default('http'),
  skillSpecJson: jsonb('skill_spec_json').notNull().default({}),
  executionConfigJson: jsonb('execution_config_json').notNull().default({}),
  sourceSandboxId: text('source_sandbox_id'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

// ── 动作审批策略矩阵 ─────────────────────────────────────────────────────────
// 定义每类动作的审批要求：自动执行 / 单人审批 / 双人审批
// 优先级：agentType + actionType 精确匹配 > actionType 全局匹配 > 兜底默认

export const agentActionPolicies = pgTable('agent_action_policies', {
  id: text('id').primaryKey(),
  // 匹配条件（null = 通配）
  agentType: agentTypeEnum('agent_type'),           // null = 适用所有 Agent
  actionType: actionTypeEnum('action_type'),        // null = 适用所有动作类型
  executorCategory: text('executor_category'),      // null = 适用所有分类
  // 审批要求
  approvalMode: text('approval_mode').notNull().default('approval_required'),
  // 'auto'              — 自动执行，无需审批
  // 'approval_required' — 需要单人审批
  // 'dual_approval'     — 需要双人审批（高风险动作）
  // 附加约束
  requiresWhitelist: boolean('requires_whitelist').notNull().default(false), // 收件人必须在白名单内
  maxRetries: integer('max_retries').notNull().default(3),
  timeoutSeconds: integer('timeout_seconds').notNull().default(30),
  // 元数据
  description: text('description'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ── 成果物（Deliverables）─────────────────────────────────────────────────────
// 所有 Agent 产出的成果物统一归属地：PPT/效果图/方案/标书/合同意见/交接包等
// 状态机：drafting → pending_review → approved → sent → archived

export const deliverableStatusEnum = pgEnum('deliverable_status', [
  'drafting', 'pending_review', 'approved', 'sent', 'archived',
])

export const deliverableTypeEnum = pgEnum('deliverable_type', [
  'solution_ppt',          // 方案 PPT
  'scene_render',          // 场地效果图
  'layout_plan',           // 平面图方案
  'safety_proposal',       // 安全专业方案
  'requirement_summary',   // 需求摘要
  'bid_package',           // 标书草稿/定稿
  'bid_prelim',            // 标前立项文件
  'contract_review',       // 合同审查意见
  'handover_package',      // 交接包
  'acceptance_doc',        // 验收材料
  'after_sales_report',    // 售后建议材料
  'quotation',             // 报价单
  'other',                 // 其他
])

export const deliverables = pgTable('deliverables', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => opportunityWorkspaces.id),
  sourceActionId: text('source_action_id').references(() => agentActions.id),
  type: deliverableTypeEnum('type').notNull(),
  stage: text('stage'),                              // 产出时所在商机阶段
  title: text('title').notNull(),
  status: deliverableStatusEnum('status').notNull().default('drafting'),
  approvalStatus: text('approval_status'),           // null=未提审, approved, rejected
  version: integer('version').notNull().default(1),
  audience: text('audience'),                        // 受众：internal/customer/partner
  fileUrl: text('file_url'),                         // 文件存储 URL（未来接 OSS）
  previewUrl: text('preview_url'),                   // 预览 URL
  content: text('content'),                          // 正文内容（Markdown/JSON）
  metadata: jsonb('metadata').default({}),           // 扩展字段（slides结构/章节等）
  createdBy: text('created_by'),                     // 'agent' 或人工姓名
  approvedBy: text('approved_by'),
  supersedesId: text('supersedes_id'),               // 指向被替换的历史版本
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ── 风险事件（RiskEvents）────────────────────────────────────────────────────
// 全过程结构化风险，可追踪处置状态
// 状态机：detected → acknowledged → mitigated / escalated → closed

export const riskCategoryEnum = pgEnum('risk_category', [
  'requirement_unclear',   // 需求不清风险
  'competitor',            // 竞品风险
  'decision_chain',        // 决策链风险
  'budget',                // 预算风险
  'compliance',            // 安全专业与合规风险
  'bid_qualification',     // 投标资格风险
  'pricing_margin',        // 报价与毛利风险
  'contract_terms',        // 合同条款风险
  'delivery_scope',        // 交付范围膨胀风险
  'customer_health',       // 客户健康与售后风险
])

export const riskLevelEnum = pgEnum('risk_level', ['low', 'medium', 'high', 'critical'])

export const riskStatusEnum = pgEnum('risk_status', [
  'detected', 'acknowledged', 'mitigated', 'escalated', 'closed',
])

export const riskEvents = pgTable('risk_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => opportunityWorkspaces.id),
  sourceSignalId: text('source_signal_id').references(() => signalEvents.id),
  sourceActionId: text('source_action_id').references(() => agentActions.id),
  riskCategory: riskCategoryEnum('risk_category').notNull(),
  riskLevel: riskLevelEnum('risk_level').notNull().default('medium'),
  title: text('title').notNull(),
  description: text('description'),
  triggerEvidence: text('trigger_evidence'),         // 触发依据（原文摘录）
  status: riskStatusEnum('status').notNull().default('detected'),
  recommendedAction: text('recommended_action'),     // 系统建议处置动作
  acknowledgedBy: text('acknowledged_by'),
  mitigatedAt: timestamp('mitigated_at'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})