/**
 * 钉钉群机器人 Webhook 接收端点
 *
 * 配置方式：
 * 1. 在钉钉开放平台创建企业内部应用 → 机器人
 * 2. 设置消息接收 URL 为 https://your-domain/api/connectors/dingtalk/webhook
 * 3. 将 AppKey / AppSecret 配置到系统设置中
 * 4. 将机器人添加到目标群，成员 @ 机器人后消息将推送到此端点
 *
 * 本地开发（无公网IP）请使用 Stream 模式：
 *   npx tsx scripts/dingtalk-stream.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ingestSignal } from '@/lib/signal-processor'
import { createHmac } from 'crypto'

/**
 * 验证钉钉签名
 * 钉钉通过 timestamp + sign headers 验证请求合法性
 */
function verifyDingTalkSignature(
  appSecret: string,
  timestamp: string,
  sign: string
): boolean {
  const stringToSign = `${timestamp}\n${appSecret}`
  const hmac = createHmac('sha256', appSecret)
  hmac.update(stringToSign)
  const expectedSign = hmac.digest('base64')
  return expectedSign === sign
}

export async function POST(req: NextRequest) {
  try {
    const timestamp = req.headers.get('timestamp') ?? ''
    const sign = req.headers.get('sign') ?? ''
    const body = await req.json()

    // Find the active dingtalk connector
    const connector = await db.query.connectorInstances.findFirst({
      where: eq(connectorInstances.connectorType, 'dingtalk'),
    })

    if (connector?.configJson) {
      const config = connector.configJson as { appSecret?: string; groupIds?: string[] }
      // Verify signature if appSecret is configured
      if (config.appSecret && timestamp && sign) {
        if (!verifyDingTalkSignature(config.appSecret, timestamp, sign)) {
          return NextResponse.json({ error: '签名验证失败' }, { status: 401 })
        }
      }
      // Filter by group if groupIds whitelist is set
      const conversationId = body.conversationId ?? body.chatId ?? ''
      if (config.groupIds?.length && conversationId) {
        if (!config.groupIds.includes(conversationId)) {
          // Not from a whitelisted group — ignore silently
          return NextResponse.json({ msgtype: 'empty' })
        }
      }
    }

    // Extract message content
    const msgType = body.msgtype ?? body.messageType
    const senderName = body.senderNick ?? body.senderId ?? '未知成员'
    const groupName = body.conversationTitle ?? body.chatTitle ?? '群消息'

    let rawText = ''
    if (msgType === 'text') {
      rawText = body.text?.content ?? body.content ?? ''
    } else if (msgType === 'markdown') {
      rawText = body.markdown?.text ?? body.content ?? ''
    } else if (msgType === 'richText') {
      rawText = (body.richText?.paragraphs ?? [])
        .flatMap((p: any) => p.elements ?? [])
        .map((el: any) => el.textRun?.text ?? '')
        .join('')
    } else {
      // Unsupported message type (image, file, etc.) — skip
      return NextResponse.json({ msgtype: 'empty' })
    }

    rawText = rawText.trim()
    if (rawText.length < 10) {
      return NextResponse.json({ msgtype: 'empty' })
    }

    // Build enriched content for AI processing
    const enrichedContent = `【钉钉群：${groupName}】${senderName}：\n${rawText}`
    const msgId = body.msgId ?? body.messageId ?? `${body.senderStaffId}_${Date.now()}`

    await ingestSignal({
      sourceType: 'dingtalk',
      sourceInstanceId: connector?.id,
      externalEventId: `dingtalk_${msgId}`,
      rawContent: enrichedContent,
      eventTime: body.createAt ? new Date(Number(body.createAt)) : new Date(),
    })

    // DingTalk expects a response — send empty to avoid bot reply in group
    return NextResponse.json({ msgtype: 'empty' })
  } catch (err) {
    console.error('[DingTalk Webhook] Error:', err)
    return NextResponse.json({ msgtype: 'empty' })
  }
}
