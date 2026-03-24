/**
 * 技能沙盘 API
 * 对话驱动：用自然语言描述想要的技能 → AI 生成规格 → 测试 → 封装上架
 *
 * POST /api/skill-sandbox/chat    — 与 AI 对话，构建/更新技能规格
 * POST /api/skill-sandbox/test    — 用当前配置执行一次测试
 * POST /api/skill-sandbox/publish — 封装上架为 skill_template
 * POST /api/skill-sandbox/import  — 导入标准 skill JSON（OpenAI FC 格式）
 * GET  /api/skill-sandbox?id=xxx  — 获取沙盘状态
 * GET  /api/skill-sandbox         — 获取所有沙盘列表
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { skillSandboxes, skillTemplates } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { minimaxChatMultiTurn } from '@/lib/minimax'
import { getToolById } from '@/lib/tool-registry'
import { db as dbClient } from '@/db'
import { connectorInstances } from '@/db/schema'

const SANDBOX_AI_SYSTEM = `你是一个技能构建助手，帮助用户设计和调试 AI 数字员工的行动技能。

你的工作流程：
1. 理解用户想创建的技能（调用 HTTP API / 执行代码 / 调用现有工具）
2. 构建标准技能规格（符合 JSON Schema 的 inputSchema）
3. 根据类型生成执行配置
4. 引导用户测试和迭代

始终以 JSON 格式回复，结构如下：
{
  "message": "给用户的自然语言回复",
  "skillSpec": {
    "name": "技能英文ID（小写下划线）",
    "displayName": "技能中文名",
    "description": "技能描述",
    "inputSchema": {
      "type": "object",
      "properties": {
        "paramName": { "type": "string", "description": "参数描述" }
      },
      "required": ["paramName"]
    }
  },
  "executionConfig": {
    "type": "http",
    "httpMethod": "GET",
    "apiUrl": "https://...",
    "headers": {},
    "bodyTemplate": {}
  },
  "readyToTest": false,
  "suggestions": ["下一步建议1", "下一步建议2"]
}

executionConfig.type 可以是：
- "http"：调用外部 HTTP API
- "builtin"：使用系统内置工具（toolId 字段指定）
- "stub"：暂时存根，后续再配置

如果用户粘贴 OpenAI Function Calling 格式，自动解析并填充 skillSpec。`

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const sandbox = await db.query.skillSandboxes.findFirst({
      where: eq(skillSandboxes.id, id),
    })
    if (!sandbox) return NextResponse.json({ error: '沙盘不存在' }, { status: 404 })
    return NextResponse.json(sandbox)
  }

  // 列出所有沙盘
  const list = await db.query.skillSandboxes.findMany({
    orderBy: [desc(skillSandboxes.updatedAt)],
  })
  return NextResponse.json({ sandboxes: list })
}

export async function POST(req: NextRequest) {
  const url = req.nextUrl
  const action = url.searchParams.get('action') ?? url.pathname.split('/').pop()

  const body = await req.json()

  if (action === 'chat') return handleChat(body)
  if (action === 'test') return handleTest(body)
  if (action === 'publish') return handlePublish(body)
  if (action === 'import') return handleImport(body)

  return NextResponse.json({ error: '未知操作，请使用 ?action=chat|test|publish|import' }, { status: 400 })
}

// ── 对话：AI 辅助构建技能规格 ───────────────────────────────────────────────

async function handleChat(body: Record<string, unknown>) {
  const { sandboxId, userMessage } = body as { sandboxId?: string; userMessage: string }

  if (!userMessage?.trim()) {
    return NextResponse.json({ error: '消息不能为空' }, { status: 400 })
  }

  // 获取或创建沙盘
  let sandbox = sandboxId
    ? await db.query.skillSandboxes.findFirst({ where: eq(skillSandboxes.id, sandboxId) })
    : null

  const isNew = !sandbox
  const sid = sandbox?.id ?? generateId()

  if (isNew) {
    await db.insert(skillSandboxes).values({
      id: sid,
      name: null,
      toolSource: 'http',
      skillSpecJson: {},
      executionConfigJson: {},
      chatHistoryJson: [],
      testRoundsJson: [],
      status: 'drafting',
    })
    sandbox = await db.query.skillSandboxes.findFirst({ where: eq(skillSandboxes.id, sid) })
  }

  // 构建对话历史
  const history = (sandbox?.chatHistoryJson as Array<{ role: string; content: string }> | null) ?? []
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ]

  // 在 user 消息里附加当前技能规格作为上下文
  const currentSpec = sandbox?.skillSpecJson
  const contextNote = currentSpec && Object.keys(currentSpec as object).length > 0
    ? `\n\n[当前技能规格：${JSON.stringify(currentSpec, null, 2)}]`
    : ''

  const messagesWithContext: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...messages.slice(0, -1),
    { role: 'user', content: userMessage + contextNote },
  ]

  let aiRaw = ''
  try {
    aiRaw = await minimaxChatMultiTurn({
      system: SANDBOX_AI_SYSTEM,
      messages: messagesWithContext,
      maxTokens: 2048,
      temperature: 0.4,
    })
  } catch (e) {
    return NextResponse.json({ error: `AI 调用失败：${String(e)}` }, { status: 500 })
  }

  // 解析 AI JSON 输出（容错）
  let aiResult: Record<string, unknown> = { message: aiRaw }
  try {
    const jsonMatch = aiRaw.match(/\{[\s\S]*\}/)
    if (jsonMatch) aiResult = JSON.parse(jsonMatch[0])
  } catch { /* 保留原始文本 */ }

  const aiMessage = (aiResult.message as string) ?? aiRaw

  // 更新对话历史
  const updatedHistory = [
    ...history,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: aiMessage },
  ]

  // 更新技能规格和执行配置（如果 AI 提供了）
  const updates: Record<string, unknown> = {
    chatHistoryJson: updatedHistory,
    updatedAt: new Date(),
  }
  if (aiResult.skillSpec && typeof aiResult.skillSpec === 'object') {
    updates.skillSpecJson = aiResult.skillSpec
  }
  if (aiResult.executionConfig && typeof aiResult.executionConfig === 'object') {
    updates.executionConfigJson = aiResult.executionConfig
    const execType = (aiResult.executionConfig as Record<string, unknown>).type as string
    if (execType) updates.toolSource = execType
  }
  if (!sandbox?.name && aiResult.skillSpec) {
    const spec = aiResult.skillSpec as Record<string, unknown>
    updates.name = (spec.displayName as string) ?? (spec.name as string) ?? null
  }

  await db.update(skillSandboxes).set(updates as any).where(eq(skillSandboxes.id, sid))

  return NextResponse.json({
    sandboxId: sid,
    message: aiMessage,
    skillSpec: aiResult.skillSpec ?? sandbox?.skillSpecJson,
    executionConfig: aiResult.executionConfig ?? sandbox?.executionConfigJson,
    readyToTest: aiResult.readyToTest ?? false,
    suggestions: aiResult.suggestions ?? [],
    isNew,
  })
}

