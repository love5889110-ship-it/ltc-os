/**
 * 技能库 CRUD
 * GET  /api/skill-templates         — 获取所有上架技能
 * PATCH /api/skill-templates        — 更新（enabled/name/description）或下架
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { skillTemplates } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const templates = await db.query.skillTemplates.findMany({
    orderBy: [desc(skillTemplates.createdAt)],
  })
  return NextResponse.json({ templates })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, enabled, name, description, category } = body as {
    id: string
    enabled?: boolean
    name?: string
    description?: string
    category?: string
  }

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (enabled !== undefined) updates.enabled = enabled
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (category !== undefined) updates.category = category

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '无可更新字段' }, { status: 400 })
  }

  await db.update(skillTemplates).set(updates as any).where(eq(skillTemplates.id, id))
  return NextResponse.json({ success: true })
}
