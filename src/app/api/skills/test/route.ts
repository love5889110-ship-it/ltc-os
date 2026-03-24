import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { connectorInstances, executionLogs, agentActions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { getToolById } from '@/lib/tool-registry'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { toolId, toolInput } = body as { toolId?: string; toolInput?: Record<string, unknown> }

  if (!toolId) {
    return NextResponse.json({ error: '缺少 toolId' }, { status: 400 })
  }

  const tool = getToolById(toolId)
  if (!tool) {
    return NextResponse.json({ error: `工具 ${toolId} 不存在` }, { status: 400 })
  }

  // Load connector config if needed
  let connectorConfig: Record<string, unknown> | undefined
  if (tool.requiresConnector) {
    const connector = await db.query.connectorInstances.findFirst({
      where: (c, { and, eq }) => and(
        eq(c.connectorType, tool.requiresConnector as any),
        eq(c.enabled, true)
      ),
    })
    if (!connector) {
      return NextResponse.json({
        success: false,
        message: `工具「${tool.name}」需要先完成 ${tool.requiresConnector} 授权`,
      })
    }
    connectorConfig = (connector.configJson as Record<string, unknown>) ?? undefined
  }

  try {
    const result = await tool.execute(toolInput ?? {}, connectorConfig)
    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: result.data ?? null,
      toolName: tool.name,
    })
  } catch (e) {
    return NextResponse.json({
      success: false,
      message: `工具执行异常：${e instanceof Error ? e.message : String(e)}`,
    })
  }
}
