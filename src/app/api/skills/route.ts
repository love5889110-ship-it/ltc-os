import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { agentSkills } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { TOOLS } from '@/lib/tool-registry'

export async function GET() {
  const skills = await db.query.agentSkills.findMany({
    orderBy: (s, { asc }) => [asc(s.agentType), asc(s.toolId)],
  })
  return NextResponse.json({ skills, tools: TOOLS.map(t => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    requiresConnector: t.requiresConnector,
    testable: t.testable,
  })) })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { agentType, toolId, config } = body

  if (!agentType || !toolId) {
    return NextResponse.json({ error: '缺少 agentType 或 toolId' }, { status: 400 })
  }

  const tool = TOOLS.find(t => t.id === toolId)
  if (!tool) {
    return NextResponse.json({ error: `工具 ${toolId} 不存在` }, { status: 400 })
  }

  // Upsert: if same agentType+toolId already exists, re-enable it
  const existing = await db.query.agentSkills.findFirst({
    where: (s, { and, eq }) => and(eq(s.agentType, agentType), eq(s.toolId, toolId)),
  })

  if (existing) {
    await db.update(agentSkills)
      .set({ enabled: true, config: config ?? existing.config, updatedAt: new Date() })
      .where(eq(agentSkills.id, existing.id))
    return NextResponse.json({ skillId: existing.id, action: 're-enabled' })
  }

  const skillId = generateId()
  await db.insert(agentSkills).values({
    id: skillId,
    agentType,
    toolId,
    enabled: true,
    config: config ?? null,
  })

  return NextResponse.json({ skillId, action: 'created' }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { skillId, enabled, config } = body

  if (!skillId) {
    return NextResponse.json({ error: '缺少 skillId' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (enabled !== undefined) updates.enabled = enabled
  if (config !== undefined) updates.config = config

  await db.update(agentSkills).set(updates as any).where(eq(agentSkills.id, skillId))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { skillId } = body

  if (!skillId) {
    return NextResponse.json({ error: '缺少 skillId' }, { status: 400 })
  }

  await db.delete(agentSkills).where(eq(agentSkills.id, skillId))
  return NextResponse.json({ success: true })
}
