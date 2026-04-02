import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { deliverables } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * RPA 任务完成回调接口
 * RPA 机器执行完任务后，调用此接口将文件 URL 写回对应成果物
 *
 * POST /api/rpa-callback
 * Body: { taskExecutionId, deliverableId, fileUrl, status, error? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      taskExecutionId?: string
      deliverableId?: string
      fileUrl?: string
      status?: string
      error?: string
    }

    const { taskExecutionId, deliverableId, status, error } = body
    // 确保 fileUrl 是绝对路径（RPA 可能返回 /files/xxx 相对路径）
    const rpaBase = process.env.RPA_SERVER_URL ?? 'http://localhost:8001'
    const rawFileUrl = body.fileUrl ?? ''
    const fileUrl = rawFileUrl.startsWith('/files/') ? `${rpaBase}${rawFileUrl}` : rawFileUrl || undefined

    if (!deliverableId) {
      return NextResponse.json({ error: '缺少 deliverableId' }, { status: 400 })
    }

    if (status === 'completed' && fileUrl) {
      // RPA 任务完成，写回文件 URL，更新状态为 pending_review（等待人工确认）
      await db
        .update(deliverables)
        .set({
          fileUrl,
          status: 'pending_review',
          updatedAt: new Date(),
        })
        .where(eq(deliverables.id, deliverableId))

      return NextResponse.json({
        ok: true,
        message: `成果物 ${deliverableId} 文件已更新，等待审批`,
        fileUrl,
      })
    } else if (status === 'failed') {
      // RPA 失败，在 metadata 中记录错误信息
      const existing = await db.query.deliverables.findFirst({
        where: eq(deliverables.id, deliverableId),
      })
      const currentMeta = (existing?.metadata as Record<string, unknown>) ?? {}
      await db
        .update(deliverables)
        .set({
          metadata: { ...currentMeta, rpaError: error ?? '未知错误', rpaTaskId: taskExecutionId, rpaFailedAt: new Date().toISOString() },
          updatedAt: new Date(),
        })
        .where(eq(deliverables.id, deliverableId))

      return NextResponse.json({
        ok: false,
        message: `RPA 任务失败：${error}`,
      })
    } else {
      // 其他状态（pending/running），只记录 taskExecutionId
      const existing = await db.query.deliverables.findFirst({
        where: eq(deliverables.id, deliverableId),
      })
      const currentMeta = (existing?.metadata as Record<string, unknown>) ?? {}
      await db
        .update(deliverables)
        .set({
          metadata: { ...currentMeta, rpaTaskId: taskExecutionId, rpaStatus: status },
          updatedAt: new Date(),
        })
        .where(eq(deliverables.id, deliverableId))

      return NextResponse.json({ ok: true, message: `状态已更新：${status}` })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
