import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'text',
        content: { text: '【ltc-os 测试消息】飞书 Webhook 配置成功，数字员工通知已就绪 ✓' },
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `飞书返回 ${res.status}：${text}` }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `请求失败：${msg}` }, { status: 500 })
  }
}
