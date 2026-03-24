import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { customers } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) })
  if (!customer) return NextResponse.json({ error: '客户不存在' }, { status: 404 })
  return NextResponse.json({ customer })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { name, industry, region, profileJson } = body

  const existing = await db.query.customers.findFirst({ where: eq(customers.id, id) })
  if (!existing) return NextResponse.json({ error: '客户不存在' }, { status: 404 })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (industry !== undefined) updates.industry = industry
  if (region !== undefined) updates.region = region
  if (profileJson !== undefined) {
    // Deep merge: combine existing profile with incoming updates
    const existing_profile = (existing.profileJson as Record<string, unknown>) ?? {}
    updates.profileJson = { ...existing_profile, ...profileJson }
  }

  await db.update(customers).set(updates as any).where(eq(customers.id, id))
  const updated = await db.query.customers.findFirst({ where: eq(customers.id, id) })
  return NextResponse.json({ customer: updated })
}
