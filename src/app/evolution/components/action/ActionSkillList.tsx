'use client'

import { Zap, CheckCircle, AlertCircle, Clock, Link2 } from 'lucide-react'
import type { ActionSkill, SkillBinding } from '../../types'
import { SKILL_STATUS_LABELS } from '../../types'
import { formatRelativeTime } from '@/lib/utils'

interface Props {
  skills: ActionSkill[]
  bindings: SkillBinding[]
  highlightIds?: string[]
  selectedId?: string | null
  onSelect: (skill: ActionSkill) => void
}

const statusColors: Record<string, string> = {
  draft:     'bg-slate-700/60 text-slate-400 border-slate-600',
  testing:   'bg-yellow-900/40 text-yellow-400 border-yellow-800/60',
  validated: 'bg-blue-900/40 text-blue-400 border-blue-800/60',
  callable:  'bg-green-900/40 text-green-400 border-green-800/60',
  disabled:  'bg-red-900/40 text-red-400 border-red-800/60',
}

// 分组：可用 → 训练中 → 草稿/停用
const STATUS_GROUPS = [
  { label: '已上线', statuses: ['callable'] as const },
  { label: '训练中', statuses: ['testing', 'validated'] as const },
  { label: '草稿 / 停用', statuses: ['draft', 'disabled'] as const },
]

export function ActionSkillList({ skills, bindings, highlightIds = [], selectedId, onSelect }: Props) {
  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-600">
        <p className="text-xs">暂无技能</p>
        <p className="text-[10px] mt-1">点击「训练新技能」开始</p>
      </div>
    )
  }

  const grouped = STATUS_GROUPS.map((g) => ({
    ...g,
    items: skills.filter((s) => (g.statuses as readonly string[]).includes(s.status)),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-3 overflow-y-auto">
      {grouped.map((group) => (
        <div key={group.label}>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest font-mono px-1 mb-1.5">
            {group.label}
          </p>
          <div className="space-y-1.5">
            {group.items.map((skill) => {
              const bindCount = bindings.filter((b) => b.skillId === skill.id && b.enabled).length
              const isHighlighted = highlightIds.includes(skill.id)
              const isSelected = selectedId === skill.id

              return (
                <button
                  key={skill.id}
                  onClick={() => onSelect(skill)}
                  className={`w-full text-left rounded-xl border p-2.5 transition-all ${
                    isSelected
                      ? 'bg-indigo-900/30 border-indigo-600/60'
                      : isHighlighted
                      ? 'bg-cyan-900/20 border-cyan-700/60 ring-1 ring-cyan-700/40'
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${statusColors[skill.status]}`}>
                          {SKILL_STATUS_LABELS[skill.status]}
                        </span>
                        {isHighlighted && (
                          <span className="text-[9px] bg-cyan-900/40 text-cyan-400 border border-cyan-700/60 px-1.5 py-0.5 rounded animate-pulse">
                            决策推荐
                          </span>
                        )}
                        {bindCount > 0 && (
                          <span className="text-[9px] bg-slate-700/60 text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Link2 className="w-2 h-2" />{bindCount} Agent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 font-medium truncate">{skill.name}</p>
                      {skill.status !== 'draft' && skill.successRate > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <CheckCircle className="w-2.5 h-2.5 text-green-500" />
                          <span className="text-[9px] text-slate-500">
                            成功率 {Math.round(skill.successRate * 100)}%
                          </span>
                          {skill.avgDurationMs && (
                            <>
                              <Clock className="w-2.5 h-2.5 text-slate-600 ml-1" />
                              <span className="text-[9px] text-slate-600">{skill.avgDurationMs}ms</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {skill.status === 'callable' && (
                      <Zap className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    )}
                    {skill.status === 'disabled' && (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
