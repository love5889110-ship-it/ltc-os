/**
 * 文件信号接入端点
 *
 * POST /api/signals/upload
 * multipart/form-data:
 *   - file: 上传的文件（图片/PDF/PPT/Word/文本）
 *   - sourceType: 来源类型（默认 'file_upload'）
 *   - fileLabel: 文件用途标签（competitor/proposal/quotation/contract/other）
 *
 * 处理流程：
 *   1. 读取文件内容（文本类直接读，图片类用 MiniMax vision）
 *   2. AI 提取关键信息，结构化为信号内容
 *   3. 调用 ingestSignal 写入收件箱
 */

import { NextRequest, NextResponse } from 'next/server'
import { ingestSignal } from '@/lib/signal-processor'
import { getAISettings } from '@/lib/ai-settings'

// 支持的文件类型
const TEXT_TYPES = [
  'text/plain', 'text/csv', 'text/markdown',
  'application/json',
]
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// 文件用途标签 → 信号类型映射
const LABEL_TO_SIGNAL_TYPE: Record<string, string> = {
  competitor: 'risk',       // 竞品资料 → 风险信号
  quotation: 'demand',      // 报价单 → 需求信号
  proposal: 'opportunity',  // 方案文档 → 商机信号
  contract: 'demand',       // 合同 → 需求信号
  other: 'info',
}

// 文件用途 → 中文说明
const LABEL_NAMES: Record<string, string> = {
  competitor: '竞品资料',
  quotation: '报价单',
  proposal: '方案文档',
  contract: '合同/协议',
  other: '其他文件',
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const sourceType = (formData.get('sourceType') as string) || 'file_upload'
    const fileLabel = (formData.get('fileLabel') as string) || 'other'

    if (!file) {
      return NextResponse.json({ error: '未上传文件' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '文件超过 10MB 限制' }, { status: 400 })
    }

    const mimeType = file.type
    const fileName = file.name
    let extractedText = ''

    // ── 文本类文件：直接读取 ──────────────────────────────────────
    if (TEXT_TYPES.some(t => mimeType.startsWith(t)) || fileName.match(/\.(txt|md|csv|json)$/i)) {
      extractedText = await file.text()
      if (extractedText.length > 8000) extractedText = extractedText.slice(0, 8000) + '\n...(内容过长已截断)'
    }

    // ── 图片类文件：调用 MiniMax Vision ──────────────────────────
    else if (IMAGE_TYPES.includes(mimeType)) {
      const settings = await getAISettings()
      const apiKey = settings.llmApiKey || process.env.MINIMAX_API_KEY || ''

      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64}`

      const res = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'MiniMax-Text-01',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
                {
                  type: 'text',
                  text: `请仔细阅读这张图片，提取所有有价值的信息。这是一份【${LABEL_NAMES[fileLabel] ?? '文件'}】。
请输出：
1. 文件核心内容摘要（2-3句话）
2. 关键数据（价格/时间/人名/公司名/技术参数等）
3. 对销售跟进有价值的关键点
请直接输出提取的内容，不需要解释。`,
                },
              ],
            },
          ],
          max_tokens: 1024,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`图片识别失败: ${err}`)
      }
      const data = await res.json()
      extractedText = data?.choices?.[0]?.message?.content ?? ''
    }

    // ── 其他格式（PDF/PPT/Word）：提示用户转换 ───────────────────
    else {
      // 尝试读取为文本（部分 PDF 可能有文本层）
      try {
        extractedText = await file.text()
        if (extractedText.length < 50 || extractedText.includes('\x00')) {
          return NextResponse.json({
            error: `暂不支持直接解析 ${mimeType} 格式。请将 PDF/PPT/Word 另存为文本后上传，或截图后上传图片。`,
          }, { status: 400 })
        }
        if (extractedText.length > 8000) extractedText = extractedText.slice(0, 8000) + '\n...(内容过长已截断)'
      } catch {
        return NextResponse.json({
          error: `暂不支持直接解析 ${mimeType} 格式。请将文件另存为文本或图片后上传。`,
        }, { status: 400 })
      }
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: '未能从文件中提取到有效内容' }, { status: 400 })
    }

    // ── 构造信号内容 ──────────────────────────────────────────────
    const labelName = LABEL_NAMES[fileLabel] ?? '文件'
    const rawContent = `【${labelName}】${fileName}\n\n${extractedText}`

    // 写入收件箱
    const result = await ingestSignal({
      sourceType,
      rawContent,
      eventTime: new Date(),
      dedupKey: `file_${fileName}_${file.size}`,
      overrideSignalType: LABEL_TO_SIGNAL_TYPE[fileLabel] as any,
    })

    return NextResponse.json({
      ...result,
      fileName,
      fileLabel,
      extractedLength: extractedText.length,
    }, { status: 201 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[signals/upload]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
