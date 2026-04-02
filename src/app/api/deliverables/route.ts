import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { deliverables, feedbackSamples } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/utils'
import { minimaxChat } from '@/lib/minimax'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const type = searchParams.get('type')
  const status = searchParams.get('status')

  const rows = await db.query.deliverables.findMany({
    where: (d, { and, eq }) => {
      const conds: ReturnType<typeof eq>[] = []
      if (workspaceId) conds.push(eq(d.workspaceId, workspaceId))
      if (type) conds.push(eq(d.type, type as any))
      if (status) conds.push(eq(d.status, status as any))
      return conds.length ? and(...conds) : undefined
    },
    orderBy: (d, { desc }) => [desc(d.createdAt)],
    limit: 100,
  })

  return NextResponse.json({ deliverables: rows })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspaceId, type, title, content, stage, audience, metadata, createdBy } = body

  if (!workspaceId || !type || !title) {
    return NextResponse.json({ error: '缺少必填字段 workspaceId/type/title' }, { status: 400 })
  }

  const id = generateId()
  await db.insert(deliverables).values({
    id,
    workspaceId,
    type,
    title,
    content: content ?? null,
    stage: stage ?? null,
    audience: audience ?? null,
    metadata: metadata ?? {},
    createdBy: createdBy ?? null,
    status: 'drafting',
  })

  return NextResponse.json({ success: true, id })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { deliverableId, action, reviewNote, operatorUserId, content, fileUrl } = body
  // action: 'approve' | 'reject' | 'mark_sent' | 'archive' | 'save_content'

  const deliverable = await db.query.deliverables.findFirst({
    where: eq(deliverables.id, deliverableId),
  })
  if (!deliverable) return NextResponse.json({ error: '成果物不存在' }, { status: 404 })

  if (action === 'save_content') {
    await db
      .update(deliverables)
      .set({ content: content ?? deliverable.content, updatedAt: new Date() })
      .where(eq(deliverables.id, deliverableId))
    return NextResponse.json({ success: true })
  }

  if (action === 'approve') {
    await db
      .update(deliverables)
      .set({
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: operatorUserId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(deliverables.id, deliverableId))

    // 写入正向反馈样本
    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'deliverable_approval',
      sourceObjectId: deliverableId,
      workspaceId: deliverable.workspaceId,
      originalOutputJson: { title: deliverable.title, type: deliverable.type },
      feedbackLabel: 'accepted',
      feedbackReasonCode: 'deliverable_review',
      reusableFlag: true,
    })
  } else if (action === 'reject') {
    await db
      .update(deliverables)
      .set({
        status: 'drafting',
        approvalStatus: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(deliverables.id, deliverableId))

    // 写入负向反馈样本
    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'deliverable_rejection',
      sourceObjectId: deliverableId,
      workspaceId: deliverable.workspaceId,
      originalOutputJson: { title: deliverable.title, type: deliverable.type },
      correctedOutputJson: { reviewNote: reviewNote ?? '' },
      feedbackLabel: 'rejected',
      feedbackReasonCode: 'deliverable_review',
      reusableFlag: true,
    })
  } else if (action === 'mark_sent') {
    await db
      .update(deliverables)
      .set({ status: 'sent', updatedAt: new Date() })
      .where(eq(deliverables.id, deliverableId))
  } else if (action === 'archive') {
    await db
      .update(deliverables)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(deliverables.id, deliverableId))
  } else if (action === 'update_file') {
    await db
      .update(deliverables)
      .set({ fileUrl: fileUrl ?? null, updatedAt: new Date() })
      .where(eq(deliverables.id, deliverableId))
  } else if (action === 'trigger_rpa') {
    // 触发 RPA 生成真实文件（.pptx / .docx / .xlsx）
    const rpaUrl = process.env.RPA_SERVER_URL
    if (!rpaUrl) {
      return NextResponse.json({ error: 'RPA 服务未配置，请在 .env.local 中设置 RPA_SERVER_URL=http://localhost:8001' }, { status: 400 })
    }

    // 根据成果物类型决定 RPA taskType
    let taskType = 'create_pptx'
    let taskParams: Record<string, unknown> = { deliverableId }

    const deliverableStyle = (deliverable.metadata as Record<string, unknown>)?.style as string | undefined

    if (deliverable.type === 'solution_ppt' || deliverable.type === 'scene_render') {
      taskType = 'create_pptx'
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(deliverable.content ?? '{}') } catch { /* ignore */ }
      taskParams = {
        deliverableId,
        title: deliverable.title,
        slides: (parsed.slides ?? []) as unknown[],
        companyName: '云艺化科技',
        style: deliverableStyle ?? 'tech',
      }
    } else if (
      deliverable.type === 'bid_package' ||
      deliverable.type === 'safety_proposal' ||
      deliverable.type === 'after_sales_report'
    ) {
      taskType = 'create_docx'
      taskParams = {
        deliverableId,
        title: deliverable.title,
        documentType: 'proposal',
        sections: [{ heading: deliverable.title, body: deliverable.content ?? '' }],
      }
    } else if (deliverable.type === 'quotation') {
      taskType = 'create_xlsx'
      let parsed: Record<string, unknown> = {}
      try { parsed = JSON.parse(deliverable.content ?? '{}') } catch { /* ignore */ }
      taskParams = {
        deliverableId,
        title: deliverable.title,
        customerName: (parsed.customerName as string) ?? '',
        ...parsed,
      }
    }

    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/rpa-callback`

    try {
      const rpaRes = await fetch(`${rpaUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskType, taskParams, callbackUrl }),
      })
      const rpaJson = await rpaRes.json() as { taskExecutionId?: string; status?: string; error?: string }
      if (!rpaRes.ok) {
        return NextResponse.json({ error: `RPA 服务错误：${rpaJson.error ?? rpaRes.status}` }, { status: 502 })
      }
      // 在 metadata 中记录 rpa 任务 ID
      const currentMeta = (deliverable.metadata as Record<string, unknown>) ?? {}
      await db
        .update(deliverables)
        .set({ metadata: { ...currentMeta, rpaTaskId: rpaJson.taskExecutionId, rpaStatus: 'pending' }, updatedAt: new Date() })
        .where(eq(deliverables.id, deliverableId))

      return NextResponse.json({ success: true, taskExecutionId: rpaJson.taskExecutionId })
    } catch (e) {
      return NextResponse.json({ error: `RPA 机器不可达：${String(e)}` }, { status: 502 })
    }
  } else if (action === 'reject_and_regenerate') {
    // 退回并立即按修改意见重新生成
    const revisionNote = reviewNote ?? ''
    if (!revisionNote) {
      return NextResponse.json({ error: '请填写修改意见后再重新生成' }, { status: 400 })
    }

    // 1. 原版归档
    await db
      .update(deliverables)
      .set({ status: 'archived', approvalStatus: 'rejected', updatedAt: new Date() })
      .where(eq(deliverables.id, deliverableId))

    // 2. 写负向 feedbackSample（用于训练）
    await db.insert(feedbackSamples).values({
      id: generateId(),
      sourceType: 'deliverable_rejection',
      sourceObjectId: deliverableId,
      workspaceId: deliverable.workspaceId,
      originalOutputJson: { title: deliverable.title, type: deliverable.type },
      correctedOutputJson: { reviewNote: revisionNote },
      feedbackLabel: 'rejected',
      feedbackReasonCode: 'deliverable_review',
      reusableFlag: true,
    })

    // 3. 按类型重新生成
    const newDeliverableId = await regenerateDeliverable(deliverable, revisionNote)
    return NextResponse.json({ success: true, newDeliverableId })
  }

  return NextResponse.json({ success: true })
}

