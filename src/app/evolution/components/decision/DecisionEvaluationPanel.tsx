'use client'

import type { DecisionEvaluation, DecisionResult } from '../../types'
import { formatRelativeTime } from '@/lib/utils'

interface Props {
  evaluations: DecisionEvaluation[]
  decisionResults: DecisionResult[]
}

const SCORE_DIMENSIONS = [
  { key: 'taskRecognitionScore' as const,     label: '任务识别' },
  { key: 'ruleMatchScore' as const,           label: '规则命中' },
  { key: 'actionRecommendationScore' as const, label: '动作推荐' },
  { key: 'skillRoutingScore' as const,        label: '技能路由' },
  { key: 'riskAssessmentScore' as const,      label: '风险判断' },
]

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  const textColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-16 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-mono w-8 text-right flex-shrink-0 ${textColor}`}>{score}</span>
    </div>
  )
}

export function DecisionEvaluationPanel({ evaluations, decisionResults }: Props) {
  if (evaluations.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-slate-600">暂无评测数据</p>
        <p className="text-xs text-slate-700 mt-1">评测系统将在 Agent 运行后自动生成评分</p>
      </div>
    )
  }

  const avgScores = SCORE_DIMENSIONS.reduce((acc, dim) => {
    const avg = evaluations.reduce((s, e) => s + e[dim.key], 0) / evaluations.length
    acc[dim.key] = Math.round(avg)
    return acc
  }, {} as Record<typeof SCORE_DIMENSIONS[number]['key'], number>)

  const avgOverall = Math.round(
    evaluations.reduce((s, e) => s + e.overallScore, 0) / evaluations.length
  )

  const overallColor = avgOverall >= 80 ? 'text-green-400' : avgOverall >= 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="space-y-4">
      {/* 汇总卡 */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate-300">综合评测（{evaluations.length} 次）</p>
          <span className={`text-3xl font-black font-mono ${overallColor}`}>{avgOverall}</span>
        </div>
        <div className="space-y-2">
          {SCORE_DIMENSIONS.map((dim) => (
            <ScoreBar key={dim.key} score={avgScores[dim.key]} label={dim.label} />
          ))}
        </div>
      </div>

      {/* 单次评测记录 */}
      <div>
        <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono mb-2">最近评测记录</p>
        <div className="space-y-2">
          {evaluations.map((ev) => {
            const dr = decisionResults.find((r) => r.id === ev.decisionId)
            const overall = ev.overallScore
            const c = overall >= 80 ? 'text-green-400' : overall >= 60 ? 'text-yellow-400' : 'text-red-400'
            return (
              <div key={ev.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                <span className={`text-xl font-black font-mono ${c} w-10 flex-shrink-0`}>{overall}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 truncate">
                    {dr?.recognizedGoal ?? ev.decisionId}
                  </p>
                  <div className="flex gap-2 mt-1">
                    {SCORE_DIMENSIONS.map((dim) => (
                      <span key={dim.key} className="text-[9px] text-slate-600 font-mono">
                        {dim.label.slice(0, 2)}:{ev[dim.key]}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-[9px] text-slate-600 flex-shrink-0">
                  {formatRelativeTime(ev.reviewedAt)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
