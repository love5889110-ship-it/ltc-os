import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { feedbackSamples } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { createHash } from 'crypto'

/** 语义去重 hash：sourceObjectId 精确去重 + agentType+workspaceId+原始输出前100字哈希 */
function feedbackDedupeHash(agentType: string, workspaceId: string, originalOutputJson: unknown): string {
  const snippet = JSON.stringify(originalOutputJson ?? {}).slice(0, 100).toLowerCase().trim()
  const key = `${agentType}|${workspaceId}|${snippet}`
  return createHash('md5').update(key).digest('hex').slice(0, 16)
}

export async function GET() {
  const samples = await db
    .select()
    .from(feedbackSamples)
    .orderBy(desc(feedbackSamples.createdAt))
    .limit(100)
  return NextResponse.json({ samples })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      sourceType,
      sourceObjectId,
      agentType,
      scenarioType,
      workspaceId,
      originalOutputJson,
      correctedOutputJson,
      feedbackLabel,
      feedbackReasonCode,
      reusableFlag,
      versionTag,
    } = body

    if (!sourceType || !sourceObjectId || !feedbackLabel) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    // 精确去重：同一 sourceObjectId 已存在样本则直接返回
    const existing = await db.query.feedbackSamples.findFirst({
      where: (s, { eq }) => eq(s.sourceObjectId, sourceObjectId),
    })
    if (existing) {
      return NextResponse.json({ id: existing.id, duplicate: true, message: '该来源对象已有反馈样本，已返回原记录' })
    }

    // 语义去重：同 agentType + workspaceId + 输出内容前100字
    if (agentType && workspaceId) {
      const dedupe = feedbackDedupeHash(agentType, workspaceId, originalOutputJson)
      const allSamples = await db.query.feedbackSamples.findMany({
        where: (s, { and, eq }) => and(eq(s.agentType, agentType), eq(s.workspaceId, workspaceId)),
      })
      const similar = allSamples.find((s) => {
        const h = feedbackDedupeHash(s.agentType ?? '', s.workspaceId ?? '', s.originalOutputJson)
        return h === dedupe
      })
      if (similar) {
        return NextResponse.json({ id: similar.id, duplicate: true, message: '已存在语义相似的反馈样本，已返回原记录' })
      }
    }

    const id = generateId()
    await db.insert(feedbackSamples).values({
      id,
      sourceType,
      sourceObjectId,
      agentType: agentType ?? null,
      scenarioType: scenarioType ?? null,
      workspaceId: workspaceId ?? null,
      originalOutputJson: originalOutputJson ?? {},
      correctedOutputJson: correctedOutputJson ?? {},
      feedbackLabel,
      feedbackReasonCode: feedbackReasonCode ?? null,
      reusableFlag: reusableFlag ?? true,
      versionTag: versionTag ?? null,
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[feedback POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
