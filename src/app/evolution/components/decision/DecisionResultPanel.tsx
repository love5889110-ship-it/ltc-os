'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import type { DecisionResult, ActionSkill } from '../../types'
import { formatRelativeTime } from '@/lib/utils'

interface Props {
  results: DecisionResult[]
  actionSkills: ActionSkill[]
  onSkillHighlight?: (skillIds: string[]) => void
}

const riskColors: Record<string, string> = {
  low:    'text-green-400 bg-green-900/30 border-green-800/60',
  medium: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/60',
  high:   'text-red-400 bg-red-900/30 border-red-800/60',
}
const riskLabels: Record<string, string> = { low: '低风险', medium: '中风险', high: '高风险' }

const taskTypeLabels: Record<string, string> = {
  task_understanding:    '任务理解',
  rule_match:            '规则命中',
  action_recommendation: '动作推荐',
  skill_routing:         '技能路由',
  risk_assessment:       '风险判断',
}

export function DecisionResultPanel({ results, actionSkills, onSkillHighlight }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const getSkillName = (skillId: string) =>
    actionSkills.find((s) => s.id === skillId)?.name ?? skillId

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono">{results.length} 条决策记录</p>

      {results.length === 0 && (
        <p className="text-sm text-slate-600 text-center py-8">暂无决策结果记录</p>
      )}

      {results.map((r) => (
        <div
          key={r.id}
          className="bg-slate-800/50 border border-slate-700/80 rounded-xl overflow-hidden"
        >
          <button
            className="w-full text-left p-3 hover:bg-slate-800 transition-colors"
            onClick={() => {
              setExpanded(expanded === r.id ? null : r.id)
              if (r.recommendedSkillIds?.length) {
                onSkillHighlight?.(r.recommendedSkillIds)
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                    {taskTypeLabels[r.taskType] ?? r.taskType}
                  </span>
                  {r.stage && (
                    <span className="text-[9px] text-slate-500">{r.stage}</span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${riskColors[r.riskLevel]}`}>
                    {riskLabels[r.riskLevel]}
                  </span>
                  {r.requiresHumanReview && (
                    <span className="text-[9px] bg-orange-900/40 text-orange-400 border border-orange-800/60 px-1.5 py-0.5 rounded">
                      需人工审核
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-snug">{r.recognizedGoal}</p>
                <p className="text-[10px] text-slate-600 mt-1">{formatRelativeTime(r.createdAt)}</p>
              </div>
              {expanded === r.id
                ? <ChevronUp className="w-4 h-4 text-slate-600 flex-shrink-0 mt-1" />
                : <ChevronDown className="w-4 h-4 text-slate-600 flex-shrink-0 mt-1" />
              }
            </div>
          </button>

          {expanded === r.id && (
            <div className="border-t border-slate-700/50 px-3 pb-3 pt-2 space-y-2.5">
              {/* 推理依据 */}
              <div>
                <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-1">推理依据</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{r.reason}</p>
              </div>

              {/* 命中规则 */}
              {r.matchedRules.length > 0 && (
                <div>
                  <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-1">命中规则</p>
                  <div className="flex flex-wrap gap-1">
                    {r.matchedRules.map((ruleId) => (
                      <span key={ruleId} className="text-[9px] font-mono bg-purple-900/40 text-purple-400 border border-purple-800/60 px-1.5 py-0.5 rounded">
                        {ruleId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 推荐技能（联动行动层） */}
              {r.recommendedSkillIds && r.recommendedSkillIds.length > 0 && (
                <div>
                  <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-1">推荐调用技能</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.recommendedSkillIds.map((sid) => (
                      <span key={sid} className="flex items-center gap-1 text-[9px] bg-cyan-900/40 text-cyan-400 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                        <Zap className="w-2.5 h-2.5" />
                        {getSkillName(sid)}
                      </span>
                    ))}
                  </div>
                  <p className="text-[9px] text-indigo-400 mt-1">→ 切换「行动能力」Tab 查看高亮技能</p>
                </div>
              )}

              {/* 推荐动作 */}
              {r.recommendedAction && (
                <div>
                  <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-1">推荐动作</p>
                  <span className="text-[10px] bg-teal-900/40 text-teal-400 border border-teal-800/60 px-2 py-0.5 rounded font-mono">
                    {r.recommendedAction}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
