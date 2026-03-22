import { NextRequest, NextResponse } from 'next/server'
import { minimaxChat } from '@/lib/minimax'
import { db } from '@/db'
import { agentRules, agentPrompts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { AgentType } from '@/types'

// Reuse system prompts and output schema from agent-runtime
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

const AGENT_BASE_PROMPTS: Record<AgentType, string> = {
  sales_copilot: `你是一名专业的销售推进数字员工，服务于工业VR安全培训公司的销售团队。\n${BUSINESS_CONTEXT}\n\n## 你的核心职责\n- 分析渠道/客户互动信号，判断商机推进状态和健康度\n- 识别商机停滞风险和推进机会，发出阶段性预警\n- 生成下一步行动建议和对客/对渠道沟通草稿\n- 判断当前所处阶段和推进置信度\n\n输出必须是严格的 JSON 格式，包含 decisions（判断列表）和 actions（行动列表）。`,
  presales_assistant: `你是一名售前助手数字员工，服务于工业VR安全培训公司的解决方案团队。\n${BUSINESS_CONTEXT}\n\n## 你的核心职责\n- 理解和结构化客户需求，识别行业特定痛点\n- 推荐有同行业成功案例的方案模块\n- 拆解售前准备任务清单\n- 识别需求缺口和方案风险\n\n输出必须是严格的 JSON 格式。`,
  tender_assistant: `你是一名招投标助手数字员工，服务于工业VR安全培训公司的商务团队。\n${BUSINESS_CONTEXT}\n\n## 你的核心职责\n- 解析招标文件关键要点，识别技术参数门槛和资质要求\n- 拆解投标工作包和任务\n- 识别控标风险和响应风险\n- 生成时间节点提醒\n\n输出必须是严格的 JSON 格式。`,
  commercial: `你是一名商务助手数字员工，服务于工业VR安全培训公司的商务团队。\n${BUSINESS_CONTEXT}\n\n## 你的核心职责\n- 提供报价策略建议\n- 识别合同条款风险\n- 推进商务谈判建议\n- 提示合同关键项\n\n输出必须是严格的 JSON 格式。`,
  handover: `你是一名交接助手数字员工，服务于工业VR安全培训公司的交付团队。\n${BUSINESS_CONTEXT}\n\n## 你的核心职责\n- 生成项目交接包\n- 确认关键边界和风险\n- 检查信息沉淀完整性\n- 提示交付风险\n\n输出必须是严格的 JSON 格式。`,
  service_triage: `你是一名服务分诊数字员工，服务于工业VR安全培训公司的售后服务团队。\n${BUSINESS_CONTEXT}\n\n## 你的核心职责\n- 对服务工单进行分类和优先级判断\n- 识别需要升级的问题\n- 联动服务健康度评估，识别续约风险\n\n输出必须是严格的 JSON 格式。`,
  asset_governance: `你是一名资产治理数字员工，服务于工业VR安全培训公司的知识管理团队。\n${BUSINESS_CONTEXT}\n\n## 你的核心职责\n- 从成单/输单案例中提炼可复用经验\n- 管理话术、方案、案例资产\n- 清洗低质量资产\n- 维护推荐素材质量\n\n输出必须是严格的 JSON 格式。`,
}

const OUTPUT_SCHEMA = `
输出格式（严格 JSON）：
{
  "summary": "本次运行的一句话总结",
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
      "payload": {
        "title": "动作标题",
        "description": "动作描述",
        "draft": "如果是 send_draft，这里是草稿内容"
      }
    }
  ]
}`

export async function POST(req: NextRequest) {
  const { agentType, contextJson } = await req.json()

  if (!agentType || !AGENT_BASE_PROMPTS[agentType as AgentType]) {
    return NextResponse.json({ error: '无效的 agentType' }, { status: 400 })
  }

  const start = Date.now()

  // Build system prompt: base + active rules
  let systemPrompt = AGENT_BASE_PROMPTS[agentType as AgentType]

  // Check if there's a custom prompt saved for this agent type
  const customPrompt = await db.query.agentPrompts?.findFirst({
    where: (p: any, { eq }: any) => eq(p.agentType, agentType),
  }).catch(() => null)
  if (customPrompt?.systemPrompt) {
    systemPrompt = customPrompt.systemPrompt
  }

  // Inject active rules
  const activeRules = await db
    .select()
    .from(agentRules)
    .where(
      and(
        eq(agentRules.enabled, true),
      )
    )
    .catch(() => [])

  const relevantRules = activeRules.filter((r) => {
    if (!r.agentType) return true
    return r.agentType === agentType
  })

  if (relevantRules.length > 0) {
    const rulesText = relevantRules.map((r) => {
      const prefix = r.ruleType === 'forbid' ? '【禁止】' : r.ruleType === 'require' ? '【必须】' : '【倾向】'
      return `${prefix}${r.condition ? `当${r.condition}时，` : ''}${r.instruction}`
    }).join('\n')
    systemPrompt += `\n\n## 当前生效规则（必须遵守）\n${rulesText}`
  }

  systemPrompt += `\n\n${OUTPUT_SCHEMA}`

  const userMessage = `【沙盘测试模式】请基于以下上下文进行分析并输出 JSON：\n\n${JSON.stringify(contextJson, null, 2)}`

  try {
    const rawOutput = await minimaxChat({
      system: systemPrompt,
      user: userMessage,
      maxTokens: 2048,
    })

    const latencyMs = Date.now() - start

    // Try to parse
    let parsed: { summary?: string; decisions?: unknown[]; actions?: unknown[] } = {}
    try {
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
    } catch {
      // return raw if parse fails
    }

    return NextResponse.json({
      agentType,
      summary: parsed.summary ?? '',
      decisions: parsed.decisions ?? [],
      actions: parsed.actions ?? [],
      rawOutput,
      latencyMs,
      rulesApplied: relevantRules.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `运行失败：${msg}` }, { status: 500 })
  }
}
