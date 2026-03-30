/**
 * 内部文档生成 API
 * 供预置 skillTemplates 通过 executionConfig type='http' 调用
 * POST /api/internal/generate-doc
 */
import { NextRequest, NextResponse } from 'next/server'
import { minimaxChat } from '@/lib/minimax'
import { db } from '@/db'
import { drafts, opportunityWorkspaces, opportunities, customers } from '@/db/schema'
import { generateId } from '@/lib/utils'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    prompt,
    workspaceId,
    outputType = 'text',   // 'text' | 'draft'
    draftType = 'report',  // draft 时的类型
    title,
  } = body as {
    prompt: string
    workspaceId?: string
    outputType?: 'text' | 'draft'
    draftType?: string
    title?: string
  }

  if (!prompt) {
    return NextResponse.json({ error: '缺少 prompt 参数' }, { status: 400 })
  }

  // 如有 workspaceId，补充商机上下文
  let contextBlock = ''
  if (workspaceId) {
    try {
      const ws = await db.query.opportunityWorkspaces.findFirst({
        where: eq(opportunityWorkspaces.id, workspaceId),
      })
      if (ws) {
        const opp = await db.query.opportunities.findFirst({
          where: eq(opportunities.id, ws.opportunityId),
        })
        if (opp) {
          const customer = await db.query.customers.findFirst({
            where: eq(customers.id, opp.customerId),
          })
          contextBlock = `\n\n[商机背景]\n客户：${customer?.name ?? '未知'}\n商机：${opp.name}\n阶段：${opp.stage}\n健康度：${ws.healthScore}\n`
        }
      }
    } catch { /* ignore */ }
  }

  const systemPrompt = `你是一名专业的 B2B 销售支持助手，擅长生成商机推进所需的各类文档。
要求：
- 输出专业、具体、可直接使用的内容
- 中文输出，长度适中（300-800字），除非有明确要求
- 不要输出多余的说明，直接给出文档正文`

  let content: string
  try {
    content = await minimaxChat({
      system: systemPrompt,
      user: prompt + contextBlock,
      maxTokens: 2048,
    })
  } catch (e) {
    return NextResponse.json({ error: `AI 生成失败：${String(e)}` }, { status: 500 })
  }

  // 若需要写入草稿表
  if (outputType === 'draft' && workspaceId) {
    const draftId = generateId()
    const docTitle = title || 'AI 生成文档'
    try {
      await db.insert(drafts).values({
        id: draftId,
        workspaceId,
        runId: null,
        actionId: null,
        draftType: draftType as any,
        title: docTitle,
        recipientInfo: {},
        content,
        draftStatus: 'pending_review',
      })
      return NextResponse.json({ success: true, content, draftId, title: docTitle })
    } catch (e) {
      // 即使写草稿失败，也返回内容
      return NextResponse.json({ success: true, content, draftId: null, error: String(e) })
    }
  }

  return NextResponse.json({ success: true, content })
}
