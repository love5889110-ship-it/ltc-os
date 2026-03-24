/**
 * Background auto-sync scheduler for Get笔记 connectors.
 * Started once at server boot via src/instrumentation.ts.
 * Reads sync interval from DB settings, re-checks every minute to pick up config changes.
 */
import { getAISettings } from '@/lib/ai-settings'
import { db } from '@/db'
import { connectorInstances } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { syncGetNote } from '@/lib/connectors/get-note'

let schedulerStarted = false
let lastSyncTime = 0

export function startAutoSyncScheduler() {
  if (schedulerStarted) return
  schedulerStarted = true

  console.log('[AutoSync] Scheduler started')

  // Check every minute whether it's time to sync
  setInterval(async () => {
    try {
      const settings = await getAISettings()
      if (!settings.getNoteAutoSync) return

      const intervalMs = (settings.getNoteAutoSyncInterval ?? 30) * 60 * 1000
      const now = Date.now()
      if (now - lastSyncTime < intervalMs) return

      lastSyncTime = now
      console.log('[AutoSync] Starting scheduled Get笔记 sync...')

      const connectors = await db.query.connectorInstances.findMany({
        where: (c, { and }) => and(
          eq(c.connectorType, 'get_note'),
          eq(c.enabled, true)
        ),
      })

      for (const connector of connectors) {
        try {
          const result = await syncGetNote(connector.id)
          if (result.synced > 0) {
            console.log(`[AutoSync] ${connector.connectorName}: +${result.synced} 条新信号`)
          }
        } catch (e) {
          console.error(`[AutoSync] ${connector.connectorName} 同步失败:`, e)
        }
      }
    } catch (e) {
      console.error('[AutoSync] Scheduler error:', e)
    }
  }, 60 * 1000) // tick every 1 minute
}
