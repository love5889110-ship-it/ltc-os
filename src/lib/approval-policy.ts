/**
 * 审批策略引擎
 * 将 Agent LLM 自行决定 requiresApproval 改为查策略表约束：
 *  - 策略表 agent_action_policies 定义每类动作的审批模式
 *  - auto → 直接标记 approved，跳过人工审批
 *  - approval_required → 标记 pending_approval，等待人工
 *  - dual_approval → 标记 pending_approval，需双人确认
 *
 * 使用方式：在 agent-runtime.ts 写入 agentActions 前调用 resolveApprovalMode()
 */
import { db } from '@/db'
import { agentActionPolicies } from '@/db/schema'
import { and, eq, isNull, or } from 'drizzle-orm'

export type ApprovalMode = 'auto' | 'approval_required' | 'dual_approval'

/**
 * 根据动作类型和分类查策略表，返回审批模式
 * 优先级：agentType + actionType 精确匹配 > actionType 全局匹配 > 兜底 'approval_required'
 */
export async function resolveApprovalMode(
  actionType: string,
  executorCategory: string,
  agentType?: string
): Promise<ApprovalMode> {
  const policies = await db.query.agentActionPolicies.findMany({
    where: eq(agentActionPolicies.enabled, true),
  })

  // 精确匹配：agentType + actionType
  if (agentType) {
    const exact = policies.find(
      (p) => p.agentType === agentType && p.actionType === actionType && p.enabled
    )
    if (exact) return exact.approvalMode as ApprovalMode
  }

  // actionType 匹配（agentType 为 null/通配）
  const byType = policies.find(
    (p) => p.actionType === actionType && !p.agentType && p.enabled
  )
  if (byType) return byType.approvalMode as ApprovalMode

  // executorCategory 匹配
  const byCat = policies.find(
    (p) => p.executorCategory === executorCategory && !p.actionType && !p.agentType && p.enabled
  )
  if (byCat) return byCat.approvalMode as ApprovalMode

  // 兜底：需要审批
  return 'approval_required'
}

/**
 * 根据审批模式决定 agentActions 的初始状态
 */
export function actionStatusFromApprovalMode(mode: ApprovalMode): string {
  if (mode === 'auto') return 'approved'
  return 'pending_approval'
}

/**
 * 根据审批模式决定 requiresApproval 字段值（兼容现有 agentActions 表字段）
 */
export function requiresApprovalFromMode(mode: ApprovalMode): boolean {
  return mode !== 'auto'
}
