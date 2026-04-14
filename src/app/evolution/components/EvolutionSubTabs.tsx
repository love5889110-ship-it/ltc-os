'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { EvolutionTab } from '../types'

interface Props {
  activeTab: EvolutionTab
  onChange: (tab: EvolutionTab) => void
  activeRulesCount?: number
}

const PRIMARY_TABS: Array<{ key: EvolutionTab; label: string }> = [
  { key: 'correction', label: '纠偏工作台' },
  { key: 'rules',      label: '规则库' },
]

const ADVANCED_TABS: Array<{ key: EvolutionTab; label: string }> = [
  { key: 'feedback',  label: '全部样本' },
  { key: 'params',    label: '提炼参数' },
  { key: 'config',    label: '配置管理' },
  { key: 'tracking',  label: '效果追踪' },
]

export function EvolutionSubTabs({ activeTab, onChange, activeRulesCount = 0 }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(ADVANCED_TABS.some(t => t.key === activeTab))

  return (
    <div className="space-y-1">
      {/* 主 Tab 行 */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        {PRIMARY_TABS.map((t) => (
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
                {activeRulesCount}
              </span>
            )}
          </button>
        ))}
        {/* 高级工具折叠按钮 */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className={`ml-auto flex items-center gap-1 px-3 py-2 text-xs transition-colors ${
            showAdvanced ? 'text-slate-300' : 'text-slate-600 hover:text-slate-400'
          }`}
        >
          高级
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* 高级工具 Tab 行（折叠） */}
      {showAdvanced && (
        <div className="flex gap-1 px-1 pb-1 border-b border-slate-800/50">
          {ADVANCED_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                activeTab === t.key
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
