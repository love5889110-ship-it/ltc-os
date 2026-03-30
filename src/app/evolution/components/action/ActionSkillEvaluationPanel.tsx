'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react'
import type { SkillEvaluation, SkillExecutionLog } from '../../types'
import { computeSkillEvaluation } from '../../services'

interface Props {
  skillId: string
  executionLogs: SkillExecutionLog[]
}

function ScoreBar({ value, max = 100, colorClass }: { value: number; max?: number; colorClass: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ActionSkillEvaluationPanel({ skillId, executionLogs }: Props) {
  const skillLogs = useMemo(
    () => executionLogs.filter((l) => l.skillId === skillId),
    [executionLogs, skillId]
  )

  const evaluation: SkillEvaluation | null = useMemo(
    () => (skillLogs.length > 0 ? computeSkillEvaluation(skillId, skillLogs) : null),
    [skillId, skillLogs]
  )

  if (skillLogs.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600">
        <p className="text-sm">暂无评测数据</p>
        <p className="text-xs mt-1">运行调试或批量运行样例后自动生成评测报告</p>
      </div>
    )
  }

  if (!evaluation) return null

  const successRate = evaluation.successRate * 100
  const failureRate = evaluation.failureRate * 100

  return (
    <div className="space-y-4">
      {/* 核心指标卡 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">成功率</p>
          </div>
          <p className={`text-xl font-bold tabular-nums ${
            successRate >= 80 ? 'text-green-400' : successRate >= 50 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {successRate.toFixed(1)}%
          </p>
          <ScoreBar
            value={successRate}
            colorClass={successRate >= 80 ? 'bg-green-500' : successRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
          />
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">失败率</p>
          </div>
          <p className={`text-xl font-bold tabular-nums ${failureRate > 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {failureRate.toFixed(1)}%
          </p>
          <ScoreBar
            value={failureRate}
            colorClass="bg-red-500"
          />
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">平均耗时</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-slate-300">
            {evaluation.avgDurationMs < 1000
              ? `${Math.round(evaluation.avgDurationMs)}ms`
              : `${(evaluation.avgDurationMs / 1000).toFixed(1)}s`
            }
          </p>
          <div className="h-1.5 bg-slate-800 rounded-full mt-1" />
        </div>
      </div>

      {/* 样本量说明 */}
      <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
        <span>基于 {skillLogs.length} 次执行</span>
        <span>最近更新：{new Date(evaluation.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* 错误分布 */}
      {evaluation.errorDistribution.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <p className="text-[10px] text-slate-400 font-semibold">错误分布</p>
          </div>
          <div className="space-y-1.5">
            {evaluation.errorDistribution.map(({ errorType, count }) => {
              const pct = (count / skillLogs.filter((l) => l.status === 'failed').length) * 100
              return (
                <div key={errorType} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] text-slate-400 font-mono truncate">{errorType}</span>
                      <span className="text-[9px] text-slate-600 flex-shrink-0 ml-2">{count} 次 ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-600/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 近期执行时间趋势（迷你图） */}
      {skillLogs.length >= 3 && (
        <div>
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2">近期耗时趋势</p>
          <div className="flex items-end gap-0.5 h-10">
            {skillLogs.slice(-20).map((log, i) => {
              const maxDur = Math.max(...skillLogs.slice(-20).map((l) => l.durationMs))
              const height = maxDur > 0 ? Math.max(8, (log.durationMs / maxDur) * 100) : 20
              return (
                <div
                  key={log.id}
                  title={`${log.durationMs}ms — ${log.status}`}
                  className={`flex-1 rounded-sm transition-colors ${
                    log.status === 'success' ? 'bg-green-500/60' : 'bg-red-500/60'
                  }`}
                  style={{ height: `${height}%` }}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[8px] text-slate-700 mt-0.5">
            <span>早</span>
            <span>近</span>
          </div>
        </div>
      )}
    </div>
  )
}
