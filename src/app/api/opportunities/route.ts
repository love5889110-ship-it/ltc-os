import { NextResponse } from 'next/server'
import { db } from '@/db'
import { opportunities } from '@/db/schema'

export async function GET() {
  const opps = await db.select().from(opportunities)
  return NextResponse.json({ opportunities: opps })
}
