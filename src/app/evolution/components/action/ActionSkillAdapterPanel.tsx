'use client'

import { useState } from 'react'
import { Save, CheckCircle, AlertCircle } from 'lucide-react'
import type { ActionSkill, SkillAdapter } from '../../types'
import { saveSkillAdapter } from '../../services'
import { formatRelativeTime } from '@/lib/utils'

interface Props {
  skill: ActionSkill
  adapters: SkillAdapter[]
  onAdapterSaved: (adapter: SkillAdapter) => void
}

export function ActionSkillAdapterPanel({ skill, adapters, onAdapterSaved }: Props) {
  const existing = adapters.find((a) => a.skillId === skill.id)
  const [editing, setEditing] = useState(!existing)
  const [inputSchema, setInputSchema] = useState(
    JSON.stringify(existing?.normalizedInputSchema ?? skill.inputSchema ?? {}, null, 2)
  )
  const [outputSchema, setOutputSchema] = useState(
    JSON.stringify(existing?.normalizedOutputSchema ?? {}, null, 2)
  )
  const [permissions, setPermissions] = useState(
    (existing?.permissionScope ?? []).join(', ')
  )
  const [needsFineTuning, setNeedsFineTuning] = useState(existing?.needsFineTuning ?? false)
  const [needsReviewGate, setNeedsReviewGate] = useState(existing?.needsReviewGate ?? skill.requiresHumanReview)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const errs: Record<string, string> = {}
    try { JSON.parse(inputSchema) } catch { errs.input = 'JSON 格式错误' }
    try { JSON.parse(outputSchema) } catch { errs.output = 'JSON 格式错误' }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const adapter = await saveSkillAdapter({
      skillId: skill.id,
      normalizedInputSchema: JSON.parse(inputSchema),
      normalizedOutputSchema: JSON.parse(outputSchema),
      permissionScope: permissions.split(',').map((s) => s.trim()).filter(Boolean),
      needsFineTuning,
      needsReviewGate,
    })
    onAdapterSaved(adapter)
    setEditing(false)
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      {/* 说明 */}
      <div className="flex items-start gap-2 bg-slate-800/60 border border-slate-700 rounded-xl p-3">
        {existing
          ? <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
          : <AlertCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
        }
        <div>
          <p className="text-[11px] font-medium text-slate-300">
            {existing ? '适配层已配置' : '需完成适配层配置'}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {skill.sourceType === 'internal'
              ? '内生技能推荐完成适配以标准化 schema'
              : '外部/员工共创技能必须完成适配后才能推进状态流转'
            }
          </p>
          {existing && !editing && (
            <p className="text-[9px] text-slate-600 mt-0.5">最后更新：{formatRelativeTime(existing.adaptedAt)}</p>
          )}
        </div>
      </div>

      {/* 展示 or 编辑 */}
      {!editing && existing ? (
        <div className="space-y-2">
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-2 text-[11px]">
            <div>
              <p className="text-slate-600 mb-0.5 font-mono uppercase text-[9px] tracking-wider">标准化输入 Schema</p>
              <pre className="text-slate-400 font-mono whitespace-pre-wrap text-[10px]">
                {JSON.stringify(existing.normalizedInputSchema, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-slate-600 mb-0.5 font-mono uppercase text-[9px] tracking-wider">标准化输出 Schema</p>
              <pre className="text-slate-400 font-mono whitespace-pre-wrap text-[10px]">
                {JSON.stringify(existing.normalizedOutputSchema, null, 2)}
              </pre>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-slate-600 font-mono uppercase text-[9px] tracking-wider mb-0.5">权限范围</p>
                <p className="text-slate-400">{existing.permissionScope.join(', ') || '无'}</p>
              </div>
              <div>
                <p className="text-slate-600 font-mono uppercase text-[9px] tracking-wider mb-0.5">需微调</p>
                <p className={existing.needsFineTuning ? 'text-yellow-400' : 'text-slate-500'}>
                  {existing.needsFineTuning ? '是' : '否'}
                </p>
              </div>
              <div>
                <p className="text-slate-600 font-mono uppercase text-[9px] tracking-wider mb-0.5">需审核门</p>
                <p className={existing.needsReviewGate ? 'text-orange-400' : 'text-slate-500'}>
                  {existing.needsReviewGate ? '是' : '否'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            修改适配配置
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* 标准化输入 */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block mb-1">标准化输入 Schema</label>
            <textarea
              value={inputSchema}
              onChange={(e) => setInputSchema(e.target.value)}
              rows={4}
              className={`w-full text-xs font-mono bg-slate-800 border ${errors.input ? 'border-red-600' : 'border-slate-700'} text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 resize-y`}
              spellCheck={false}
            />
            {errors.input && <p className="text-[10px] text-red-400 mt-0.5">{errors.input}</p>}
          </div>

          {/* 标准化输出 */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block mb-1">标准化输出 Schema</label>
            <textarea
              value={outputSchema}
              onChange={(e) => setOutputSchema(e.target.value)}
              rows={4}
              className={`w-full text-xs font-mono bg-slate-800 border ${errors.output ? 'border-red-600' : 'border-slate-700'} text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 resize-y`}
              spellCheck={false}
            />
            {errors.output && <p className="text-[10px] text-red-400 mt-0.5">{errors.output}</p>}
          </div>

          {/* 权限范围 */}
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block mb-1">权限范围（逗号分隔）</label>
            <input
              value={permissions}
              onChange={(e) => setPermissions(e.target.value)}
              placeholder="read:customer, write:draft, call:external_api"
              className="w-full text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder-slate-700"
            />
          </div>

          {/* 开关 */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={needsFineTuning}
                onChange={(e) => setNeedsFineTuning(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-slate-400">需要微调</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={needsReviewGate}
                onChange={(e) => setNeedsReviewGate(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-slate-400">需要审核门</span>
            </label>
          </div>

          {/* 保存 */}
          <div className="flex gap-2">
            {existing && (
              <button onClick={() => setEditing(false)} className="flex-1 py-2 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors">
                取消
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? '保存中...' : '保存适配配置'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
