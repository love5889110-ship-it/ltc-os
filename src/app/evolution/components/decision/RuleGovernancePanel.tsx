'use client'

import { useState } from 'react'
import { ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Bot } from 'lucide-react'
import type { GovernanceRule } from '../../types'
import { formatRelativeTime, AGENT_LABELS } from '@/lib/utils'
import { toggleGovernanceRule } from '../../services'

interface Props {
  rules: GovernanceRule[]
  onRulesChange: (rules: GovernanceRule[]) => void
}

const ruleTypeBadge: Record<string, string> = {
  forbid:  'bg-red-900/40 text-red-400 border-red-800/60',
  require: 'bg-blue-900/40 text-blue-400 border-blue-800/60',
  prefer:  'bg-green-900/40 text-green-400 border-green-800/60',
}
const ruleTypeLabel: Record<string, string> = { forbid: '禁止', require: '必须', prefer: '倾向' }

export function RuleGovernancePanel({ rules, onRulesChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const handleToggle = async (rule: GovernanceRule) => {
    setToggling(rule.id)
    const newStatus = rule.status === 'active' ? 'inactive' : 'active'
    await toggleGovernanceRule(rule.id, newStatus)
    onRulesChange(rules.map((r) => r.id === rule.id ? { ...r, status: newStatus } : r))
    setToggling(null)
  }

  const activeCount = rules.filter((r) => r.status === 'active').length

  return (
    <div className="space-y-3">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">{rules.length} 条规则</span>
          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">
            {activeCount} 条生效
          </span>
        </div>
      </div>

      {/* 列表 */}
      {rules.length === 0 ? (
        <div className="text-center py-10 text-slate-600 text-sm">暂无规则</div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-xl border transition-all ${
                rule.status === 'active'
                  ? 'bg-slate-800/50 border-slate-700/80'
                  : 'bg-slate-900/30 border-slate-800/50 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3 p-3">
                {/* 规则类型标签 */}
                {rule.ruleType && (
                  <span className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border mt-0.5 ${ruleTypeBadge[rule.ruleType]}`}>
                    {ruleTypeLabel[rule.ruleType]}
                  </span>
                )}

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-medium leading-snug">{rule.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {rule.targetAgent && (
                      <span className="text-[9px] text-slate-500">
                        {(AGENT_LABELS as Record<string, string>)[rule.targetAgent] ?? rule.targetAgent}
                      </span>
                    )}
                    <span className={`text-[9px] ${rule.source === 'feedback' ? 'text-indigo-400' : 'text-slate-600'}`}>
                      {rule.source === 'feedback' ? '来自反馈' : '手动创建'}
                    </span>
                    <span className="text-[9px] text-slate-600">命中 {rule.hitCount} 次</span>
                    <span className="text-[9px] text-slate-600">{formatRelativeTime(rule.updatedAt)}</span>
                  </div>

                  {/* 展开详情 */}
                  {expanded === rule.id && rule.condition && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-[10px] text-slate-500">
                        <span className="text-slate-600 font-medium">触发条件：</span>{rule.condition}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        <span className="text-slate-600 font-medium">规则内容：</span>{rule.instruction}
                      </p>
                    </div>
                  )}
                </div>

                {/* 操作 */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {rule.condition && (
                    <button
                      onClick={() => setExpanded(expanded === rule.id ? null : rule.id)}
                      className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {expanded === rule.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={toggling === rule.id}
                    className="transition-colors disabled:opacity-50"
                    title={rule.status === 'active' ? '点击停用' : '点击启用'}
                  >
                    {rule.status === 'active'
                      ? <ToggleRight className="w-5 h-5 text-indigo-400" />
                      : <ToggleLeft className="w-5 h-5 text-slate-600" />
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
