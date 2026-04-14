import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { ruleSuggestions, agentRules } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { generateRuleSuggestions } from '@/lib/orchestrator'

export async function GET() {
  const rows = await db.query.ruleSuggestions.findMany({
    where: eq(ruleSuggestions.status, 'pending'),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
    limit: 50,
  })
  return NextResponse.json({ suggestions: rows })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { suggestionId, action, ruleType, condition, instruction } = body
  // action: 'accept' | 'dismiss'

  const suggestion = await db.query.ruleSuggestions.findFirst({
    where: eq(ruleSuggestions.id, suggestionId),
  })
  if (!suggestion) return NextResponse.json({ error: '建议不存在' }, { status: 404 })

  if (action === 'accept') {
    // 写入 agent_rules
    const ruleId = generateId()
    await db.insert(agentRules).values({
      id: ruleId,
      agentType: suggestion.agentType as any,
      ruleType: (ruleType ?? suggestion.ruleType) as any,
      condition: condition ?? suggestion.condition,
      instruction: instruction ?? suggestion.instruction,
      createdFrom: suggestion.sourceFeedbackId ?? 'rule_suggestion',
      enabled: true,
    })
    await db
      .update(ruleSuggestions)
      .set({ status: 'accepted', acceptedRuleId: ruleId, updatedAt: new Date() })
      .where(eq(ruleSuggestions.id, suggestionId))

    return NextResponse.json({ success: true, ruleId })
  }

  if (action === 'dismiss') {
    await db
      .update(ruleSuggestions)
      .set({ status: 'dismissed', updatedAt: new Date() })
      .where(eq(ruleSuggestions.id, suggestionId))
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 })
}

// 手动触发规则候选生成（供前端按钮调用）
export async function POST() {
  const result = await generateRuleSuggestions(30)
  return NextResponse.json({ ok: true, ...result })
}
