/**
 * 钉钉 Stream 模式客户端 — 本地开发用
 *
 * 特点：通过长连接从钉钉服务器主动拉取消息，无需公网 IP
 * 适用：本地 localhost 开发/测试
 * 生产：建议改用 Webhook 模式（配置在系统设置中）
 *
 * 使用方式：
 *   cd /Users/zhangyang/ltc-os
 *   DINGTALK_APP_KEY=xxx DINGTALK_APP_SECRET=xxx npx tsx scripts/dingtalk-stream.ts
 *
 * 或者在 .env.local 中添加：
 *   DINGTALK_APP_KEY=your_app_key
 *   DINGTALK_APP_SECRET=your_app_secret
 *   DINGTALK_GROUP_IDS=groupId1,groupId2  (可选，白名单群)
 *   LTC_API_URL=http://localhost:3001       (LTC系统地址)
 */

import 'dotenv/config'

const APP_KEY = process.env.DINGTALK_APP_KEY
const APP_SECRET = process.env.DINGTALK_APP_SECRET
const GROUP_IDS = process.env.DINGTALK_GROUP_IDS?.split(',').filter(Boolean) ?? []
const LTC_API = process.env.LTC_API_URL ?? 'http://localhost:3001'

if (!APP_KEY || !APP_SECRET) {
  console.error('[DingTalk Stream] 缺少 DINGTALK_APP_KEY 或 DINGTALK_APP_SECRET')
  process.exit(1)
}

/**
 * 获取钉钉 Access Token
 */
async function getAccessToken(): Promise<string> {
  const res = await fetch('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey: APP_KEY, appSecret: APP_SECRET }),
  })
  const data = await res.json() as { accessToken?: string; errmsg?: string }
  if (!data.accessToken) throw new Error(`获取Token失败: ${data.errmsg}`)
  console.log('[DingTalk Stream] Access Token 获取成功')
  return data.accessToken
}

/**
 * 获取 Stream 连接端点
 */
async function getStreamEndpoint(accessToken: string): Promise<{
  endpoint: string
  ticket: string
}> {
  const res = await fetch('https://api.dingtalk.com/v1.0/gateway/connections/open', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-acs-dingtalk-access-token': accessToken,
    },
    body: JSON.stringify({
      clientId: APP_KEY,
      clientSecret: APP_SECRET,
      subscriptions: [
        { type: 'EVENT', topic: 'chat_update_title' },
        { type: 'CALLBACK', topic: '/v1.0/im/bot/messages/getCustomizedMessage' },
      ],
      ua: 'ltc-os/1.0',
      localIp: '127.0.0.1',
    }),
  })
  const data = await res.json() as { endpoint?: string; ticket?: string; errmsg?: string }
  if (!data.endpoint) throw new Error(`获取Stream端点失败: ${JSON.stringify(data)}`)
  return { endpoint: data.endpoint, ticket: data.ticket! }
}

/**
 * 将消息推送到 LTC 系统
 */
