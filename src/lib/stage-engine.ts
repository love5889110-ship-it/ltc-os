/**
 * 阶段驱动引擎
 * 商机阶段变化时，自动触发对应数字员工
 */
import type { AgentType } from '@/types'
import { db } from '@/db'
import { agentThreads } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { runAgent, createOrGetThread } from '@/lib/agent-runtime'

// 各阶段负责的数字员工（按优先级排序）
const STAGE_AGENT_MAP: Record<string, AgentType[]> = {
  '需求挖掘': ['coordinator', 'sales'],
  '方案设计': ['coordinator', 'presales_assistant'],
  '招投标': ['coordinator', 'tender_assistant'],
  '商务谈判': ['coordinator', 'sales'],
  '合同签订': ['sales', 'handover'],
  '交付': ['handover', 'service_triage'],
  '售后': ['service_triage', 'asset_governance'],
}

// 阶段别名映射（兼容 opportunity.stage 字段）
const STAGE_ALIASES: Record<string, string> = {
  // 通用别名
  '初接触': '需求挖掘',
  '需求分析': '需求挖掘',
  '解决方案': '方案设计',
  '投标': '招投标',
  '商务': '商务谈判',
  '合同': '合同签订',
  '实施': '交付',
  '服务': '售后',
  // 公司标准7阶段名称映射
  '真实需求分析': '需求挖掘',
  '需求解决方案': '方案设计',
  '立项及预算申请': '方案设计',
  '供应商入库': '招投标',
  '招标': '招投标',
  '决策': '商务谈判',
}

export function getAgentsForStage(stage: string): AgentType[] {
  const normalizedStage = STAGE_ALIASES[stage] ?? stage
  return STAGE_AGENT_MAP[normalizedStage] ?? ['coordinator']
}

/**
 * 阶段变更时自动触发对应 Agent（异步，不阻塞 API 响应）
 */
export function triggerStageAgents(
  workspaceId: string,
  newStage: string,
  context: {
    opportunity?: Record<string, unknown>
    customer?: Record<string, unknown>
    currentStage?: string
    healthScore?: number | null
    riskScore?: number | null
  }
): void {
  const agentTypes = getAgentsForStage(newStage)

  // Fire and forget — run each agent sequentially to avoid DB race conditions
  ;(async () => {
    for (const agentType of agentTypes) {
      try {
        const threadId = await createOrGetThread(workspaceId, agentType)
        await runAgent({
          threadId,
          workspaceId,
          agentType,
          triggerType: 'stage_change',
          context: {
            ...context,
            currentStage: newStage,
            additionalContext: `商机阶段已推进到【${newStage}】，请根据新阶段重新分析并制定行动计划。`,
          },
        })
      } catch (err) {
        console.error(`[stage-engine] ${agentType} failed for workspace ${workspaceId}:`, err)
      }
    }
  })()
}

/**
 * 高优先级信号绑定后自动触发 coordinator（AI项目经理）
 */
export function triggerSignalAgent(
  workspaceId: string,
  signalId: string,
  context: {
    opportunity?: Record<string, unknown>
    customer?: Record<string, unknown>
    currentStage?: string
    healthScore?: number | null
    riskScore?: number | null
  }
): void {
  ;(async () => {
    try {
      const threadId = await createOrGetThread(workspaceId, 'coordinator')
      await runAgent({
        threadId,
        workspaceId,
        agentType: 'coordinator',
        triggerType: 'signal',
        triggerSignalId: signalId,
        context,
      })
    } catch (err) {
      console.error(`[stage-engine] signal trigger failed for workspace ${workspaceId}:`, err)
    }
  })()
}

/**
 * 动作执行完成后，根据动作类型决定是否触发下一个 Agent（execution_callback 链路）
 * - update_status: 阶段变更类动作，触发新阶段对应的 Agent
 * - create_task / send_draft / escalate: 触发 coordinator 做跟进确认
 */
export function triggerExecutionCallback(
  workspaceId: string,
  actionType: string,
  result: Record<string, unknown>,
  runId?: string
): void {
  ;(async () => {
    try {
      // update_status 且有阶段变更 → 触发新阶段 Agent
      if (actionType === 'update_status' && result.updates) {
        const updates = result.updates as Record<string, unknown>
        if (updates.currentStage) {
          const newStage = updates.currentStage as string
          const { opportunityWorkspaces, opportunities, customers } = await import('@/db/schema')
          const { db } = await import('@/db')
          const { eq } = await import('drizzle-orm')
          const ws = await db.query.opportunityWorkspaces.findFirst({ where: eq(opportunityWorkspaces.id, workspaceId) })
          const opp = ws ? await db.query.opportunities.findFirst({ where: eq(opportunities.id, ws.opportunityId) }) : null
          const customer = opp ? await db.query.customers.findFirst({ where: eq(customers.id, opp.customerId) }) : null
          triggerStageAgents(workspaceId, newStage, {
            opportunity: opp ? { name: opp.name, stage: newStage } : undefined,
            customer: customer ? { name: customer.name } : undefined,
            currentStage: newStage,
          })
          return
        }
      }

      // escalate → 触发 coordinator 紧急响应
      if (actionType === 'escalate') {
        const threadId = await createOrGetThread(workspaceId, 'coordinator')
        await runAgent({
          threadId,
          workspaceId,
          agentType: 'coordinator',
          triggerType: 'execution_callback',
          context: {
            additionalContext: `上一个动作（escalate）已执行完毕，结果：${JSON.stringify(result)}。请重新评估当前风险并决定下一步行动。`,
          },
        })
      }
    } catch (err) {
      console.error(`[stage-engine] execution_callback failed for workspace ${workspaceId} actionType ${actionType}:`, err)
    }
  })()
}
