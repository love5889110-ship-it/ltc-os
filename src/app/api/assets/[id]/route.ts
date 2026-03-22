import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { assets } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const asset = await db.query.assets.findFirst({ where: eq(assets.id, id) })
  if (!asset) return NextResponse.json({ error: '资产不存在' }, { status: 404 })
  return NextResponse.json({ asset })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { title, summary, fullContent, tags, industries, stages, status, qualityScore } = body

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (title !== undefined) updates.title = title
  if (summary !== undefined) updates.summary = summary
  if (fullContent !== undefined) updates.fullContent = fullContent
  if (tags !== undefined) updates.tags = tags
  if (industries !== undefined) updates.industries = industries
  if (stages !== undefined) updates.stages = stages
  if (status !== undefined) updates.status = status
  if (qualityScore !== undefined) updates.qualityScore = qualityScore

  await db.update(assets).set(updates as any).where(eq(assets.id, id))
  const updated = await db.query.assets.findFirst({ where: eq(assets.id, id) })
  return NextResponse.json({ asset: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await db.update(assets).set({ status: 'archived', updatedAt: new Date() }).where(eq(assets.id, id))
  return NextResponse.json({ success: true })
}
