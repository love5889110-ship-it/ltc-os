'use client'

import type { CapabilityMode } from '../types'

interface Props {
  mode: CapabilityMode
  onChange: (mode: CapabilityMode) => void
}

export function CapabilityModeTabs({ mode, onChange }: Props) {
  const tabs: Array<{ key: CapabilityMode; label: string; sub: string }> = [
    { key: 'decision', label: '决策能力', sub: '规则训练与提炼' },
    { key: 'action',   label: '行动能力', sub: '工具调试与装载' },
  ]

  return (
    <div className="flex gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-1 flex flex-col items-center py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            mode === t.key
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          <span className={mode === t.key ? 'text-white font-semibold' : ''}>{t.label}</span>
          <span className={`text-[10px] mt-0.5 ${mode === t.key ? 'text-indigo-200' : 'text-slate-600'}`}>
            {t.sub}
          </span>
        </button>
      ))}
    </div>
  )
}
