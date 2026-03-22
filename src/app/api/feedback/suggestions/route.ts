import { NextResponse } from 'next/server'
import { db } from '@/db'
import { feedbackSamples } from '@/db/schema'
import { sql, and, inArray } from 'drizzle-orm'
import { minimaxChat } from '@/lib/minimax'
import { AGENT_LABELS } from '@/lib/utils'

export async function GET() {
  // Group by agentType + scenarioType where modified/rejected count >= 3
  const groups = await db.execute(sql`
    SELECT agent_type, scenario_type, COUNT(*)::int as count
    FROM feedback_samples
    WHERE feedback_label IN ('modified', 'rejected')
      AND agent_type IS NOT NULL
      AND scenario_type IS NOT NULL
    GROUP BY agent_type, scenario_type
    HAVING COUNT(*) >= 3
    ORDER BY count DESC
    LIMIT 10
  `)

  if (!groups.rows.length) return NextResponse.json({ suggestions: [] })

  const suggestions = []

  for (const group of groups.rows) {
    const { agent_type: agentType, scenario_type: scenarioType, count } = group as {
      agent_type: string
      scenario_type: string
      count: number
    }

    // Fetch up to 3 representative samples
    const samples = await db.query.feedbackSamples.findMany({
      where: (s, { and, eq, inArray }) => and(
        eq(s.agentType, agentType as any),
        eq(s.scenarioType, scenarioType),
        inArray(s.feedbackLabel, ['modified', 'rejected']),
      ),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      limit: 3,
    })

    // Use MiniMax to generate a rule suggestion based on the samples
    let suggestedRule: { ruleType: string; condition: string; instruction: string } | null = null
    try {
      const samplesText = samples.map((s, i) => {
        const orig = JSON.stringify(s.originalOutputJson ?? {}).slice(0, 300)
        const corr = JSON.stringify(s.correctedOutputJson ?? {}).slice(0, 300)
        return `样本${i + 1}：\n  原始输出：${orig}\n  修正后：${corr}\n  反馈类型：${s.feedbackLabel}`
      }).join('\n\n')

      const agentLabel = (AGENT_LABELS as Record<string, string>)[agentType] ?? agentType
      const raw = await minimaxChat({
        system: '你是一名AI运营专家，负责从用户的反馈样本中提炼出可执行的规则。输出严格的JSON格式。',
        user: `数字员工「${agentLabel}」在场景「${scenarioType}」下，有${count}次输出被用户修改或驳回。以下是最近的反馈样本：\n\n${samplesText}\n\n请分析这些反馈，提炼出一条可执行的约束规则，输出JSON：\n{"ruleType":"forbid|require|prefer","condition":"触发条件（一句话）","instruction":"规则内容（一句话，具体可执行）"}`,
        maxTokens: 256,
      })

      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, raw]
      suggestedRule = JSON.parse(jsonMatch[1] || raw)
    } catch {
      // Fallback to template-based suggestion
      suggestedRule = {
        ruleType: 'prefer',
        condition: `${(AGENT_LABELS as Record<string, string>)[agentType] ?? agentType}在执行「${scenarioType}」时`,
        instruction: '请根据反馈样本调整输出策略，避免重复出现类似错误',
      }
    }

    suggestions.push({
      id: `${agentType}::${scenarioType}`,
      agentType,
      agentLabel: (AGENT_LABELS as Record<string, string>)[agentType] ?? agentType,
      scenarioType,
      count,
      suggestedRule,
      sampleIds: samples.map((s) => s.id),
    })
  }

  return NextResponse.json({ suggestions })
}
