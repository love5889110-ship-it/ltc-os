import { minimaxChat } from '@/lib/minimax'
import { db } from '@/db'
import { agentRuns, agentDecisions, agentActions, agentThreads, stateSnapshots, agentRules, assets, assetUsages, agentPrompts, agentMemory, opportunityWorkspaces } from '@/db/schema'
import { generateId } from '@/lib/utils'
import type { AgentType, AgentRunResult, ActionType } from '@/types'
import { eq, and, desc } from 'drizzle-orm'
import { getAISettings } from '@/lib/ai-settings'
import { notifyPendingApproval } from '@/lib/notify'
import { createHash } from 'crypto'

const client = null // replaced by minimaxChat

// 公共业务背景（注入所有 Agent）
const BUSINESS_CONTEXT = `
## 公司业务背景（必须基于此判断）
- 产品：工业VR安全培训系统（煤矿、电力、制造、化工等高危行业的沉浸式安全培训）
- 销售模式：渠道驱动（通过集成商/代理商触达终端国企/政府客户），非直销
- 标准销售周期：1-6个月
- 核心差异化优势：行业专属VR场景深度还原（而非通用VR），有行业成功案例背书

## 渠道销售特殊风险（重点关注）
- 渠道传递的客户信息可能失真 → 需验证渠道说法与客户实际需求的一致性
- 真实决策人通常是安全总监/生产副总，而非IT部门 → 需确认决策链是否覆盖
- 客户采购往往走政府/国企招标流程 → 需提前布局入库和控标

## 主要竞争对手
- 电力领域：徐州幻威、郑州万特电气
- 其他领域：江苏小七智能科技、合肥黑云智能、合肥五朵云、武汉博晟、安邦致远
- 出现竞品名称时：必须发出 risk_alert，并建议针对性差异化策略

## 6类输单风险信号（出现以下信号时必须发出 risk_alert）
1. 价格成为主要决策因素 / 客户要求大幅降价 → severity:4，建议重建价值体系
2. 客户/渠道说"还在多家比较" / 竞品已进场 → severity:4，需立即介入控标
3. 方案技术指标被质疑 / 案例无法匹配客户行业 → severity:3，需售前介入
4. 投标文件资质有缺口 / 截止时间不足 → severity:5，立即创建任务
5. 关键决策人不在沟通链路中 / 渠道无法触达 → severity:4，客户关系风险
6. 渠道反馈频繁变化 / 渠道动作迟缓 → severity:3，渠道管理风险`

