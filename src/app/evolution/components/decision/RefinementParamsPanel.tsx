'use client'

import { useState } from 'react'
import { Save, ToggleLeft, ToggleRight, CheckCircle } from 'lucide-react'
import type { RefinementParam } from '../../types'
import { formatRelativeTime } from '@/lib/utils'
import { updateRefinementParam } from '../../services'

interface Props {
  params: RefinementParam[]
  onParamsChange: (params: RefinementParam[]) => void
}

export function RefinementParamsPanel({ params, onParamsChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const startEdit = (p: RefinementParam) => {
    setEditingId(p.id)
    setEditValue(String(p.value))
  }

  const handleSave = async (p: RefinementParam) => {
    setSaving(p.id)
    let newVal: string | number | boolean = editValue
    if (p.value === true || p.value === false) {
      newVal = editValue === 'true'
    } else if (typeof p.value === 'number') {
      newVal = parseFloat(editValue) || 0
    }

    await updateRefinementParam(p.id, newVal)
    onParamsChange(params.map((pp) =>
      pp.id === p.id ? { ...pp, value: newVal, updatedAt: new Date().toISOString() } : pp
    ))
    setSaving(null)
    setSaved(p.id)
    setEditingId(null)
    setTimeout(() => setSaved(null), 2000)
  }

  const handleToggleStatus = (p: RefinementParam) => {
    const newStatus = p.status === 'active' ? 'inactive' : 'active'
    onParamsChange(params.map((pp) => pp.id === p.id ? { ...pp, status: newStatus } : pp))
  }

  const decisionParams = params.filter((p) => p.capabilityType === 'decision')
  const actionParams   = params.filter((p) => p.capabilityType === 'action')

  const renderList = (list: RefinementParam[], label: string) => (
    <div>
      <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono mb-2">{label}</p>
      <div className="space-y-2">
        {list.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-3 transition-all ${
              p.status === 'active'
                ? 'bg-slate-800/50 border-slate-700/80'
                : 'bg-slate-900/30 border-slate-800/50 opacity-60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs text-slate-300 font-medium">{p.name}</p>
                  {p.status === 'active'
                    ? <span className="text-[8px] bg-green-900/40 text-green-400 border border-green-800/60 px-1 py-0 rounded">生效中</span>
                    : <span className="text-[8px] bg-slate-700/50 text-slate-500 border border-slate-700 px-1 py-0 rounded">未生效</span>
                  }
                </div>
                {p.description && (
                  <p className="text-[10px] text-slate-500 mb-2">{p.description}</p>
                )}
                {/* 值编辑区 */}
                {editingId === p.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 text-xs bg-slate-700 border border-indigo-500 text-white rounded-lg px-2 py-1.5 focus:outline-none font-mono"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSave(p)}
                    />
                    <button
                      onClick={() => handleSave(p)}
                      disabled={saving === p.id}
                      className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving === p.id ? '保存中...' : <><Save className="w-3 h-3" />保存</>}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-cyan-300 bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
                      {String(p.value)}
                    </span>
                    {saved === p.id && (
                      <span className="flex items-center gap-1 text-[10px] text-green-400">
                        <CheckCircle className="w-3 h-3" />已保存
                      </span>
                    )}
                    <button
                      onClick={() => startEdit(p)}
                      className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors"
                    >
                      编辑
                    </button>
                  </div>
                )}
                <p className="text-[9px] text-slate-600 mt-1.5">{formatRelativeTime(p.updatedAt)} · {p.updatedBy ?? '系统'}</p>
              </div>
              <button onClick={() => handleToggleStatus(p)} className="flex-shrink-0 mt-0.5">
                {p.status === 'active'
                  ? <ToggleRight className="w-5 h-5 text-indigo-400" />
                  : <ToggleLeft className="w-5 h-5 text-slate-600" />
                }
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {renderList(decisionParams, '决策能力参数')}
      {renderList(actionParams, '行动能力参数')}
    </div>
  )
}
