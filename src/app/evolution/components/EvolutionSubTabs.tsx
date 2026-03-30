'use client'

import type { EvolutionTab } from '../types'

interface Props {
  activeTab: EvolutionTab
  onChange: (tab: EvolutionTab) => void
  activeRulesCount?: number
}

const TABS: Array<{ key: EvolutionTab; label: string }> = [
  { key: 'feedback', label: '反馈样本' },
  { key: 'rules',    label: '规则治理' },
  { key: 'params',   label: '提炼参数' },
  { key: 'config',   label: '配置管理' },
  { key: 'tracking', label: '效果追踪' },
]

export function EvolutionSubTabs({ activeTab, onChange, activeRulesCount = 0 }: Props) {
  return (
    <div className="flex gap-1 border-b border-slate-800">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`relative px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === t.key
              ? 'text-indigo-400 border-b-2 border-indigo-500 -mb-px'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {t.label}
          {t.key === 'rules' && activeRulesCount > 0 && (
            <span className="ml-1.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {activeRulesCount} 条生效
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
