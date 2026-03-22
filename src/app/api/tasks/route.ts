import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { tasks } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const status = searchParams.get('status')

  const rows = await db.query.tasks.findMany({
    where: (t, { and, eq }) => {
      const conds: ReturnType<typeof eq>[] = []
      if (workspaceId) conds.push(eq(t.workspaceId, workspaceId))
      if (status) conds.push(eq(t.taskStatus, status as any))
      return conds.length ? and(...conds) : undefined
    },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 100,
  })

  return NextResponse.json({ tasks: rows })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { taskId, taskStatus, assignedTo } = body

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (taskStatus) {
    updates.taskStatus = taskStatus
    if (taskStatus === 'done') updates.completedAt = new Date()
  }
  if (assignedTo !== undefined) updates.assignedTo = assignedTo

  await db.update(tasks).set(updates as any).where(eq(tasks.id, taskId))
  return NextResponse.json({ success: true })
}
