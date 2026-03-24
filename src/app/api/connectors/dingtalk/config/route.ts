/**
 * 钉钉连接器配置接口
 * POST: 保存/更新钉钉应用凭证和监听群白名单
 * GET:  返回当前配置状态
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET() {
  const connector = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'dingtalk'),
  })
  if (!connector) {
    return NextResponse.json({ configured: false })
  }
  const config = connector.configJson as Record<string, any>
  return NextResponse.json({
    configured: true,
    connectorId: connector.id,
    authStatus: connector.authStatus,
    healthStatus: connector.healthStatus,
    enabled: connector.enabled,
    // Mask secrets in response
    hasAppKey: !!config?.appKey,
    hasAppSecret: !!config?.appSecret,
    groupIds: config?.groupIds ?? [],
    groupNames: config?.groupNames ?? [],
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/dingtalk/webhook`,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { appKey, appSecret, groupIds, groupNames } = body

  const existing = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'dingtalk'),
  })

  const configJson = {
    ...(existing?.configJson as Record<string, any> ?? {}),
    ...(appKey ? { appKey } : {}),
    ...(appSecret ? { appSecret } : {}),
    ...(groupIds !== undefined ? { groupIds } : {}),
    ...(groupNames !== undefined ? { groupNames } : {}),
  }

  if (existing) {
    await db.update(connectorInstances)
      .set({
        configJson,
        authStatus: appKey && appSecret ? 'authorized' : existing.authStatus,
        enabled: true,
        updatedAt: new Date(),
      })
      .where(eq(connectorInstances.id, existing.id))
    return NextResponse.json({ success: true, connectorId: existing.id })
  } else {
    const id = generateId()
    await db.insert(connectorInstances).values({
      id,
      connectorType: 'dingtalk',
      connectorName: '钉钉',
      configJson,
      authStatus: appKey && appSecret ? 'authorized' : 'pending',
      healthStatus: 'healthy',
      enabled: true,
    })
    return NextResponse.json({ success: true, connectorId: id })
  }
}
