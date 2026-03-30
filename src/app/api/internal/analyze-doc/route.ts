/**
 * 内部文档分析/信息提取 API
 * 供预置 skillTemplates 通过 executionConfig type='http' 调用
 * POST /api/internal/analyze-doc
 */
import { NextRequest, NextResponse } from 'next/server'
import { minimaxChat } from '@/lib/minimax'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    content,
    extractFields,
    instruction,
    workspaceId,
  } = body as {
    content: string
    extractFields?: string[]
    instruction?: string
    workspaceId?: string
  }

  if (!content && !instruction) {
    return NextResponse.json({ error: '缺少 content 或 instruction 参数' }, { status: 400 })
  }

  const fieldsHint = extractFields && extractFields.length > 0
    ? `\n\n需要提取的字段：\n${extractFields.map(f => `- ${f}`).join('\n')}\n\n请以 JSON 格式输出，键名为字段名，值为提取到的内容（找不到则为 null）。`
    : ''

  const systemPrompt = `你是一名文档分析专家，擅长从文本中提取关键信息。
要求：
- 准确提取，不要臆造
- 若无明确说明，以 JSON 格式输出提取结果
- 找不到的字段填写 null，不要省略`

  const userMsg = instruction
    ? `${instruction}\n\n文档内容：\n${content ?? ''}${fieldsHint}`
    : `请分析以下文档并提取关键信息：\n\n${content}${fieldsHint}`

  let result: string
  try {
    result = await minimaxChat({
      system: systemPrompt,
      user: userMsg,
      maxTokens: 2048,
    })
  } catch (e) {
    return NextResponse.json({ error: `AI 分析失败：${String(e)}` }, { status: 500 })
  }

  // 尝试解析 JSON 输出
  let parsedResult: Record<string, unknown> | null = null
  if (extractFields && extractFields.length > 0) {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsedResult = JSON.parse(jsonMatch[0])
    } catch { /* 保留原始文本 */ }
  }

  return NextResponse.json({
    success: true,
    result: parsedResult ?? result,
    rawText: result,
  })
}