// ── 按修改意见重新生成成果物 ─────────────────────────────────────────────────

async function regenerateDeliverable(
  original: typeof deliverables.$inferSelect,
  revisionNote: string
): Promise<string> {
  const previousContent = original.content ?? ''
  const previousMeta = (original.metadata as Record<string, unknown>) ?? {}
  const previousVersion = (previousMeta.version as number) ?? (original.version ?? 1)
  const style = (previousMeta.style as string) ?? 'tech'
  const newId = generateId()

  if (original.type === 'solution_ppt' || original.type === 'scene_render') {
    // 解析原版内容，修改后重写
    let previousSlides: unknown[] = []
    try { previousSlides = (JSON.parse(previousContent) as any)?.slides ?? [] } catch { /* ignore */ }

    const raw = await minimaxChat({
      system: `你是一位专业的 B2B 售前方案经理，擅长为工业安全/VR培训场景制作高质量汇报PPT。
规则：
- 每页 3-5 个 bullet，每条 15-35 字，必须具体，禁止使用"赋能"、"助力"等空话套话
- 每个 bullet 尽量包含数字、客户专有名词、或明确的行动项
- accent 字段：该页最重要的数字/指标（如"85%"、"300人/年"），可不填
- 输出纯 JSON，不加任何 Markdown 代码块包裹`,
      user: `【修改指令】请根据以下人工审批意见修改这份方案PPT，保留无问题的内容，仅修改被指出的部分：
${revisionNote}

【上一版幻灯片内容（JSON）】
${JSON.stringify(previousSlides, null, 2).slice(0, 4000)}

请输出修改后的完整PPT JSON（保持同样格式）：
{
  "title": "PPT标题",
  "slides": [
    { "page": 1, "title": "...", "bullets": ["...", "..."], "accent": "85%", "notes": "..." }
  ]
}`,
      maxTokens: 4000,
    })

    let slidesData: unknown
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      slidesData = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: original.title, slides: previousSlides }
    } catch {
      slidesData = { title: original.title, slides: previousSlides }
    }

    await db.insert(deliverables).values({
      id: newId,
      workspaceId: original.workspaceId,
      sourceActionId: original.sourceActionId,
      type: original.type,
      stage: original.stage,
      title: `${original.title.replace(/（v\d+修订）/, '')}（v${previousVersion + 1}修订）`,
      status: 'pending_review',
      content: JSON.stringify(slidesData),
      metadata: { slideCount: (slidesData as any)?.slides?.length ?? 0, style, revisionNote, version: previousVersion + 1 },
      createdBy: 'agent',
      version: previousVersion + 1,
      supersedesId: original.id,
    })

  } else if (
    original.type === 'bid_package' ||
    original.type === 'safety_proposal' ||
    original.type === 'after_sales_report'
  ) {
    const revised = await minimaxChat({
      system: '你是资深 B2B 方案文档专家，根据人工审批意见修改文档内容，保留好的部分，重点改进被指出的问题。',
      user: `【修改指令】${revisionNote}\n\n【上一版文档内容】\n${previousContent.slice(0, 5000)}\n\n请输出修改后的完整文档内容（Markdown格式）：`,
      maxTokens: 3000,
    })

    await db.insert(deliverables).values({
      id: newId,
      workspaceId: original.workspaceId,
      sourceActionId: original.sourceActionId,
      type: original.type,
      stage: original.stage,
      title: `${original.title.replace(/（v\d+修订）/, '')}（v${previousVersion + 1}修订）`,
      status: 'pending_review',
      content: revised,
      metadata: { ...previousMeta, revisionNote, version: previousVersion + 1 },
      createdBy: 'agent',
      version: previousVersion + 1,
      supersedesId: original.id,
    })

  } else if (original.type === 'quotation') {
    const revised = await minimaxChat({
      system: '你是专业的 B2B 销售报价专员，根据人工意见调整报价单内容，输出纯 JSON。',
      user: `【修改指令】${revisionNote}\n\n【上一版报价单内容（JSON）】\n${previousContent.slice(0, 3000)}\n\n请输出修改后的报价单 JSON：`,
      maxTokens: 2000,
    })

    let content = revised
    try { content = JSON.stringify(JSON.parse(revised)) } catch { /* keep raw */ }

    await db.insert(deliverables).values({
      id: newId,
      workspaceId: original.workspaceId,
      sourceActionId: original.sourceActionId,
      type: original.type,
      stage: original.stage,
      title: `${original.title.replace(/（v\d+修订）/, '')}（v${previousVersion + 1}修订）`,
      status: 'pending_review',
      content,
      metadata: { ...previousMeta, revisionNote, version: previousVersion + 1 },
      createdBy: 'agent',
      version: previousVersion + 1,
      supersedesId: original.id,
    })

  } else {
    // 通用兜底：用 MiniMax 修改原始文本
    const revised = await minimaxChat({
      system: '你是专业的 B2B 业务助手，根据人工审批意见修改文档内容。',
      user: `【修改指令】${revisionNote}\n\n【上一版内容】\n${previousContent.slice(0, 4000)}\n\n请输出修改后的完整内容：`,
      maxTokens: 2500,
    })

    await db.insert(deliverables).values({
      id: newId,
      workspaceId: original.workspaceId,
      sourceActionId: original.sourceActionId,
      type: original.type,
      stage: original.stage,
      title: `${original.title.replace(/（v\d+修订）/, '')}（v${previousVersion + 1}修订）`,
      status: 'pending_review',
      content: revised,
      metadata: { ...previousMeta, revisionNote, version: previousVersion + 1 },
      createdBy: 'agent',
      version: previousVersion + 1,
      supersedesId: original.id,
    })
  }

  return newId
}
