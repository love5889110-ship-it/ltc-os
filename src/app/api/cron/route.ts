/**
 * Vercel Cron Job 入口
 * 在 vercel.json 中配置：
 * {
 *   "crons": [
 *     { "path": "/api/cron", "schedule": "0 1 * * *" }  // 每天凌晨 1 点
 *   ]
 * }
 *
 * 本地测试：curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3001/api/cron
 */
import { NextRequest, NextResponse } from 'next/server'
import { runDailyReview, retryFailedActions, generateRuleSuggestions } from '@/lib/orchestrator'

export async function GET(req: NextRequest) {
  // 验证来源：Vercel Cron 会附带 Authorization header，本地测试用 CRON_SECRET
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  try {
    // 1. 每日巡检：超 2 天无动作的商机触发 coordinator
    results.dailyReview = await runDailyReview(2)
  } catch (err) {
    results.dailyReviewError = String(err)
    console.error('[cron] dailyReview failed:', err)
  }

  try {
    // 2. 失败动作重试（retryCount < 3，failedAt 超 5 分钟）
    results.failedRetry = await retryFailedActions()
  } catch (err) {
    results.failedRetryError = String(err)
    console.error('[cron] failedRetry failed:', err)
  }

  try {
    // 3. 规则候选自动提炼（扫描近 7 天 modified/rejected 样本）
    results.ruleSuggestions = await generateRuleSuggestions(7)
  } catch (err) {
    results.ruleSuggestionsError = String(err)
    console.error('[cron] generateRuleSuggestions failed:', err)
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  })
}
