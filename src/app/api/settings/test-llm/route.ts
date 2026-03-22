import { NextRequest, NextResponse } from 'next/server'
import { getAISettings } from '@/lib/ai-settings'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  // Use provided values or fall back to saved settings
  const settings = await getAISettings()
  const apiKey = body.apiKey ?? settings.llmApiKey ?? process.env.MINIMAX_API_KEY ?? ''
  const baseUrl = body.baseUrl ?? settings.llmBaseUrl ?? 'https://api.minimax.chat/v1/text/chatcompletion_v2'
  const model = body.model ?? settings.llmModel ?? 'MiniMax-Text-01'

  if (!apiKey) {
    return NextResponse.json({ error: '未配置 API Key' }, { status: 400 })
  }

  const start = Date.now()
  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一个测试助手，只需回复"连接成功"。' },
          { role: 'user', content: '测试连接，请回复"连接成功"。' },
        ],
        max_tokens: 20,
        temperature: 0,
      }),
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `API 返回 ${res.status}: ${text}` }, { status: 400 })
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? ''

    return NextResponse.json({ ok: true, model, latencyMs, reply: content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `请求失败：${msg}` }, { status: 500 })
  }
}
