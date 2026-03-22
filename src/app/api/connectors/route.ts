import { NextResponse } from 'next/server'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'

export async function GET() {
  const connectors = await db.select().from(connectorInstances)
  return NextResponse.json({ connectors })
}
