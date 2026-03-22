import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { db } from '../src/db'
import { connectorInstances } from '../src/db/schema'
import { eq } from 'drizzle-orm'

const apiKey = 'gk_live_fbb9cfe3e21a5841.dcb039b059977608eb2d6e9caabdf8cd932071ee1da698c1'
const clientId = 'cli_3802f9db08b811f197679c63c078bacc'

async function main() {
  const existing = await db.query.connectorInstances.findFirst({
    where: eq(connectorInstances.connectorType, 'get_note'),
  })
  console.log('existing:', existing?.id, existing?.authStatus)

  if (existing) {
    await db.update(connectorInstances).set({
      configJson: { apiKey, clientId },
      authStatus: 'authorized',
      healthStatus: 'healthy',
      enabled: true,
      updatedAt: new Date(),
    }).where(eq(connectorInstances.id, existing.id))
    console.log('✅ 已更新 Get 笔记连接器配置')
  } else {
    console.log('❌ 未找到 get_note 连接器记录，请先跑 seed')
  }
}

main().catch(console.error).finally(() => process.exit(0))