// ── 测试：执行一次技能调用 ───────────────────────────────────────────────────

async function handleTest(body: Record<string, unknown>) {
  const { sandboxId, testParams } = body as {
    sandboxId: string
    testParams: Record<string, unknown>
  }

  if (!sandboxId) return NextResponse.json({ error: '缺少 sandboxId' }, { status: 400 })

  const sandbox = await db.query.skillSandboxes.findFirst({
    where: eq(skillSandboxes.id, sandboxId),
  })
  if (!sandbox) return NextResponse.json({ error: '沙盘不存在' }, { status: 404 })

  const execConfig = (sandbox.executionConfigJson as Record<string, unknown>) ?? {}
  const execType = (execConfig.type as string) ?? 'stub'

  let result: { success: boolean; message: string; data?: unknown }

  if (execType === 'http') {
    // HTTP 调用
    const apiUrl = execConfig.apiUrl as string
    if (!apiUrl) {
      result = { success: false, message: '执行配置中缺少 apiUrl' }
    } else {
      try {
        const method = ((execConfig.httpMethod as string) ?? 'GET').toUpperCase()
        const headers = (execConfig.headers as Record<string, string>) ?? {}
        const fetchOptions: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
        }
        if (method !== 'GET' && Object.keys(testParams).length > 0) {
          fetchOptions.body = JSON.stringify(testParams)
        }
        // 构建 GET 参数
        const url = method === 'GET' && Object.keys(testParams).length > 0
          ? `${apiUrl}?${new URLSearchParams(testParams as Record<string, string>).toString()}`
          : apiUrl
        const res = await fetch(url, fetchOptions)
        const text = await res.text()
        let data: unknown
        try { data = JSON.parse(text) } catch { data = text.slice(0, 1000) }
        result = res.ok
          ? { success: true, message: `HTTP ${res.status}`, data }
          : { success: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` }
      } catch (e) {
        result = { success: false, message: `网络错误：${String(e)}` }
      }
    }
  } else if (execType === 'builtin') {
    // 调用内置工具
    const toolId = execConfig.toolId as string
    if (!toolId) {
      result = { success: false, message: '执行配置中缺少 toolId' }
    } else {
      const tool = getToolById(toolId)
      if (!tool) {
        result = { success: false, message: `内置工具 "${toolId}" 不存在` }
      } else {
        let connectorConfig: Record<string, unknown> | undefined
        if (tool.requiresConnector) {
          const connector = await dbClient.query.connectorInstances.findFirst({
            where: (c, { and, eq }) => and(
              eq(c.connectorType, tool.requiresConnector as any),
              eq(c.enabled, true)
            ),
          })
          connectorConfig = (connector?.configJson as Record<string, unknown>) ?? undefined
        }
        const toolResult = await tool.execute(testParams, connectorConfig)
        result = toolResult
      }
    }
  } else {
    // stub
    result = { success: true, message: '（存根模式）技能配置已保存，真实执行逻辑待配置', data: testParams }
  }

  // 记录测试轮次
  const rounds = (sandbox.testRoundsJson as unknown[]) ?? []
  const newRound = {
    roundNum: rounds.length + 1,
    testParams,
    result,
    note: '',
    createdAt: new Date().toISOString(),
  }
  await db.update(skillSandboxes)
    .set({
      testRoundsJson: [...rounds, newRound],
      updatedAt: new Date(),
    } as any)
    .where(eq(skillSandboxes.id, sandboxId))

  return NextResponse.json({
    success: result.success,
    message: result.message,
    data: result.data ?? null,
    roundNum: newRound.roundNum,
  })
}

// ── 上架：封装为 skill_template ──────────────────────────────────────────────

async function handlePublish(body: Record<string, unknown>) {
  const { sandboxId, name, description, category } = body as {
    sandboxId: string
    name: string
    description: string
    category?: string
  }

  if (!sandboxId || !name || !description) {
    return NextResponse.json({ error: '缺少必填字段：sandboxId / name / description' }, { status: 400 })
  }

  const sandbox = await db.query.skillSandboxes.findFirst({
    where: eq(skillSandboxes.id, sandboxId),
  })
  if (!sandbox) return NextResponse.json({ error: '沙盘不存在' }, { status: 404 })

  const templateId = generateId()

  await db.insert(skillTemplates).values({
    id: templateId,
    name,
    description,
    category: category ?? 'data',
    toolSource: (sandbox.toolSource as string) ?? 'http',
    skillSpecJson: (sandbox.skillSpecJson as Record<string, unknown>) ?? {},
    executionConfigJson: (sandbox.executionConfigJson as Record<string, unknown>) ?? {},
    sourceSandboxId: sandboxId,
    enabled: true,
  })

  await db.update(skillSandboxes)
    .set({ status: 'published', publishedSkillId: templateId, updatedAt: new Date() } as any)
    .where(eq(skillSandboxes.id, sandboxId))

  return NextResponse.json({ skillTemplateId: templateId, name, message: `技能「${name}」已上架` })
}

// ── 导入：OpenAI Function Calling 格式 ──────────────────────────────────────

async function handleImport(body: Record<string, unknown>) {
  const { skillJson } = body as { skillJson: Record<string, unknown> }
  if (!skillJson) return NextResponse.json({ error: '缺少 skillJson' }, { status: 400 })

  // 兼容两种格式：直接的 function 对象 或 { functions: [...] }
  const fn = Array.isArray(skillJson.functions)
    ? (skillJson.functions[0] as Record<string, unknown>)
    : skillJson

  const skillSpec = {
    name: fn.name as string ?? 'imported_skill',
    displayName: fn.name as string ?? 'Imported Skill',
    description: fn.description as string ?? '',
    inputSchema: (fn.parameters ?? fn.input_schema ?? { type: 'object', properties: {} }),
  }

  const sid = generateId()
  await db.insert(skillSandboxes).values({
    id: sid,
    name: skillSpec.displayName,
    toolSource: 'http',
    skillSpecJson: skillSpec,
    executionConfigJson: { type: 'http', apiUrl: '' },
    chatHistoryJson: [{
      role: 'assistant',
      content: `已导入 skill「${skillSpec.name}」，参数结构已解析完成。请告诉我这个技能调用哪个 API 地址，我来帮你完成执行配置。`,
    }],
    testRoundsJson: [],
    status: 'drafting',
  })

  return NextResponse.json({
    sandboxId: sid,
    skillSpec,
    message: `已导入 skill「${skillSpec.name}」，请继续在沙盘中完善执行配置`,
  })
}
