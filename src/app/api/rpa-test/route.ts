import { NextRequest, NextResponse } from 'next/server'

const RPA_URL = process.env.RPA_SERVER_URL ?? 'http://localhost:8001'

/**
 * POST /api/rpa-test
 * 代理到 RPA Agent Server，用于沙盘直接测试文件生成能力
 * Body: { taskType, taskParams }
 */
export async function POST(req: NextRequest) {
  const body = await req.json() as { taskType: string; taskParams: Record<string, unknown> }
  const { taskType, taskParams } = body

  if (!taskType) {
    return NextResponse.json({ error: '缺少 taskType' }, { status: 400 })
  }

  try {
    const res = await fetch(`${RPA_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskType, taskParams }),
    })
    const json = await res.json() as Record<string, unknown>
    if (!res.ok) {
      return NextResponse.json({ error: (json.detail as string) ?? `RPA 错误 ${res.status}` }, { status: 502 })
    }
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json(
      { error: `RPA 服务不可达（${RPA_URL}）：${String(e)}。请先启动 rpa-agent-server。` },
      { status: 502 },
    )
  }
}

/**
 * GET /api/rpa-test?taskId=xxx
 * 轮询任务状态
 */
export async function GET(req: NextRequest) {
  const taskId = new URL(req.url).searchParams.get('taskId')
  if (!taskId) {
    return NextResponse.json({ error: '缺少 taskId' }, { status: 400 })
  }

  try {
    const res = await fetch(`${RPA_URL}/api/tasks/${taskId}`)
    const json = await res.json() as Record<string, unknown>
    if (!res.ok) {
      return NextResponse.json({ error: `任务不存在或 RPA 错误 ${res.status}` }, { status: 502 })
    }
    // 将相对路径 /files/xxx 转为绝对 URL，避免前端 404
    if (typeof json.outputFileUrl === 'string' && json.outputFileUrl.startsWith('/files/')) {
      json.outputFileUrl = `${RPA_URL}${json.outputFileUrl}`
    }
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json(
      { error: `RPA 服务不可达：${String(e)}` },
      { status: 502 },
    )
  }
}
