import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { agentMemory } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const memories = await db.query.agentMemory.findMany({
    where: eq(agentMemory.workspaceId, id),
    orderBy: [desc(agentMemory.updatedAt)],
  })
  return NextResponse.json({ memories })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { memoryId } = await req.json()
  if (!memoryId) return NextResponse.json({ error: '缺少 memoryId' }, { status: 400 })

  // 确保只能删除属于该 workspace 的记忆
  await db.delete(agentMemory).where(
    and(eq(agentMemory.id, memoryId), eq(agentMemory.workspaceId, id))
  )
  return NextResponse.json({ success: true })
}
