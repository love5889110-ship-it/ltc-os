import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { signalEvents, signalBindings } from '@/db/schema'
import { ingestSignal } from '@/lib/signal-processor'
import { desc, eq, and } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  let query = db
    .select({
      signal: signalEvents,
      binding: signalBindings,
    })
    .from(signalEvents)
    .leftJoin(signalBindings, eq(signalBindings.signalEventId, signalEvents.id))
    .orderBy(desc(signalEvents.createdAt))
    .limit(limit)

  const rows = await query

  // Group by signal (one signal may have one binding record)
  const seen = new Set<string>()
  const result = rows
    .filter((r) => {
      if (seen.has(r.signal.id)) return false
      seen.add(r.signal.id)
      return true
    })
    .filter((r) => !status || r.signal.status === status)
    .filter((r) => !type || r.signal.signalType === type)
    .map((r) => ({
      ...r.signal,
      binding: r.binding,
    }))

  return NextResponse.json({ signals: result, total: result.length })
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
