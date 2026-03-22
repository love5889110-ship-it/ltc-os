import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { syncGetNote } from '@/lib/connectors/get-note'

// GET /api/connectors/get-note/poll
// Called by a cron job or external scheduler every N minutes
// Returns summary of all synced signals
export async function GET(req: NextRequest) {
  // Simple security: only allow internal calls or with a secret
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connectors = await db.query.connectorInstances.findMany({
    where: (c, { and, eq }) => and(
      eq(c.connectorType, 'get_note'),
      eq(c.enabled, true)
    ),
  })

  if (connectors.length === 0) {
    return NextResponse.json({ message: '无已启用的 Get 笔记连接器' })
  }

  const results = []
  for (const connector of connectors) {
    try {
      const result = await syncGetNote(connector.id)
      results.push({ connectorId: connector.id, ...result })
    } catch (e) {
      results.push({
        connectorId: connector.id,
        error: e instanceof Error ? e.message : '同步失败',
      })
    }
  }

  return NextResponse.json({ polled: results.length, results })
}