export const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  coordinator: `你是一名AI项目经理数字员工，负责统筹管理单个商机的整体推进。
${BUSINESS_CONTEXT}

## 你的核心职责
- 读取商机全局上下文（阶段、健康度、历史信号、风险分），判断当前局势
- 决定激活哪些专项数字员工（sales/presales_assistant/tender_assistant/handover），以及每人的任务重点
- 输出对当前商机的整体判断（风险等级、推进建议、关键障碍）
- 当局势明确时直接给出行动建议，不需要激活所有员工

## 分配原则
- sales（销售助手）：负责客户/渠道沟通推进、报价谈判、合同商务
- presales_assistant（解决方案助手）：负责方案设计、技术需求、演示准备
- tender_assistant（招标助手）：有招投标信号时激活，负责标书分析和投标任务拆解
- handover（交付助手）：合同签订后激活，负责交接包和交付风险识别

## 输出格式扩展
在标准 JSON 基础上，actions 中增加一类特殊 type: "assign_agent"，payload 包含：
- agentType: 要激活的员工类型
- taskFocus: 该员工本次的重点任务描述
- reason: 为什么激活这个员工

输出必须是严格的 JSON 格式。`,

  sales: `你是一名销售/商务助手数字员工，服务于工业VR安全培训公司的销售团队。
${BUSINESS_CONTEXT}

## 你的核心职责
- 分析渠道/客户互动信号，判断商机推进状态和健康度
- 识别商机停滞风险和推进机会，发出阶段性预警
- 生成下一步行动建议和对客/对渠道沟通草稿
- 提供报价策略建议（对抗低价竞标的价值锚定策略）
- 识别合同条款风险（知识产权、验收标准、售后条款）
- 推进商务谈判建议，帮助销售坚守价值底线

## 各阶段关注重点
- **需求挖掘阶段**：确认业务痛点（事故率/培训成本/安全合规要求），识别真实决策链，核实渠道信息真实性
- **方案设计阶段**：监控客户内部立项进展，确认预算落实和预算金额区间
- **商务谈判阶段**：警惕最终决策人突变，识别价格战信号，优先用价值替代降价（增加培训场景数/延长服务期）
- 当竞品报价明显低于我方时：发出 risk_alert，建议分析对方成本结构和服务差距

输出必须是严格的 JSON 格式，包含 decisions（判断列表）和 actions（行动列表）。`,

  presales_assistant: `你是一名解决方案助手数字员工，服务于工业VR安全培训公司的解决方案团队。
${BUSINESS_CONTEXT}

## 你的核心职责
- 理解和结构化客户需求，识别行业特定痛点（高空/配电/采掘/化工等场景）
- 推荐有同行业成功案例的方案模块，优先展示与客户行业最匹配的案例
- 拆解售前准备任务清单（演示环境、方案文档、技术答疑准备）
- 识别需求缺口和方案风险

## 方案设计关键步骤
- 需求调研清单：培训人数、场景类型、年培训次数、硬件部署条件（standalone/PC）
- 当客户在电力行业时：主动分析与幻威/万特的差异化优势
- 当方案竞争力被质疑时：立即发出 risk_alert 并建议引入案例背书

输出必须是严格的 JSON 格式。`,

  tender_assistant: `你是一名招标助手数字员工，服务于工业VR安全培训公司的商务团队。
${BUSINESS_CONTEXT}

## 你的核心职责
- 解析招标文件关键要点，识别技术参数门槛和资质要求
- 拆解投标工作包和任务，分配给销售/售前/商务人员
- 识别控标风险（技术参数是否指向竞品）和响应风险
- 生成时间节点提醒，确保在截止日期前完成

## 招投标关键风险检测
- 供应商入库资质检查：营业执照/软件著作权/安全认证/行业资质是否齐全
- 发现疑似"定向控标"条款（技术参数精确匹配竞品）→ 立即发出 risk_alert（severity:5）
- 标期不足7天 → 立即发出 risk_alert 并创建紧急任务
- 投标文件中有行业特定要求（如煤矿安标、电力资质）→ 检查我方资质是否满足

输出必须是严格的 JSON 格式。`,

  handover: `你是一名交付助手数字员工，服务于工业VR安全培训公司的交付团队。
${BUSINESS_CONTEXT}

## 你的核心职责
- 生成项目交接包（销售→交付的信息完整交接）
- 确认关键边界和风险（客户期望、验收标准、合同承诺）
- 检查信息沉淀完整性（决策链、关键联系人、特殊承诺）
- 提示交付风险（场景定制需求、硬件部署条件、培训人数变化）

## 工业VR项目交接重点
- 确认硬件部署环境（是否防爆要求、网络条件、场地条件）
- 记录销售阶段的所有承诺（额外场景、特殊定制、优惠条件）
- 确认客户端关键联系人（项目负责人、IT对接人、最终验收人）

输出必须是严格的 JSON 格式。`,

  service_triage: `你是一名服务分诊数字员工，服务于工业VR安全培训公司的售后服务团队。
${BUSINESS_CONTEXT}

## 你的核心职责
- 对服务工单进行分类和优先级判断（硬件故障/软件问题/内容需求/培训支持）
- 识别需要升级的问题（影响客户安全培训正常运行的问题优先级最高）
- 联动服务健康度评估，识别续约风险
- 关联售后问题与前端商机（客户满意度影响转介绍和续约）

## 工业VR售后特殊场景
- 硬件故障（设备损坏/头显故障）→ 立即创建维修任务，severity:5
- 培训场景内容不满足新需求 → 发出 opportunity_found，建议增购
- 客户反映竞品价格更低或功能更好 → 发出 risk_alert，联动销售介入

输出必须是严格的 JSON 格式。`,

  asset_governance: `你是一名资产治理数字员工，服务于工业VR安全培训公司的知识管理团队。
${BUSINESS_CONTEXT}

## 你的核心职责
- 从成单/输单案例中提炼可复用经验（行业话术、应对竞品策略、需求调研模板）
- 管理话术、方案、案例资产，按行业（煤矿/电力/制造/化工）和阶段分类
- 清洗低质量资产（过时案例、无效话术）
- 维护推荐素材质量，确保销售拿到的都是最新、最有效的材料

## 资产沉淀重点
- 赢单案例：提炼差异化赢单因素、决策链突破路径、有效话术
- 输单案例：提炼输单原因（对应6类输单模式），转为风险预警规则
- 竞品应对：每个竞品一份差异化话术卡，定期更新

输出必须是严格的 JSON 格式。`,
}

