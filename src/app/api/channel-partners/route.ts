import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { channelPartners } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export async function GET() {
  const partners = await db.query.channelPartners.findMany({
    orderBy: [desc(channelPartners.updatedAt)],
  })
  return NextResponse.json({ channelPartners: partners })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, region, profileJson } = body
  if (!name?.trim()) return NextResponse.json({ error: '渠道商名称不能为空' }, { status: 400 })

  const id = nanoid()
  await db.insert(channelPartners).values({
    id,
    name: name.trim(),
    region: region?.trim() || null,
    profileJson: profileJson ?? {},
  })
  const partner = await db.query.channelPartners.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  })
  return NextResponse.json({ channelPartner: partner }, { status: 201 })
}
