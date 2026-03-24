/**
 * 企业微信连接器配置接口
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET() {
  const connector = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'wecom'),
  })
  if (!connector) {
    return NextResponse.json({ configured: false })
  }
  const config = connector.configJson as Record<string, any>
  return NextResponse.json({
    configured: true,
    connectorId: connector.id,
    authStatus: connector.authStatus,
    enabled: connector.enabled,
    hasCorpId: !!config?.corpId,
    hasToken: !!config?.token,
    chatIds: config?.chatIds ?? [],
    chatNames: config?.chatNames ?? [],
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/wecom/webhook`,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { corpId, token, encodingAESKey, chatIds, chatNames } = body

  const existing = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'wecom'),
  })

  const configJson = {
    ...(existing?.configJson as Record<string, any> ?? {}),
    ...(corpId ? { corpId } : {}),
    ...(token ? { token } : {}),
    ...(encodingAESKey ? { encodingAESKey } : {}),
    ...(chatIds !== undefined ? { chatIds } : {}),
    ...(chatNames !== undefined ? { chatNames } : {}),
  }

  if (existing) {
    await db.update(connectorInstances)
      .set({
        configJson,
        authStatus: corpId && token ? 'authorized' : existing.authStatus,
        enabled: true,
        updatedAt: new Date(),
      })
      .where(eq(connectorInstances.id, existing.id))
    return NextResponse.json({ success: true, connectorId: existing.id })
  } else {
    const id = generateId()
    await db.insert(connectorInstances).values({
      id,
      connectorType: 'wecom',
      connectorName: '企业微信',
      configJson,
      authStatus: corpId && token ? 'authorized' : 'pending',
      healthStatus: 'healthy',
      enabled: true,
    })
    return NextResponse.json({ success: true, connectorId: id })
  }
}
