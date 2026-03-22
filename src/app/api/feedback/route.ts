import { NextResponse } from 'next/server'
import { db } from '@/db'
import { feedbackSamples } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const samples = await db
    .select()
    .from(feedbackSamples)
    .orderBy(desc(feedbackSamples.createdAt))
    .limit(100)
  return NextResponse.json({ samples })
}