const OUTPUT_SCHEMA = `
输出格式（严格 JSON）：
{
  "summary": "本次运行的一句话总结",
  "memorySummary": "本次分析最值得记住的1-2句关键结论（下次分析时会注入）",
  "decisions": [
    {
      "type": "stage_assessment|risk_alert|opportunity_found|blocker_identified|action_recommended",
      "label": "判断标签（简短）",
      "confidence": 0.0-1.0,
      "severity": 1-5,
      "rationale": "判断依据（1-2句话）"
    }
  ],
  "actions": [
    {
      "type": "create_task|create_collab|update_status|send_draft|escalate|create_snapshot|notify",
      "priority": 1-5,
      "requiresApproval": true|false,
      "executorCategory": "authorization|execution|collaboration",
      "payload": {
        "title": "动作标题",
        "description": "动作描述",
        "draft": "如果是 send_draft，这里是草稿内容"
      }
    }
  ]
}

executorCategory 说明（必须按此分类）：
- authorization：涉及报价/合同/外部承诺/重大资源投入，必须人来决策，requiresApproval=true
- execution：生成文档/草稿/内部任务/数据查询，AI可自动执行，requiresApproval=false
- collaboration：需要人去行动（打电话/开会/谈判），AI负责准备弹药材料，requiresApproval=true`

interface AgentRunInput {
  threadId: string
  workspaceId: string
  agentType: AgentType
  triggerType: 'signal' | 'stage_change' | 'scheduled' | 'manual' | 'execution_callback'
  triggerSignalId?: string
  context: {
    opportunity?: Record<string, unknown>
    customer?: Record<string, unknown>
    channelPartner?: Record<string, unknown>
    recentSignals?: unknown[]
    recentDecisions?: unknown[]
    currentStage?: string
    healthScore?: number | null
    riskScore?: number | null
    lastSnapshot?: Record<string, unknown>
    additionalContext?: string
  }
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  // P4: 并发控制 — 检查该 thread 是否已在运行，防止重复触发
  const existingThread = await db.query.agentThreads.findFirst({
    where: eq(agentThreads.id, input.threadId),
  })
  if (existingThread?.threadStatus === 'running') {
    throw new Error(`Agent ${input.agentType} 正在运行中，请等待完成后再触发`)
  }

  // Mark thread as running immediately
  await db.update(agentThreads).set({ threadStatus: 'running' }).where(eq(agentThreads.id, input.threadId))

  const runId = generateId()

  // Create run record
  await db.insert(agentRuns).values({
    id: runId,
    threadId: input.threadId,
    triggerType: input.triggerType,
    triggerSignalId: input.triggerSignalId ?? null,
    inputContextJson: input.context,
    runStatus: 'running',
    modelVersion: 'MiniMax-Text-01',
    promptVersion: '2.0.0',
  })

  // Load active rules for this agent type and inject into system prompt
  const activeRules = await db.query.agentRules.findMany({
    where: (r, { and, eq }) => and(eq(r.agentType, input.agentType), eq(r.enabled, true)),
  })

  let rulesBlock = ''
  if (activeRules.length > 0) {
    const ruleLines = activeRules.map((r) => {
      const typeLabel = r.ruleType === 'forbid' ? '【禁止】' : r.ruleType === 'require' ? '【必须】' : '【倾向】'
      return `${typeLabel} 当 ${r.condition} 时，${r.instruction}`
    })
    rulesBlock = `\n\n## 当前生效规则（必须严格遵守）\n${ruleLines.join('\n')}`
  }

  // DB-first prompt: if operator has customised this agent's prompt, use it; else fall back to hardcoded
  const dbPrompt = await db.query.agentPrompts.findFirst({
    where: (p, { and, eq }) => and(eq(p.agentType, input.agentType), eq(p.enabled, true)),
  })
  const basePrompt = dbPrompt?.systemPrompt ?? AGENT_SYSTEM_PROMPTS[input.agentType]
  const systemPrompt = basePrompt + rulesBlock
  const contextText = JSON.stringify(input.context, null, 2)

