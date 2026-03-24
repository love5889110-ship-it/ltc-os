import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { channelPartners } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const partner = await db.query.channelPartners.findFirst({ where: eq(channelPartners.id, id) })
  if (!partner) return NextResponse.json({ error: '渠道商不存在' }, { status: 404 })
  return NextResponse.json({ channelPartner: partner })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { name, region, profileJson } = body

  const existing = await db.query.channelPartners.findFirst({ where: eq(channelPartners.id, id) })
  if (!existing) return NextResponse.json({ error: '渠道商不存在' }, { status: 404 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (region !== undefined) updates.region = region
  if (profileJson !== undefined) {
    const existing_profile = (existing.profileJson as Record<string, unknown>) ?? {}
    updates.profileJson = { ...existing_profile, ...profileJson }
  }

  await db.update(channelPartners).set(updates as any).where(eq(channelPartners.id, id))
  const updated = await db.query.channelPartners.findFirst({ where: eq(channelPartners.id, id) })
  return NextResponse.json({ channelPartner: updated })
}
