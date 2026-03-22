import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { agentPrompts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { AGENT_SYSTEM_PROMPTS } from '@/lib/agent-runtime'
import type { AgentType } from '@/types'

export async function GET() {
  const rows = await db.query.agentPrompts.findMany()
  return NextResponse.json({ prompts: rows })
}

export async function POST(req: NextRequest) {
  const { agentType, systemPrompt, description } = await req.json()
  if (!agentType || !systemPrompt) return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })

  // Upsert: delete existing, insert new (schema has .unique() on agentType)
  await db.delete(agentPrompts).where(eq(agentPrompts.agentType, agentType as AgentType))
  const id = generateId()
  await db.insert(agentPrompts).values({ id, agentType, systemPrompt, description: description ?? null, enabled: true })
  return NextResponse.json({ id })
}

// GET default (hardcoded) prompt for a given agentType - useful for "restore default" button
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentType = searchParams.get('agentType') as AgentType | null
  if (!agentType) return NextResponse.json({ error: '缺少 agentType' }, { status: 400 })
  await db.delete(agentPrompts).where(eq(agentPrompts.agentType, agentType))
  const defaultPrompt = AGENT_SYSTEM_PROMPTS[agentType]
  return NextResponse.json({ defaultPrompt })
}
