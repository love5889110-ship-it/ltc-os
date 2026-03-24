import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { customers, opportunities } from '@/db/schema'
import { generateId } from '@/lib/utils'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const opps = q
    ? await db.query.opportunities.findMany({
        where: (o, { ilike }) => ilike(o.name, `%${q}%`),
        limit: 30,
      })
    : await db.select().from(opportunities)
  return NextResponse.json({ opportunities: opps })
}

// POST /api/opportunities
// Body: { name, customerId? } OR { name, customerName, customerIndustry? }
// Creates customer (if customerName provided) + opportunity, returns { opportunityId, customerId }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, customerId, customerName, customerIndustry } = body

  if (!name) {
    return NextResponse.json({ error: '缺少商机名称' }, { status: 400 })
  }

  let resolvedCustomerId = customerId as string | undefined

  if (!resolvedCustomerId && customerName) {
    // Check if customer with same name exists
    const existing = await db.query.customers.findFirst({
      where: eq(customers.name, customerName),
    })
    if (existing) {
      resolvedCustomerId = existing.id
    } else {
      resolvedCustomerId = generateId()
      await db.insert(customers).values({
        id: resolvedCustomerId,
        name: customerName,
        industry: customerIndustry ?? null,
      })
    }
  }

  if (!resolvedCustomerId) {
    return NextResponse.json({ error: '缺少客户信息（customerId 或 customerName）' }, { status: 400 })
  }

  const opportunityId = generateId()
  await db.insert(opportunities).values({
    id: opportunityId,
    customerId: resolvedCustomerId,
    name,
    stage: '初接触',
    status: 'active',
  })

  return NextResponse.json({ opportunityId, customerId: resolvedCustomerId }, { status: 201 })
}
