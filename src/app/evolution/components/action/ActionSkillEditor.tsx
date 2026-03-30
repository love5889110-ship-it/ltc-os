'use client'

import { useState } from 'react'
import { Save, X } from 'lucide-react'
import type { ActionSkill } from '../../types'
import { createActionSkill } from '../../services'

interface Props {
  onCreated: (skill: ActionSkill) => void
  onCancel: () => void
}

const TASK_TYPE_OPTIONS = [
  'create_task', 'send_draft', 'create_collab', 'update_status',
  'escalate', 'create_snapshot', 'notify', 'call_tool',
]

export function ActionSkillEditor({ onCreated, onCancel }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('document')
  const [inputSchemaText, setInputSchemaText] = useState('{\n  "query": "string"\n}')
  const [outputSchemaText, setOutputSchemaText] = useState('{\n  "result": "string"\n}')
  const [selectedTaskTypes, setSelectedTaskTypes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = '请输入技能名称'
    if (!description.trim()) errs.description = '请输入技能描述'
    try { JSON.parse(inputSchemaText) } catch { errs.inputSchema = 'JSON 格式错误' }
    try { JSON.parse(outputSchemaText) } catch { errs.outputSchema = 'JSON 格式错误' }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreate = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const skill = await createActionSkill({
        name: name.trim(),
        description: description.trim(),
        type,
        inputSchema: JSON.parse(inputSchemaText),
        outputSchema: JSON.parse(outputSchemaText),
        applicableTaskTypes: selectedTaskTypes,
      })
      onCreated(skill)
    } catch (err) {
      setErrors({ general: String(err) })
    } finally {
      setSaving(false)
    }
  }

  const toggleTaskType = (tt: string) => {
    setSelectedTaskTypes((prev) =>
      prev.includes(tt) ? prev.filter((t) => t !== tt) : [...prev, tt]
    )
  }

  const inputCls = (field: string) =>
    `w-full text-xs bg-slate-800 border ${errors[field] ? 'border-red-600' : 'border-slate-700'} text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder-slate-600`

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-white">新建内生技能</p>
        <button onClick={onCancel} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[10px] text-cyan-400 bg-cyan-900/20 border border-cyan-800/40 rounded-lg px-2 py-1.5">
        新建技能默认为「草稿」状态，需经测试、验证后才能发布为「可调用」
      </p>

      {errors.general && (
        <p className="text-xs text-red-400">{errors.general}</p>
      )}

      {/* 名称 */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">技能名称 *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：竞品应对草稿生成"
          className={inputCls('name')}
        />
        {errors.name && <p className="text-[10px] text-red-400 mt-0.5">{errors.name}</p>}
      </div>

      {/* 描述 */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">技能描述 *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="简要描述此技能的功能和使用场景"
          className={inputCls('description') + ' resize-none'}
        />
        {errors.description && <p className="text-[10px] text-red-400 mt-0.5">{errors.description}</p>}
      </div>

      {/* 类型 */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">技能类型</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="document">文档生成</option>
          <option value="communicate">沟通推送</option>
          <option value="data">数据查询</option>
          <option value="browse">网页浏览</option>
          <option value="compute">计算分析</option>
        </select>
      </div>

      {/* 输入 Schema */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">输入参数 Schema (JSON)</label>
        <textarea
          value={inputSchemaText}
          onChange={(e) => setInputSchemaText(e.target.value)}
          rows={4}
          className={inputCls('inputSchema') + ' resize-y font-mono'}
          spellCheck={false}
        />
        {errors.inputSchema && <p className="text-[10px] text-red-400 mt-0.5">{errors.inputSchema}</p>}
      </div>

      {/* 输出 Schema */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">输出格式 Schema (JSON)</label>
        <textarea
          value={outputSchemaText}
          onChange={(e) => setOutputSchemaText(e.target.value)}
          rows={4}
          className={inputCls('outputSchema') + ' resize-y font-mono'}
          spellCheck={false}
        />
        {errors.outputSchema && <p className="text-[10px] text-red-400 mt-0.5">{errors.outputSchema}</p>}
      </div>

      {/* 适用任务类型 */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">适用任务类型（可多选）</label>
        <div className="flex flex-wrap gap-1.5">
          {TASK_TYPE_OPTIONS.map((tt) => (
            <button
              key={tt}
              onClick={() => toggleTaskType(tt)}
              className={`text-[9px] px-2 py-1 rounded border transition-colors ${
                selectedTaskTypes.includes(tt)
                  ? 'bg-indigo-600/40 text-indigo-300 border-indigo-600/60'
                  : 'bg-slate-700/50 text-slate-500 border-slate-700 hover:border-slate-600'
              }`}
            >
              {tt}
            </button>
          ))}
        </div>
      </div>

      {/* 操作 */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '创建中...' : '创建（草稿）'}
        </button>
      </div>
    </div>
  )
}
