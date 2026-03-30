'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Bot } from 'lucide-react'
import type { EffectTrackingStats } from '../../types'
import { getEffectTrackingStats } from '../../services'
import { AGENT_LABELS } from '@/lib/utils'

export function EffectTrackingPanel() {
  const [stats, setStats] = useState<EffectTrackingStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEffectTrackingStats('decision').then((s) => {
      setStats(s)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-slate-600 text-sm">加载中...</div>
  }

  if (!stats) {
    return <div className="text-center py-10 text-slate-600 text-sm">暂无效果数据</div>
  }

  const acceptPct = Math.round(stats.acceptRate * 100)
  const acceptColor = acceptPct >= 70 ? 'text-green-400' : acceptPct >= 40 ? 'text-yellow-400' : 'text-red-400'
  const acceptBarColor = acceptPct >= 70 ? 'bg-green-500' : acceptPct >= 40 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-4">
      {/* 总览 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 mb-1">总运行次数</p>
          <p className="text-2xl font-black font-mono text-white">{stats.totalRuns}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 mb-1">建议采纳率</p>
          <p className={`text-2xl font-black font-mono ${acceptColor}`}>{acceptPct}%</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 mb-1">平均决策/次</p>
          <p className="text-2xl font-black font-mono text-cyan-400">{stats.avgDecisionsPerRun.toFixed(1)}</p>
        </div>
      </div>

      {/* 数字员工效率 */}
      {stats.topAgents.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Bot className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-xs font-semibold text-slate-300">数字员工采纳率</p>
          </div>
          <div className="space-y-2.5">
            {stats.topAgents.map((a) => {
              const pct = Math.round(a.acceptRate * 100)
              const barColor = pct >= 70 ? 'bg-blue-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'
              const label = (AGENT_LABELS as Record<string, string>)[a.agentType] ?? a.agentLabel ?? a.agentType
              return (
                <div key={a.agentType} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-20 truncate flex-shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right flex-shrink-0">{pct}%</span>
                  <span className="text-[9px] text-slate-600 w-12 text-right flex-shrink-0">{a.totalRuns}次运行</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {stats.topAgents.length === 0 && (
        <div className="text-center py-6 text-slate-600 text-xs">
          暂无数字员工运行数据
        </div>
      )}
    </div>
  )
}
