import { NextResponse } from 'next/server'
import { getAISettings, saveAISettings } from '@/lib/ai-settings'

export async function GET() {
  return NextResponse.json(await getAISettings())
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const updated = await saveAISettings(body)
  return NextResponse.json(updated)
}
