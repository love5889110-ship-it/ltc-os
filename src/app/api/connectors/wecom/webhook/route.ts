/**
 * 企业微信群机器人 / 应用消息 Webhook 接收端点
 *
 * 支持两种接入方式：
 *
 * 方式A：企业微信群机器人（简单，只能收到 @机器人 的消息）
 *   - 在群里添加机器人，Webhook URL 填本端点
 *   - 无需验证，但只收到 @机器人 的消息
 *
 * 方式B：企业微信应用（完整，可接收所有群消息）
 *   - 创建企业自建应用，配置消息接收 URL
 *   - 需要 Token + EncodingAESKey 验证
 *
 * 配置步骤：
 * 1. 登录企业微信管理后台 → 应用管理 → 创建应用
 * 2. 配置接收消息：URL = https://your-domain/api/connectors/wecom/webhook
 * 3. 将 Token / EncodingAESKey / CorpID 填入系统设置
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ingestSignal } from '@/lib/signal-processor'
import { createHash } from 'crypto'

/**
 * 验证企业微信消息签名
 * signature = sha1(sort([token, timestamp, nonce, msg_encrypt]).join(''))
 */
function verifyWeComSignature(
  token: string,
  timestamp: string,
  nonce: string,
  signature: string
): boolean {
  const arr = [token, timestamp, nonce].sort()
  const str = arr.join('')
  const expected = createHash('sha1').update(str).digest('hex')
  return expected === signature
}

// GET: URL verification when first configuring in WeCom admin
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const msgSignature = searchParams.get('msg_signature') ?? ''
  const timestamp = searchParams.get('timestamp') ?? ''
  const nonce = searchParams.get('nonce') ?? ''
  const echostr = searchParams.get('echostr') ?? ''

  const connector = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'wecom'),
  })
  const config = connector?.configJson as { token?: string } | null

  if (config?.token) {
    const arr = [config.token, timestamp, nonce].sort()
    const signature = createHash('sha1').update(arr.join('')).digest('hex')
    if (signature !== msgSignature) {
      return new NextResponse('验证失败', { status: 403 })
    }
  }

  // Return echostr to complete verification
  return new NextResponse(echostr, { status: 200 })
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const timestamp = searchParams.get('timestamp') ?? ''
    const nonce = searchParams.get('nonce') ?? ''
    const msgSignature = searchParams.get('msg_signature') ?? ''

    const connector = await db.query.connectorInstances.findFirst({
      where: eq(connectorInstances.connectorType, 'wecom'),
    })
    const config = connector?.configJson as {
      token?: string
      chatIds?: string[]
      chatNames?: string[]
    } | null

    // Signature verification
    if (config?.token && timestamp && nonce && msgSignature) {
      if (!verifyWeComSignature(config.token, timestamp, nonce, msgSignature)) {
        return new NextResponse('签名验证失败', { status: 401 })
      }
    }

    const body = await req.json()

    // Filter by group whitelist if configured
    const chatId = body.ChatId ?? body.GroupId ?? ''
    if (config?.chatIds?.length && chatId) {
      if (!config.chatIds.includes(chatId)) {
        return NextResponse.json({ errcode: 0 })
      }
    }

    const msgType = body.MsgType ?? body.msgtype
    const senderName = body.From?.Name ?? body.sender_id ?? '未知成员'
    const groupName = body.ChatName ?? body.group_name ?? config?.chatNames?.[0] ?? '企业微信群'

    let rawText = ''
    if (msgType === 'text') {
      rawText = body.Text?.Content ?? body.content ?? ''
    } else if (msgType === 'mixed') {
      rawText = (body.Mixed?.MixedItems ?? [])
        .filter((item: any) => item.Type === 'Text')
        .map((item: any) => item.Content ?? '')
        .join('')
    } else {
      return NextResponse.json({ errcode: 0 })
    }

    rawText = rawText.trim()
    if (rawText.length < 10) {
      return NextResponse.json({ errcode: 0 })
    }

    const enrichedContent = `【企业微信群：${groupName}】${senderName}：\n${rawText}`
    const msgId = body.MsgId ?? body.msg_id ?? `${body.From?.UserId}_${Date.now()}`

    await ingestSignal({
      sourceType: 'wecom',
      sourceInstanceId: connector?.id,
      externalEventId: `wecom_${msgId}`,
      rawContent: enrichedContent,
      eventTime: body.CreateTime ? new Date(Number(body.CreateTime) * 1000) : new Date(),
    })

    return NextResponse.json({ errcode: 0, errmsg: 'ok' })
  } catch (err) {
    console.error('[WeCom Webhook] Error:', err)
    return NextResponse.json({ errcode: 0 })
  }
}