  // A4: 注入资产库素材（按阶段和 agentType 过滤）
  const currentStage = input.context.currentStage
  const relevantAssets = await db.query.assets.findMany({
    where: (a, { and, eq }) => eq(a.status, 'active'),
    orderBy: (a, { desc }) => [desc(a.usageCount), desc(a.qualityScore)],
    limit: 8,
  })
  const stageAssets = relevantAssets.filter(
    (a) => !currentStage || (a.stages as string[]).length === 0 || (a.stages as string[]).includes(currentStage)
  ).slice(0, 5)

  let assetsBlock = ''
  if (stageAssets.length > 0) {
    const lines = stageAssets.map(
      (a) => `- 【${a.assetType}】${a.title}：${a.summary ?? ''}${a.fullContent ? '\n  内容摘录：' + a.fullContent.slice(0, 300) : ''}`
    )
    assetsBlock = `\n\n## 可参考的资产库素材（请优先基于这些素材生成内容，再用 AI 补全不足部分）\n${lines.join('\n')}`
  }

  // C4: 跨 Agent 上下文 — 同一 workspace 其他 Agent 最近一次的输出
  const otherThreads = await db.query.agentThreads.findMany({
    where: (t, { and, eq }) => and(eq(t.workspaceId, input.workspaceId)),
  })
  const otherAgentOutputs: Record<string, unknown> = {}
  for (const thread of otherThreads) {
    if (thread.agentType === input.agentType) continue
    if (!thread.latestRunId) continue
    const run = await db.query.agentRuns.findFirst({
      where: eq(agentRuns.id, thread.latestRunId),
    })
    if (run?.outputSummary) {
      const decisions = await db.query.agentDecisions.findMany({
        where: eq(agentDecisions.runId, run.id),
      })
      otherAgentOutputs[thread.agentType] = {
        summary: run.outputSummary,
        decisions: decisions.slice(0, 3).map((d) => ({ label: d.decisionLabel, rationale: d.rationaleSummary })),
      }
    }
  }
  const crossAgentBlock = Object.keys(otherAgentOutputs).length > 0
    ? `\n\n## 其他数字员工的最新分析（供参考）\n${JSON.stringify(otherAgentOutputs, null, 2)}`
    : ''

  // Update inputContextJson to include cross-agent context (for inspectability)
  if (Object.keys(otherAgentOutputs).length > 0) {
    await db.update(agentRuns).set({
      inputContextJson: { ...input.context, crossAgentOutputs: otherAgentOutputs },
    }).where(eq(agentRuns.id, runId))
  }

  // Few-shot: inject recent reusable correction samples for this agent type
  const fewShotSamples = await db.query.feedbackSamples.findMany({
    where: (s, { and, eq }) => and(
      eq(s.agentType, input.agentType),
      eq(s.reusableFlag, true),
    ),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
    limit: 3,
  })
  let fewShotBlock = ''
  if (fewShotSamples.length > 0) {
    const examples = fewShotSamples.map((s, i) => {
      const orig = JSON.stringify(s.originalOutputJson ?? {}).slice(0, 200)
      const corr = JSON.stringify(s.correctedOutputJson ?? {}).slice(0, 200)
      return `示例${i + 1}：\n  AI原始输出：${orig}\n  人工纠正为：${corr}`
    }).join('\n\n')
    fewShotBlock = `\n\n## 历史纠偏示例（请参考，避免重复类似错误）\n${examples}`
  }

  // Memory injection: load prior key conclusions for this workspace+agent
  const memories = await db.query.agentMemory.findMany({
    where: (m, { and, eq }) => and(
      eq(m.workspaceId, input.workspaceId),
      eq(m.agentType, input.agentType),
    ),
    orderBy: (m, { desc }) => [desc(m.updatedAt)],
    limit: 3,
  })
  let memoryBlock = ''
  if (memories.length > 0) {
    const memLines = memories.map(m => `- ${m.memorySummary}`).join('\n')
    memoryBlock = `\n\n## 你对这个商机的历史记忆（请结合这些上下文判断）\n${memLines}`
  }

