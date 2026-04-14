/**
 * 审批策略矩阵种子数据
 *
 * 目标：人只负责「成果物审批」和「对客通讯把关」，其余 AI 自动执行
 *
 * 优先级（approval-policy.ts 的匹配顺序）：
 *   1. agentType + actionType 精确匹配（最高）
 *   2. actionType 全局匹配（agentType = null）
 *   3. executorCategory 分类匹配
 *   4. 兜底 approval_required
 *
 * 运行方式：
 *   DATABASE_URL=... npx tsx scripts/seed-policies.ts
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { db } from '../src/db'
import { agentActionPolicies } from '../src/db/schema'
import { eq } from 'drizzle-orm'

// ──────────────────────────────────────────────────────────────────────────────
// 策略定义
// approvalMode:
//   'auto'              → 直接执行，无需人工
//   'approval_required' → 等待人工审批
//   'dual_approval'     → 双人审批（高风险）
// ──────────────────────────────────────────────────────────────────────────────

interface PolicyDef {
  id: string
  agentType?: string       // null = 适用所有 Agent
  actionType?: string      // null = 适用所有动作类型
  executorCategory?: string
  approvalMode: 'auto' | 'approval_required' | 'dual_approval'
  description: string
}

const POLICIES: PolicyDef[] = [
  // ── 1. 通知类：始终自动 ────────────────────────────────────────────────────
  {
    id: 'pol-notify-auto',
    actionType: 'notify',
    approvalMode: 'auto',
    description: '系统内部通知，无需审批，直接推送',
  },
  {
    id: 'pol-collab-auto',
    actionType: 'create_collab',
    approvalMode: 'auto',
    description: '协作请求通知，直接推送给相关人员',
  },

  // ── 2. 状态快照：始终自动 ─────────────────────────────────────────────────
  {
    id: 'pol-snapshot-auto',
    actionType: 'create_snapshot',
    approvalMode: 'auto',
    description: '生成状态快照，纯记录动作，无需审批',
  },

  // ── 3. 状态更新：自动（阶段变更 Agent 决策，无需人工确认）─────────────────
  {
    id: 'pol-update-status-auto',
    actionType: 'update_status',
    approvalMode: 'auto',
    description: 'AI 阶段评估和健康分更新，自动执行（阶段变更后会触发对应 Agent 做进一步分析）',
  },

  // ── 4. 任务创建：自动（任务只是备忘，不对外）─────────────────────────────
  {
    id: 'pol-create-task-auto',
    actionType: 'create_task',
    approvalMode: 'auto',
    description: '创建内部跟进任务，自动写入任务中心',
  },

  // ── 5. 内容生成类：自动生成，生成后进入成果物中心待人工审批 ─────────────
  // （生成动作本身 auto，生成的成果物 status='pending_review' 需人工审批）
  {
    id: 'pol-gen-ppt-auto',
    actionType: 'generate_solution_ppt',
    approvalMode: 'auto',
    description: '自动生成方案PPT（JSON内容），生成后进入成果物中心 pending_review 待审批',
  },
  {
    id: 'pol-gen-scene-auto',
    actionType: 'generate_scene_render',
    approvalMode: 'auto',
    description: '自动生成场景渲染描述，进入成果物中心待审批',
  },
  {
    id: 'pol-gen-tender-auto',
    actionType: 'generate_tender_doc',
    approvalMode: 'auto',
    description: '自动生成标书草稿，进入成果物中心待审批',
  },
  {
    id: 'pol-parse-tender-auto',
    actionType: 'parse_tender_document',
    approvalMode: 'auto',
    description: '解析招标文件，生成需求摘要，进入成果物中心',
  },
  {
    id: 'pol-extract-risks-auto',
    actionType: 'extract_contract_risks',
    approvalMode: 'auto',
    description: '提取合同风险，生成风险报告，进入成果物中心',
  },
  {
    id: 'pol-gen-quotation-auto',
    actionType: 'generate_quotation',
    approvalMode: 'auto',
    description: '自动生成报价单，进入成果物中心待审批',
  },
  {
    id: 'pol-gen-safety-auto',
    actionType: 'generate_safety_proposal',
    approvalMode: 'auto',
    description: '自动生成安全方案，进入成果物中心待审批',
  },
  {
    id: 'pol-gen-aftersales-auto',
    actionType: 'generate_after_sales_report',
    approvalMode: 'auto',
    description: '自动生成售后报告，进入成果物中心待审批',
  },

  // ── 6. 草稿发送：对外发送需审批，内部通知自动 ────────────────────────────
  // 注意：send_draft 默认需要人工审批（对客内容，人工把关）
  {
    id: 'pol-send-draft-approval',
    actionType: 'send_draft',
    approvalMode: 'approval_required',
    description: '对客草稿发送，人工审批后才执行发送（对外通讯把关）',
  },

  // ── 7. 工具调用：RPA 文件生成自动，外部通讯工具需审批 ────────────────────
  // call_tool 按 executorCategory 区分：execution 类（文件生成）自动，external_send 需审批
  // 注：由于 call_tool 是统一 actionType，精确控制靠 agentType 区分
  // RPA 文件生成（presales/tender/handover/sales 调用）→ auto
  {
    id: 'pol-call-tool-presales-auto',
    agentType: 'presales_assistant',
    actionType: 'call_tool',
    approvalMode: 'auto',
    description: '解决方案 Agent 的工具调用（RPA生成PPT/效果图），自动执行',
  },
  {
    id: 'pol-call-tool-tender-auto',
    agentType: 'tender_assistant',
    actionType: 'call_tool',
    approvalMode: 'auto',
    description: '招标 Agent 的工具调用（RPA生成标书/DOCX），自动执行',
  },
  {
    id: 'pol-call-tool-handover-auto',
    agentType: 'handover',
    actionType: 'call_tool',
    approvalMode: 'auto',
    description: '交付 Agent 的工具调用（RPA生成交接包），自动执行',
  },
  {
    id: 'pol-call-tool-sales-approval',
    agentType: 'sales',
    actionType: 'call_tool',
    approvalMode: 'approval_required',
    description: '销售 Agent 的工具调用（可能涉及对外发送），需要人工审批',
  },
  {
    id: 'pol-call-tool-coordinator-auto',
    agentType: 'coordinator',
    actionType: 'call_tool',
    approvalMode: 'auto',
    description: '总控 Agent 的工具调用（数据查询/浏览器查询），自动执行',
  },

  // ── 8. 风险升级：需要人工确认（影响对外策略）────────────────────────────
  {
    id: 'pol-escalate-approval',
    actionType: 'escalate',
    approvalMode: 'approval_required',
    description: '风险升级/上报，需要人工确认后执行（影响对外策略和客户关系）',
  },

  // ── 9. 兜底：executorCategory 级别 ───────────────────────────────────────
  {
    id: 'pol-cat-execution-auto',
    executorCategory: 'execution',
    approvalMode: 'auto',
    description: '执行类动作（系统内部操作），兜底自动执行',
  },
  {
    id: 'pol-cat-authorization-approval',
    executorCategory: 'authorization',
    approvalMode: 'approval_required',
    description: '授权类动作（涉及承诺/合同/外部行为），兜底需要人工审批',
  },
  {
    id: 'pol-cat-collaboration-approval',
    executorCategory: 'collaboration',
    approvalMode: 'approval_required',
    description: '协作类动作（需要人执行的任务），兜底需要人工审批',
  },
]

async function seedPolicies() {
  console.log('🌱 开始写入审批策略矩阵...')

  let inserted = 0
  let skipped = 0

  for (const p of POLICIES) {
    const existing = await db.query.agentActionPolicies.findFirst({
      where: eq(agentActionPolicies.id, p.id),
    })

    if (existing) {
      // 已存在则更新（保持幂等）
      await db
        .update(agentActionPolicies)
        .set({
          approvalMode: p.approvalMode,
          description: p.description,
          enabled: true,
          updatedAt: new Date(),
        })
        .where(eq(agentActionPolicies.id, p.id))
      skipped++
      continue
    }

    await db.insert(agentActionPolicies).values({
      id: p.id,
      agentType: (p.agentType as any) ?? null,
      actionType: (p.actionType as any) ?? null,
      executorCategory: p.executorCategory ?? null,
      approvalMode: p.approvalMode,
      description: p.description,
      enabled: true,
      requiresWhitelist: false,
      maxRetries: 3,
      timeoutSeconds: 30,
    })
    inserted++
    console.log(`  ✅ ${p.id} → ${p.approvalMode}`)
  }

  console.log(`\n✅ 审批策略写入完成：新增 ${inserted} 条，更新 ${skipped} 条`)
  console.log('\n策略摘要（auto = AI自动执行，approval_required = 人工审批）:')

  const autoList = POLICIES.filter(p => p.approvalMode === 'auto').map(p => p.id)
  const approvalList = POLICIES.filter(p => p.approvalMode === 'approval_required').map(p => p.id)

  console.log(`  自动执行（${autoList.length}）: ${autoList.join(', ')}`)
  console.log(`  需要审批（${approvalList.length}）: ${approvalList.join(', ')}`)
}

seedPolicies()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1) })
