'use client'

import { useState } from 'react'
import { Upload, X, AlertTriangle } from 'lucide-react'
import type { ActionSkill, SkillSourceType } from '../../types'
import { importActionSkill } from '../../services'

interface Props {
  onImported: (skill: ActionSkill) => void
  onCancel: () => void
}

export function ActionSkillImportDialog({ onImported, onCancel }: Props) {
  const [sourceType, setSourceType] = useState<'employee_built' | 'external'>('employee_built')
  const [sourceName, setSourceName] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleJsonChange = (val: string) => {
    setJsonText(val)
    try {
      JSON.parse(val)
      setJsonError(null)
    } catch {
      setJsonError('JSON 格式错误')
    }
  }

  const handleImport = async () => {
    if (jsonError || !jsonText.trim()) {
      setJsonError('请输入有效的 JSON')
      return
    }
    setImporting(true)
    try {
      const skillJson = JSON.parse(jsonText)
      const skill = await importActionSkill({ skillJson, sourceType, sourceName: sourceName.trim() || undefined })
      onImported(skill)
    } catch (err) {
      setJsonError(String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-white">导入外部技能</p>
        <button onClick={onCancel} className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 严格警告 */}
      <div className="flex items-start gap-2 bg-orange-950/40 border border-orange-800/60 rounded-xl p-3">
        <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-semibold text-orange-300">导入后状态为「草稿」</p>
          <p className="text-[10px] text-orange-400/80 mt-0.5">
            必须经过适配层配置 → 调试测试 → 评测验证 → 状态变为「可调用」后，方可正式调用。禁止跳过流程。
          </p>
        </div>
      </div>

      {/* 来源类型 */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">来源类型</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['employee_built', '员工共创技能', '由内部员工开发的自动化程序'],
            ['external', '外部生态技能', 'OpenClaw / 第三方脚本 / 开源 Agent Skill'],
          ] as const).map(([val, label, desc]) => (
            <button
              key={val}
              onClick={() => setSourceType(val)}
              className={`text-left p-2.5 rounded-xl border transition-all ${
                sourceType === val
                  ? 'bg-indigo-900/30 border-indigo-600/60 text-indigo-300'
                  : 'bg-slate-700/30 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <p className="text-xs font-medium">{label}</p>
              <p className="text-[9px] mt-0.5 opacity-70">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 来源名称 */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">
          {sourceType === 'employee_built' ? '贡献人/团队' : '来源平台/脚本名称'}
        </label>
        <input
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          placeholder={sourceType === 'employee_built' ? '如：李工（商务团队）' : '如：OpenClaw v2.1'}
          className="w-full text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
        />
      </div>

      {/* JSON 输入 */}
      <div>
        <label className="text-[10px] text-slate-500 block mb-1">
          技能定义 JSON（支持 OpenAI Function Call 格式）
        </label>
        <textarea
          value={jsonText}
          onChange={(e) => handleJsonChange(e.target.value)}
          rows={8}
          placeholder={'{\n  "name": "技能名称",\n  "description": "描述",\n  "parameters": {\n    "type": "object",\n    "properties": {}\n  }\n}'}
          className={`w-full text-xs font-mono bg-slate-800 border ${
            jsonError ? 'border-red-600' : 'border-slate-700'
          } text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 resize-y placeholder-slate-700`}
          spellCheck={false}
        />
        {jsonError && <p className="text-[10px] text-red-400 mt-0.5">{jsonError}</p>}
      </div>

      {/* 操作 */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleImport}
          disabled={importing || !!jsonError || !jsonText.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-white bg-orange-600 hover:bg-orange-500 rounded-xl transition-colors disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {importing ? '导入中...' : '导入（草稿）'}
        </button>
      </div>
    </div>
  )
}
