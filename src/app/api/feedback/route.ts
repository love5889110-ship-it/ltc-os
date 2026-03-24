import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { feedbackSamples } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

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
