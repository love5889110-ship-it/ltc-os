import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { syncGetNote } from '@/lib/connectors/get-note'
import { generateId } from '@/lib/utils'

// POST /api/connectors/get-note/sync
// Body: { connectorId? } — if omitted, finds the first active get_note connector
// Also handles initial setup: { apiKey, clientId } to create/update connector
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { connectorId, apiKey, clientId, keyword } = body

  let resolvedId = connectorId as string | undefined

  // If apiKey/clientId provided, upsert connector config
  if (apiKey && clientId) {
    const existing = await db.query.connectorInstances.findFirst({
      where: eq(connectorInstances.connectorType, 'get_note'),
    })
    if (existing) {
      await db.update(connectorInstances)
        .set({
          configJson: { apiKey, clientId },
          authStatus: 'authorized',
          enabled: true,
          updatedAt: new Date(),
        })
        .where(eq(connectorInstances.id, existing.id))
      resolvedId = existing.id
    } else {
      resolvedId = generateId()
      await db.insert(connectorInstances).values({
        id: resolvedId,
        connectorType: 'get_note',
        connectorName: 'Get 笔记',
        configJson: { apiKey, clientId },
        authStatus: 'authorized',
        healthStatus: 'healthy',
        enabled: true,
      })
    }
  }

  // Find connector if still not resolved — prefer the one with config
  if (!resolvedId) {
    const allConnectors = await db.query.connectorInstances.findMany({
      where: eq(connectorInstances.connectorType, 'get_note'),
    })
    // Prefer the one that has apiKey configured
    const configured = allConnectors.find((c) => {
      const cfg = c.configJson as { apiKey?: string }
      return !!cfg?.apiKey
    })
    const connector = configured ?? allConnectors[0]
    if (!connector) {
      return NextResponse.json({ error: '未找到 Get 笔记连接器，请先配置 apiKey 和 clientId' }, { status: 404 })
    }
    resolvedId = connector.id
  }

  try {
    const result = await syncGetNote(resolvedId, { keyword: keyword || undefined })
    return NextResponse.json({ success: true, connectorId: resolvedId, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '同步失败' },
      { status: 500 }
    )
  }
}

// GET /api/connectors/get-note/sync — return connector status
export async function GET() {
  const connector = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'get_note'),
  })
  if (!connector) {
    return NextResponse.json({ configured: false })
  }
  const config = connector.configJson as { apiKey?: string; clientId?: string }
  return NextResponse.json({
    configured: true,
    connectorId: connector.id,
    authStatus: connector.authStatus,
    healthStatus: connector.healthStatus,
    enabled: connector.enabled,
    lastSyncAt: connector.lastSyncAt,
    hasApiKey: !!config.apiKey,
    hasClientId: !!config.clientId,
  })
}
