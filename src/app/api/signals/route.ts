import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { signalEvents, signalBindings, feedbackSamples } from '@/db/schema'
import { ingestSignal } from '@/lib/signal-processor'
import { desc, eq, ne, inArray } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  const rows = await db
    .select({
      signal: signalEvents,
      binding: signalBindings,
    })
    .from(signalEvents)
    .leftJoin(signalBindings, eq(signalBindings.signalEventId, signalEvents.id))
    // Default: exclude closed unless explicitly requested
    .where(status ? eq(signalEvents.status, status as any) : ne(signalEvents.status, 'closed' as any))
    .orderBy(desc(signalEvents.createdAt))
    .limit(limit)

  // Group by signal (one signal may have one binding record)
  const seen = new Set<string>()
  const result = rows
    .filter((r) => {
      if (seen.has(r.signal.id)) return false
      seen.add(r.signal.id)
      return true
    })
    .filter((r) => !type || r.signal.signalType === type)
    .map((r) => ({
      ...r.signal,
      binding: r.binding,
    }))

  return NextResponse.json({ signals: result, total: result.length })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { action, ids, ignoreReason } = body as { action: string; ids: string[]; ignoreReason?: string }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '缺少 ids' }, { status: 400 })
  }

  if (action === 'ignore') {
    // [P0-5] Batch ignore — soft-delete + write feedbackSamples
    await db
      .update(signalEvents)
      .set({ status: 'closed' })
      .where(inArray(signalEvents.id, ids))

    // Write one feedbackSample per signal
    for (const id of ids) {
      const signal = await db.query.signalEvents.findFirst({ where: eq(signalEvents.id, id) })
      if (signal) {
        await db.insert(feedbackSamples).values({
          id: generateId(),
          sourceType: 'signal_ignore',
          sourceObjectId: id,
          workspaceId: null,
          feedbackLabel: 'rejected',
          feedbackReasonCode: ignoreReason ? `ignore_${ignoreReason}` : 'batch_ignored',
          originalOutputJson: { signalType: signal.signalType, summary: signal.contentSummary },
          reusableFlag: true,
        })
      }
    }

    return NextResponse.json({ ignored: ids.length })
  }

  return NextResponse.json({ error: '未知 action' }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { ids } = body as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '缺少 ids' }, { status: 400 })
  }
  // [P0-6] Soft-delete: mark closed + write feedbackSamples (preserve training signal)
  await db
    .update(signalEvents)
    .set({ status: 'closed' })
    .where(inArray(signalEvents.id, ids))

  for (const id of ids) {
    const signal = await db.query.signalEvents.findFirst({ where: eq(signalEvents.id, id) })
    if (signal) {
      await db.insert(feedbackSamples).values({
        id: generateId(),
        sourceType: 'signal_ignore',
        sourceObjectId: id,
        workspaceId: null,
        feedbackLabel: 'rejected',
        feedbackReasonCode: 'bulk_deleted',
        originalOutputJson: { signalType: signal.signalType, summary: signal.contentSummary },
        reusableFlag: false,
      })
    }
  }

  return NextResponse.json({ deleted: ids.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { sourceType, sourceInstanceId, rawContent, eventTime } = body

  if (!rawContent || !sourceType) {
    return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
  }

  const result = await ingestSignal({
    sourceType,
    sourceInstanceId,
    rawContent,
    eventTime: eventTime ? new Date(eventTime) : undefined,
  })

  return NextResponse.json(result, { status: 201 })
}
