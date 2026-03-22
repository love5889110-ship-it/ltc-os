import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assets } from '@/db/schema'
import { eq, and, ilike, or } from 'drizzle-orm'
import { generateId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const assetType = searchParams.get('type')
  const stage = searchParams.get('stage')
  const keyword = searchParams.get('keyword')
  const status = searchParams.get('status') ?? 'active'

  const rows = await db.query.assets.findMany({
    where: (a, { and, eq, or, ilike }) => {
      const conds = [eq(a.status, status as any)]
      if (assetType) conds.push(eq(a.assetType, assetType as any))
      if (keyword) conds.push(or(
        ilike(a.title, `%${keyword}%`),
        ilike(a.summary, `%${keyword}%`)
      ) as any)
      return and(...conds)
    },
    orderBy: (a, { desc }) => [desc(a.usageCount), desc(a.qualityScore)],
    limit: 50,
  })

  // Filter by stage if requested (jsonb array field)
  const filtered = stage
    ? rows.filter((a) => Array.isArray(a.stages) && (a.stages as string[]).includes(stage))
    : rows

  return NextResponse.json({ assets: filtered })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { assetType, title, summary, fullContent, tags, industries, stages, workspaceId, sourceAgentType } = body

  if (!assetType || !title) {
    return NextResponse.json({ error: '缺少必要字段' }, { status: 400 })
  }

  const id = generateId()
  await db.insert(assets).values({
    id,
    assetType,
    title,
    summary: summary ?? null,
    fullContent: fullContent ?? null,
    tags: tags ?? [],
    industries: industries ?? [],
    stages: stages ?? [],
    workspaceId: workspaceId ?? null,
    sourceAgentType: sourceAgentType ?? null,
    status: 'active',
  })

  const created = await db.query.assets.findFirst({ where: eq(assets.id, id) })
  return NextResponse.json({ asset: created }, { status: 201 })
}
