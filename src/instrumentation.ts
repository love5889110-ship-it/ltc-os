/**
 * Next.js instrumentation hook — runs once when the server starts (Node.js runtime only).
 * Used to start the background auto-sync timer for Get笔记 connectors.
 */
import { startAutoSyncScheduler } from './lib/auto-sync-scheduler'

export async function register() {
  // Only run in Node.js (not Edge runtime, not during build)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  startAutoSyncScheduler()
}
