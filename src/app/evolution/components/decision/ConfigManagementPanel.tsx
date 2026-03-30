'use client'

import { useState, useEffect } from 'react'
import { Save, CheckCircle, ChevronDown } from 'lucide-react'
import type { CapabilityConfig } from '../../types'
import { getCapabilityConfigs, updateCapabilityConfig } from '../../services'

interface Props {
  configs: CapabilityConfig[]
  onConfigsChange: (configs: CapabilityConfig[]) => void
}

export function ConfigManagementPanel({ configs, onConfigsChange }: Props) {
  const [saved, setSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const handleChange = async (cfg: CapabilityConfig, newValue: string | number | boolean) => {
    setSaving(cfg.id)
    await updateCapabilityConfig(cfg.id, newValue)
    onConfigsChange(configs.map((c) =>
      c.id === cfg.id ? { ...c, value: newValue, updatedAt: new Date().toISOString() } : c
    ))
    setSaving(null)
    setSaved(cfg.id)
    setTimeout(() => setSaved(null), 2000)
  }

  const decisionConfigs = configs.filter((c) => c.capabilityType === 'decision')
  const actionConfigs   = configs.filter((c) => c.capabilityType === 'action')

  const renderConfig = (cfg: CapabilityConfig) => (
    <div key={cfg.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs text-slate-300 font-medium">{cfg.label}</p>
          {cfg.description && (
            <p className="text-[10px] text-slate-500 mt-0.5">{cfg.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cfg.valueType === 'select' && cfg.options ? (
            <div className="relative">
              <select
                value={String(cfg.value)}
                onChange={(e) => handleChange(cfg, e.target.value)}
                className="text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 appearance-none pr-7 cursor-pointer"
              >
                {cfg.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>
          ) : cfg.valueType === 'boolean' ? (
            <button
              onClick={() => handleChange(cfg, !cfg.value)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                cfg.value ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {cfg.value ? '开启' : '关闭'}
            </button>
          ) : (
            <input
              type="number"
              value={String(cfg.value)}
              onChange={(e) => handleChange(cfg, parseFloat(e.target.value))}
              className="w-24 text-xs bg-slate-700 border border-slate-600 text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 font-mono text-right"
            />
          )}
          {saving === cfg.id && (
            <span className="text-[9px] text-slate-500">保存中...</span>
          )}
          {saved === cfg.id && (
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {decisionConfigs.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono mb-2">决策能力配置</p>
          <div className="space-y-2">{decisionConfigs.map(renderConfig)}</div>
        </div>
      )}
      {actionConfigs.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono mb-2">行动能力配置</p>
          <div className="space-y-2">{actionConfigs.map(renderConfig)}</div>
        </div>
      )}
      {configs.length === 0 && (
        <p className="text-sm text-slate-600 text-center py-8">暂无配置项</p>
      )}
    </div>
  )
}
