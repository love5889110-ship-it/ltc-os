import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { agentRules } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentType = searchParams.get('agentType')
  const enabledOnly = searchParams.get('enabled') !== 'false'

  const rules = await db.query.agentRules.findMany({
    where: (r, { eq, and }) => {
      const conditions = []
      if (agentType) conditions.push(eq(r.agentType, agentType as any))
      if (enabledOnly) conditions.push(eq(r.enabled, true))
      return conditions.length ? and(...conditions) : undefined
    },
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  })

  return NextResponse.json({ rules })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { agentType, ruleType, condition, instruction, createdFrom, createdBy } = body

  if (!agentType || !ruleType || !condition || !instruction) {
    return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
  }

  const id = generateId()
  await db.insert(agentRules).values({
    id,
    agentType,
    ruleType,
    condition,
    instruction,
    createdFrom: createdFrom ?? 'manual',
    createdBy: createdBy ?? null,
    enabled: true,
  })

  return NextResponse.json({ id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, enabled, instruction, condition } = body

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const updates: Partial<typeof agentRules.$inferInsert> = { updatedAt: new Date() }
  if (typeof enabled === 'boolean') updates.enabled = enabled
  if (instruction) updates.instruction = instruction
  if (condition) updates.condition = condition

  await db.update(agentRules).set(updates).where(eq(agentRules.id, id))

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  await db.update(agentRules).set({ enabled: false }).where(eq(agentRules.id, id))
  return NextResponse.json({ success: true })
}
