'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import type { ActionSkill, SkillBinding } from '../../types'
import { saveSkillBinding, deleteSkillBinding } from '../../services'

interface Props {
  skills: ActionSkill[]
  bindings: SkillBinding[]
  onBindingsUpdated: (bindings: SkillBinding[]) => void
}

const TASK_TYPE_OPTIONS = [
  { value: 'create_task', label: '创建任务' },
  { value: 'send_draft', label: '发送草稿' },
  { value: 'create_collab', label: '创建协作' },
  { value: 'update_status', label: '更新状态' },
  { value: 'escalate', label: '升级处理' },
  { value: 'create_snapshot', label: '创建快照' },
  { value: 'notify', label: '发送通知' },
  { value: 'call_tool', label: '调用工具' },
]

export function ActionSkillBindingPanel({ skills, bindings, onBindingsUpdated }: Props) {
  const [adding, setAdding] = useState(false)
  const [newTaskType, setNewTaskType] = useState('create_task')
  const [newSkillId, setNewSkillId] = useState('')
  const [saving, setSaving] = useState(false)

  const callableSkills = skills.filter((s) => s.status === 'callable')

  const handleAdd = async () => {
    if (!newSkillId) return
    setSaving(true)
    const binding = await saveSkillBinding({
      taskType: newTaskType,
      skillId: newSkillId,
      priority: bindings.filter((b) => b.taskType === newTaskType).length + 1,
      enabled: true,
    })
    onBindingsUpdated([...bindings, binding])
    setAdding(false)
    setNewSkillId('')
    setSaving(false)
  }

  const handleToggle = async (b: SkillBinding) => {
    const updated = { ...b, enabled: !b.enabled }
    const saved = await saveSkillBinding(updated)
    onBindingsUpdated(bindings.map((x) => (x.id === saved.id ? saved : x)))
  }

  const handleDelete = async (id: string) => {
    await deleteSkillBinding(id)
    onBindingsUpdated(bindings.filter((b) => b.id !== id))
  }

  const handlePriorityChange = async (b: SkillBinding, delta: number) => {
    const sameType = bindings.filter((x) => x.taskType === b.taskType).sort((a, c) => a.priority - c.priority)
    const idx = sameType.findIndex((x) => x.id === b.id)
    const newIdx = Math.max(0, Math.min(sameType.length - 1, idx + delta))
    if (newIdx === idx) return

    const reordered = [...sameType]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(newIdx, 0, moved)

    const updated = reordered.map((x, i) => ({ ...x, priority: i + 1 }))
    const saved = await Promise.all(updated.map((u) => saveSkillBinding(u)))
    const otherBindings = bindings.filter((x) => x.taskType !== b.taskType)
    onBindingsUpdated([...otherBindings, ...saved])
  }

  // group by task type
  const grouped = TASK_TYPE_OPTIONS.map((tt) => ({
    ...tt,
    items: bindings
      .filter((b) => b.taskType === tt.value)
      .sort((a, c) => a.priority - c.priority),
  })).filter((g) => g.items.length > 0)

  const skillName = (id: string) => skills.find((s) => s.id === id)?.name ?? id

  return (
    <div className="space-y-4">
      {/* 说明 */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-3 py-2.5">
        <p className="text-[10px] text-slate-400">
          绑定决定了执行某类任务时，优先调用哪个技能。只有「可调用」状态的技能可参与绑定。优先级数字越小越优先。
        </p>
      </div>

      {/* 新增绑定 */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
          {bindings.length} 条绑定规则
        </p>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-800/60 hover:border-indigo-600/60 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          新增绑定
        </button>
      </div>

      {adding && (
        <div className="bg-slate-800/60 border border-indigo-800/50 rounded-xl p-3 space-y-2.5">
          <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">新增技能绑定</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-500 block mb-1">任务类型</label>
              <select
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
                className="w-full text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                {TASK_TYPE_OPTIONS.map((tt) => (
                  <option key={tt.value} value={tt.value}>{tt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-slate-500 block mb-1">绑定技能（仅可调用）</label>
              <select
                value={newSkillId}
                onChange={(e) => setNewSkillId(e.target.value)}
                className="w-full text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="">请选择技能</option>
                {callableSkills.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {callableSkills.length === 0 && (
            <p className="text-[10px] text-orange-400/80">当前没有「可调用」状态的技能，请先将技能推进至可调用状态</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setNewSkillId('') }}
              className="flex-1 py-1.5 text-xs text-slate-400 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !newSkillId}
              className="flex-1 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存绑定'}
            </button>
          </div>
        </div>
      )}

      {/* 绑定列表，按任务类型分组 */}
      {grouped.length === 0 ? (
        <div className="text-center py-8 text-slate-600">
          <p className="text-sm">暂无绑定规则</p>
          <p className="text-xs mt-1">添加绑定后，Agent 执行对应任务时将自动路由到绑定技能</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => (
            <div key={group.value}>
              <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-1.5">
                {group.label}
                <span className="text-slate-700 ml-1">({group.value})</span>
              </p>
              <div className="space-y-1.5">
                {group.items.map((b, idx) => {
                  const skill = skills.find((s) => s.id === b.skillId)
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${
                        b.enabled
                          ? 'bg-slate-800/40 border-slate-700/60'
                          : 'bg-slate-900/20 border-slate-800/40 opacity-60'
                      }`}
                    >
                      <GripVertical className="w-3 h-3 text-slate-700 flex-shrink-0" />

                      {/* 优先级控制 */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handlePriorityChange(b, -1)}
                          disabled={idx === 0}
                          className="text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handlePriorityChange(b, 1)}
                          disabled={idx === group.items.length - 1}
                          className="text-slate-600 hover:text-slate-400 disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-[9px] text-slate-600 font-mono w-4 text-center">{b.priority}</span>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-300 truncate">{skillName(b.skillId)}</p>
                        {skill && (
                          <p className="text-[9px] text-slate-600">{skill.type} · {skill.sourceType}</p>
                        )}
                      </div>

                      {/* 启用/停用开关 */}
                      <button
                        onClick={() => handleToggle(b)}
                        className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                          b.enabled
                            ? 'bg-green-900/30 text-green-400 border-green-800/50 hover:bg-green-900/50'
                            : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {b.enabled ? '启用' : '停用'}
                      </button>

                      <button
                        onClick={() => handleDelete(b.id)}
                        className="text-slate-700 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