  // Skills injection: load enabled tools for this agent and inject into system prompt
  const enabledSkills = await db.query.agentSkills.findMany({
    where: (s, { and, eq }) => and(eq(s.agentType, input.agentType), eq(s.enabled, true)),
  })
  let skillsBlock = ''
  if (enabledSkills.length > 0) {
    const { TOOLS } = await import('@/lib/tool-registry')
    const skillLines = enabledSkills.map(s => {
      const def = TOOLS.find(t => t.id === s.toolId)
      if (!def) return null
      return `- 工具 ID: ${def.id}（${def.name}）：${def.description}`
    }).filter(Boolean)
    if (skillLines.length > 0) {
      skillsBlock = `\n\n## 你可以调用的工具技能\n当需要真实执行时，生成 actionType="call_tool" 的动作，payload 包含 toolId 和 toolInput 字段。\n${skillLines.join('\n')}`
    }
  }

  try {
    const aiSettings = await getAISettings()
    const isDeep = aiSettings.agentOutputDepth === 'deep'
    const deepSchemaAddition = isDeep ? `
注意：深度模式下，每条 decision 的 rationale 需要包含2-3句详细推理，每条 action 的 description 需要包含具体执行步骤。` : ''

    const rawOutput = await minimaxChat({
      system: systemPrompt + '\n\n' + OUTPUT_SCHEMA + deepSchemaAddition,
      user: `请基于以下上下文进行分析并输出 JSON：\n\n${contextText}${assetsBlock}${crossAgentBlock}${memoryBlock}${fewShotBlock}${skillsBlock}`,
      maxTokens: aiSettings.agentMaxTokens,
    })

    // Parse JSON from response
    let parsed: {
      summary: string
      memorySummary?: string
      decisions: Array<{
        type: string
        label: string
        confidence: number
        severity: number
        rationale: string
      }>
      actions: Array<{
        type: ActionType
        priority: number
        requiresApproval: boolean
        executorCategory?: string
        payload: Record<string, unknown>
      }>
    }

    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = rawOutput.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawOutput]
      parsed = JSON.parse(jsonMatch[1] || rawOutput)
    } catch {
      parsed = {
        summary: rawOutput.slice(0, 200),
        decisions: [],
        actions: [],
      }
    }

    // Save decisions
    for (const d of parsed.decisions) {
      await db.insert(agentDecisions).values({
        id: generateId(),
        runId,
        decisionType: d.type,
        decisionLabel: d.label,
        decisionPayloadJson: d,
        confidenceScore: d.confidence,
        severityLevel: d.severity ?? 1,
        rationaleSummary: d.rationale,
      })
    }

    // Save actions (with dedup: skip if same workspace+actionType+title already pending)
    const savedActions = []
    for (const a of parsed.actions) {
      const title = (a.payload?.title as string) ?? ''
      const dedupHash = createHash('md5')
        .update(`${input.workspaceId}:${a.type}:${title}`)
        .digest('hex')

      // Check for existing active action with same hash
      const existing = await db.query.agentActions.findFirst({
        where: (act, { and, eq, inArray }) => and(
          eq(act.dedupHash, dedupHash),
          inArray(act.actionStatus, ['pending', 'pending_approval']),
        ),
      })
      if (existing) continue  // skip duplicate

      const actionId = generateId()
      // Determine executorCategory: use AI-provided or infer from actionType
      const category = (a as any).executorCategory ??
        (a.type === 'send_draft' || a.type === 'create_snapshot' ? 'execution' :
         a.type === 'create_collab' ? 'collaboration' :
         a.requiresApproval ? 'authorization' : 'execution')

      await db.insert(agentActions).values({
        id: actionId,
        runId,
        workspaceId: input.workspaceId,
        actionType: a.type,
        actionPayloadJson: a.payload,
        actionPriority: a.priority,
        executionMode: a.requiresApproval ? 'approval_required' : 'auto',
        approvalRequired: a.requiresApproval,
        actionStatus: a.requiresApproval ? 'pending_approval' : 'pending',
        executorCategory: category,
        dedupHash,
      })
      savedActions.push({ ...a, id: actionId })
    }

    // Record asset usage stats
    for (const a of stageAssets) {
      await db.insert(assetUsages).values({
        id: generateId(),
        assetId: a.id,
        workspaceId: input.workspaceId,
        runId,
        usedBy: input.agentType,
        usageContext: `stage:${currentStage ?? 'unknown'}`,
      })
      await db.update(assets).set({ usageCount: (a.usageCount ?? 0) + 1 }).where(eq(assets.id, a.id))
    }
    // Update run as completed
    await db
      .update(agentRuns)
      .set({
        runStatus: 'completed',
        finishedAt: new Date(),
        reasoningSummary: parsed.summary,
        outputSummary: parsed.summary,
      })
      .where(eq(agentRuns.id, runId))

    // Update thread's latest run
    await db
      .update(agentThreads)
      .set({ latestRunId: runId, lastActiveAt: new Date(), threadStatus: 'idle' })
      .where(eq(agentThreads.id, input.threadId))

    // Persist memory summary for future runs
    if (parsed.memorySummary) {
      const existingMemory = await db.query.agentMemory.findFirst({
        where: (m, { and, eq }) => and(
          eq(m.workspaceId, input.workspaceId),
          eq(m.agentType, input.agentType),
        ),
      })
      if (existingMemory) {
        await db.update(agentMemory)
          .set({ memorySummary: parsed.memorySummary, sourceRunId: runId, updatedAt: new Date() })
          .where(eq(agentMemory.id, existingMemory.id))
      } else {
        await db.insert(agentMemory).values({
          id: generateId(),
          workspaceId: input.workspaceId,
          agentType: input.agentType,
          memorySummary: parsed.memorySummary,
          sourceRunId: runId,
        })
      }
    }

    // [P1-5] Recalculate health/risk/block scores based on decisions and pending actions
    const allPendingActions = await db.query.agentActions.findMany({
      where: (a, { and, eq, inArray }) => and(
        eq(a.workspaceId, input.workspaceId),
        inArray(a.actionStatus, ['pending', 'pending_approval'])
      ),
    })
    const allDecisions = await db.query.agentDecisions.findMany({
      where: (d, { eq }) => eq(d.runId, runId),
    })
    const maxSeverity = allDecisions.length > 0
      ? Math.max(...allDecisions.map((d) => d.severityLevel ?? 1))
      : 1
    const pendingCount = allPendingActions.length
    // riskScore: severity drives risk (1-5 → 0-80), each unresolved action adds 2pts
    const newRiskScore = Math.min(100, Math.round((maxSeverity - 1) * 20 + pendingCount * 2))
    // healthScore: inverse of risk, floor at 20
    const newHealthScore = Math.max(20, 100 - newRiskScore)
    // blockScore: count of blocker/escalation decisions × 20
    const blockerCount = allDecisions.filter((d) =>
      d.decisionType === 'blocker_identified' || d.decisionType === 'risk_alert'
    ).length
    const newBlockScore = Math.min(100, blockerCount * 20)

    await db.update(opportunityWorkspaces)
      .set({ healthScore: newHealthScore, riskScore: newRiskScore, blockScore: newBlockScore, updatedAt: new Date() })
      .where(eq(opportunityWorkspaces.id, input.workspaceId))

    // Push notification if any actions require approval
    const pendingActions = savedActions.filter(a => a.requiresApproval)
    if (pendingActions.length > 0) {
      const maxPriority = Math.max(...pendingActions.map(a => a.priority ?? 3))
      notifyPendingApproval({
        agentType: input.agentType,
        opportunityName: (input.context.opportunity?.name as string) ?? '未知商机',
        actionIds: pendingActions.map(a => a.id),
        workspaceId: input.workspaceId,
        priority: maxPriority,
      }).catch(e => console.error('[notify] 推送失败:', e))
    }

    return {
      runId,
      decisions: parsed.decisions.map((d) => ({
        type: d.type,
        label: d.label,
        confidence: d.confidence,
        rationale: d.rationale,
      })),
      actions: parsed.actions.map((a) => ({
        type: a.type,
        payload: a.payload,
        priority: a.priority,
        requiresApproval: a.requiresApproval,
      })),
      outputSummary: parsed.summary,
    }
  } catch (error) {
    await db
      .update(agentRuns)
      .set({ runStatus: 'failed', finishedAt: new Date() })
      .where(eq(agentRuns.id, runId))
    await db
      .update(agentThreads)
      .set({ threadStatus: 'error' })
      .where(eq(agentThreads.id, input.threadId))
    throw error
  }
}

export async function createOrGetThread(
  workspaceId: string,
  agentType: AgentType
): Promise<string> {
  const existing = await db.query.agentThreads.findFirst({
    where: (t, { and, eq }) => and(eq(t.workspaceId, workspaceId), eq(t.agentType, agentType)),
  })

  if (existing) return existing.id

  const threadId = generateId()
  await db.insert(agentThreads).values({
    id: threadId,
    workspaceId,
    agentType,
    threadStatus: 'idle',
  })
  return threadId
}