async function ingestToLTC(params: {
  groupName: string
  senderName: string
  content: string
  msgId: string
  conversationId?: string
  timestamp?: number
}) {
  // Filter by group whitelist
  if (GROUP_IDS.length && params.conversationId) {
    if (!GROUP_IDS.includes(params.conversationId)) {
      console.log(`[DingTalk Stream] 跳过非白名单群: ${params.conversationId}`)
      return
    }
  }

  if (params.content.trim().length < 10) return

  const enrichedContent = `【钉钉群：${params.groupName}】${params.senderName}：\n${params.content.trim()}`

  try {
    const res = await fetch(`${LTC_API}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'dingtalk',
        externalEventId: `dingtalk_${params.msgId}`,
        rawContent: enrichedContent,
        eventTime: params.timestamp ? new Date(params.timestamp).toISOString() : undefined,
      }),
    })
    if (res.ok) {
      console.log(`[DingTalk Stream] 信号已录入: ${enrichedContent.slice(0, 60)}...`)
    } else {
      console.error('[DingTalk Stream] 录入失败:', await res.text())
    }
  } catch (e) {
    console.error('[DingTalk Stream] 网络错误:', e)
  }
}

/**
 * 解析并处理消息
 */
function handleMessage(payload: any) {
  const headers = payload.headers ?? {}
  const body = typeof payload.data === 'string' ? JSON.parse(payload.data) : (payload.data ?? {})

  // Only handle group messages
  const conversationType = body.conversationType ?? headers.conversationType
  if (conversationType !== '2') return // 2 = group chat

  const msgType = body.msgtype ?? body.messageType
  let content = ''

  if (msgType === 'text') {
    content = body.text?.content ?? body.content ?? ''
  } else if (msgType === 'richText') {
    content = (body.richText?.paragraphs ?? [])
      .flatMap((p: any) => p.elements ?? [])
      .map((el: any) => el.textRun?.text ?? '')
      .join('')
  } else {
    return // Skip non-text messages
  }

  ingestToLTC({
    groupName: body.conversationTitle ?? body.chatTitle ?? '群聊',
    senderName: body.senderNick ?? body.senderId ?? '成员',
    content,
    msgId: body.msgId ?? body.messageId ?? `${Date.now()}`,
    conversationId: body.conversationId ?? body.chatId,
    timestamp: body.createAt ? Number(body.createAt) : Date.now(),
  })
}

/**
 * 建立 WebSocket Stream 连接
 */
async function connectStream() {
  const accessToken = await getAccessToken()
  const { endpoint, ticket } = await getStreamEndpoint(accessToken)

  const wsUrl = `${endpoint}?ticket=${encodeURIComponent(ticket)}`
  console.log(`[DingTalk Stream] 连接到: ${endpoint}`)

  // Use native WebSocket (Node.js 22+ has built-in WS) or dynamic import of 'ws'
  let ws: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const wsModule = require('ws')
    const WS = wsModule.WebSocket ?? wsModule.default ?? wsModule
    ws = new WS(wsUrl)
  } catch {
    // Fallback to global WebSocket if 'ws' package not installed
    ws = new (globalThis as any).WebSocket(wsUrl)
  }

  ws.on('open', () => {
    console.log('[DingTalk Stream] 连接已建立，等待群消息...')
    if (GROUP_IDS.length) {
      console.log(`[DingTalk Stream] 监听群白名单: ${GROUP_IDS.join(', ')}`)
    } else {
      console.log('[DingTalk Stream] 监听所有群消息（建议配置 DINGTALK_GROUP_IDS 白名单）')
    }
  })

  ws.on('message', (data: any) => {
    try {
      const payload = JSON.parse(data.toString())
      const type = payload.type ?? payload.headers?.eventType

      // Respond to ping/keepalive
      if (type === 'SYSTEM' || type === 'ping') {
        ws.send(JSON.stringify({
          code: 200,
          headers: payload.headers,
          message: 'OK',
          data: payload.data,
        }))
        return
      }

      // Handle bot messages and group events
      if (type === 'CALLBACK' || type === 'bot_message' || type === 'MESSAGE') {
        handleMessage(payload)
        // Ack the message
        ws.send(JSON.stringify({
          code: 200,
          headers: payload.headers,
          message: 'OK',
          data: '',
        }))
      }
    } catch (e) {
      console.error('[DingTalk Stream] 消息解析错误:', e)
    }
  })

  ws.on('error', (err: any) => {
    console.error('[DingTalk Stream] 连接错误:', err.message)
  })

  ws.on('close', (code: number) => {
    console.log(`[DingTalk Stream] 连接断开 (code: ${code})，5秒后重连...`)
    setTimeout(connectStream, 5000)
  })
}

// Start
connectStream().catch((err) => {
  console.error('[DingTalk Stream] 启动失败:', err)
  process.exit(1)
})
