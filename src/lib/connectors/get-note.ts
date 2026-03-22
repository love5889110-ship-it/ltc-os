/**
 * Get笔记连接器
 * 通过 OpenAPI 拉取录音笔记，转为信号事件
 */
import { db } from '@/db'
import { connectorInstances, signalEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ingestSignal } from '@/lib/signal-processor'

const BASE_URL = 'https://openapi.biji.com/open/api/v1'

interface GetNoteItem {
  note_id: string
  title: string
  content: string
  note_type: 'audio' | 'class_audio' | string
  tags: Array<{ id: string; name: string; type: string }>
  created_at: string
  updated_at: string
}

interface GetNoteListResponse {
  success: boolean
  data: {
    notes: GetNoteItem[]
    has_more: boolean
    next_cursor: number | string
    total: number
  }
}

async function fetchNotes(
  apiKey: string,
  clientId: string,
  sinceId: string | number = 0
): Promise<GetNoteListResponse> {
  const res = await fetch(
    `${BASE_URL}/resource/note/list?since_id=${sinceId}`,
    {
      headers: {
        Authorization: apiKey,
        'X-Client-ID': clientId,
      },
    }
  )
  if (!res.ok) throw new Error(`Get笔记 API 错误: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function syncGetNote(connectorId: string): Promise<{
  synced: number
  skipped: number
  errors: number
  newCursor: string | null
}> {
  const connector = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.id, connectorId),
  })
  if (!connector) throw new Error(`连接器 ${connectorId} 不存在`)
  if (!connector.enabled) return { synced: 0, skipped: 0, errors: 0, newCursor: null }

  const config = connector.configJson as { apiKey?: string; clientId?: string }
  const apiKey = config.apiKey
  const clientId = config.clientId
  if (!apiKey || !clientId) throw new Error('Get笔记连接器未配置 apiKey / clientId')

  // Use stored cursor (note ID) as since_id for incremental sync
  const sinceId = connector.cursorToken ?? '0'

  let synced = 0
  let skipped = 0
  let errors = 0
  let newCursor: string | null = null
  let latestNoteId: string | null = null

  try {
    const result = await fetchNotes(apiKey, clientId, sinceId)
    const notes = result.data.notes

    if (notes.length === 0) {
      await db.update(connectorInstances)
        .set({ lastSyncAt: new Date(), healthStatus: 'healthy' })
        .where(eq(connectorInstances.id, connectorId))
      return { synced: 0, skipped: 0, errors: 0, newCursor: null }
    }

    // Track the newest note's ID as next cursor
    latestNoteId = notes[0].note_id

    for (const note of notes) {
      // Skip notes with no meaningful content
      const rawContent = note.content?.trim()
      if (!rawContent || rawContent.length < 20) {
        skipped++
        continue
      }

      // Check dedup by externalEventId
      const existing = await db.query.signalEvents.findFirst({
        where: eq(signalEvents.externalEventId, `getnote_${note.note_id}`),
      })
      if (existing) {
        skipped++
        continue
      }

      try {
        await ingestSignal({
          sourceType: 'get_note',
          sourceInstanceId: connectorId,
          externalEventId: `getnote_${note.note_id}`,
          rawContent: buildRawContent(note),
          eventTime: new Date(note.created_at),
        })
        synced++
      } catch (e) {
        console.error(`[GetNote] 处理笔记 ${note.note_id} 失败:`, e)
        errors++
      }
    }

    // Update cursor to newest note ID seen
    newCursor = latestNoteId
    await db.update(connectorInstances)
      .set({
        lastSyncAt: new Date(),
        healthStatus: errors > synced ? 'degraded' : 'healthy',
        authStatus: 'authorized',
        cursorToken: latestNoteId ?? connector.cursorToken,
        updatedAt: new Date(),
      })
      .where(eq(connectorInstances.id, connectorId))

  } catch (e) {
    await db.update(connectorInstances)
      .set({ healthStatus: 'down', updatedAt: new Date() })
      .where(eq(connectorInstances.id, connectorId))
    throw e
  }

  return { synced, skipped, errors, newCursor }
}

/**
 * Build a clean text for signal processing from a Get笔记 note
 * Strips markdown headings/bullets but keeps the substance
 */
function buildRawContent(note: GetNoteItem): string {
  const parts: string[] = []

  if (note.title && note.title !== '空白语音记录') {
    parts.push(`【录音标题】${note.title}`)
  }

  // Extract meaningful content from the AI summary markdown
  const content = note.content
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold markers but keep text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Remove timestamp links like [15:48:50](https://...)
    .replace(/\[\d+:\d+:\d+\]\(https?:\/\/[^)]+\)/g, '')
    // Remove empty lines
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .join('\n')

  parts.push(content)

  const tagNames = note.tags
    .filter((t) => t.type !== 'system')
    .map((t) => t.name)
  if (tagNames.length > 0) {
    parts.push(`【标签】${tagNames.join('、')}`)
  }

  return parts.join('\n\n')
}
