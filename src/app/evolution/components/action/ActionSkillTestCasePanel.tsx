'use client'

import { useState } from 'react'
import { Plus, Play, CheckCircle, XCircle, Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { ActionSkill, SkillTestCase, SkillExecutionLog } from '../../types'
import { runActionSkillCases } from '../../services'

interface Props {
  skill: ActionSkill
  testCases: SkillTestCase[]
  onCasesUpdated: (cases: SkillTestCase[]) => void
  onLogAdded: (log: SkillExecutionLog) => void
}

function StatusBadge({ status }: { status: SkillTestCase['status'] }) {
  if (status === 'pass') return (
    <span className="flex items-center gap-1 text-[9px] text-green-400 font-semibold">
      <CheckCircle className="w-3 h-3" />通过
    </span>
  )
  if (status === 'fail') return (
    <span className="flex items-center gap-1 text-[9px] text-red-400 font-semibold">
      <XCircle className="w-3 h-3" />失败
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[9px] text-slate-500 font-semibold">
      <Clock className="w-3 h-3" />待运行
    </span>
  )
}

export function ActionSkillTestCasePanel({ skill, testCases, onCasesUpdated, onLogAdded }: Props) {
  const [adding, setAdding] = useState(false)
  const [newInput, setNewInput] = useState('{\n  \n}')
  const [newExpected, setNewExpected] = useState('')
  const [newInputError, setNewInputError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = testCases.filter((c) => c.skillId === skill.id)

  const handleNewInputChange = (val: string) => {
    setNewInput(val)
    try { JSON.parse(val); setNewInputError(null) }
    catch { setNewInputError('JSON 格式错误') }
  }

  const handleAddCase = () => {
    if (newInputError) return
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(newInput) } catch {}

    const newCase: SkillTestCase = {
      id: `tc_${Date.now()}`,
      skillId: skill.id,
      input: JSON.stringify(parsed),
      expectedOutput: newExpected.trim() || undefined,
      status: 'pending',
    }
    onCasesUpdated([...testCases, newCase])
    setNewInput('{\n  \n}')
    setNewExpected('')
    setAdding(false)
  }

  const handleRemoveCase = (id: string) => {
    onCasesUpdated(testCases.filter((c) => c.id !== id))
  }

  const handleRunAll = async () => {
    if (filtered.length === 0) return
    setRunning(true)
    try {
      const { updatedCases, logs } = await runActionSkillCases(skill, filtered)
      // merge updated cases back
      const otherCases = testCases.filter((c) => c.skillId !== skill.id)
      onCasesUpdated([...otherCases, ...updatedCases])
      logs.forEach(onLogAdded)
    } finally {
      setRunning(false)
    }
  }

  const passCount = filtered.filter((c) => c.status === 'pass').length
  const failCount = filtered.filter((c) => c.status === 'fail').length
  const pendingCount = filtered.filter((c) => c.status === 'pending').length

  return (
    <div className="space-y-3">
      {/* 汇总行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{filtered.length} 条样例</span>
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-green-400">{passCount} 通过</span>
              <span className="text-red-400">{failCount} 失败</span>
              <span className="text-slate-600">{pendingCount} 待运行</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={handleRunAll}
              disabled={running || skill.status === 'disabled'}
              className="flex items-center gap-1.5 text-[10px] text-white bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              {running ? '运行中...' : '批量运行'}
            </button>
          )}
          <button
            onClick={() => setAdding(!adding)}
            className="flex items-center gap-1.5 text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-800/60 hover:border-indigo-600/60 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
            添加样例
          </button>
        </div>
      </div>

      {/* 进度条（有数据时显示） */}
      {filtered.length > 0 && (
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
          {passCount > 0 && (
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(passCount / filtered.length) * 100}%` }}
            />
          )}
          {failCount > 0 && (
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(failCount / filtered.length) * 100}%` }}
            />
          )}
          {pendingCount > 0 && (
            <div
              className="bg-slate-700 transition-all"
              style={{ width: `${(pendingCount / filtered.length) * 100}%` }}
            />
          )}
        </div>
      )}

      {/* 新增样例表单 */}
      {adding && (
        <div className="bg-slate-800/60 border border-indigo-800/60 rounded-xl p-3 space-y-2.5">
          <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">新增测试样例</p>
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wider font-mono block mb-1">输入参数 (JSON) *</label>
            <textarea
              value={newInput}
              onChange={(e) => handleNewInputChange(e.target.value)}
              rows={4}
              className={`w-full text-xs font-mono bg-slate-900/60 border ${newInputError ? 'border-red-600' : 'border-slate-700'} text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 resize-y`}
              spellCheck={false}
            />
            {newInputError && <p className="text-[10px] text-red-400 mt-0.5">{newInputError}</p>}
          </div>
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wider font-mono block mb-1">期望输出（可选，用于对比）</label>
            <textarea
              value={newExpected}
              onChange={(e) => setNewExpected(e.target.value)}
              rows={2}
              placeholder="留空表示仅验证能否成功执行"
              className="w-full text-xs font-mono bg-slate-900/60 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 resize-y placeholder-slate-700"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setNewInput('{\n  \n}'); setNewExpected('') }}
              className="flex-1 py-1.5 text-xs text-slate-400 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAddCase}
              disabled={!!newInputError}
              className="flex-1 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              添加
            </button>
          </div>
        </div>
      )}

      {/* 样例列表 */}
      {filtered.length === 0 && !adding ? (
        <div className="text-center py-8 text-slate-600">
          <p className="text-sm">暂无测试样例</p>
          <p className="text-xs mt-1">添加样例后可批量运行验证技能稳定性</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tc, idx) => (
            <div
              key={tc.id}
              className={`rounded-xl border transition-colors ${
                tc.status === 'pass'
                  ? 'bg-green-950/10 border-green-800/30'
                  : tc.status === 'fail'
                  ? 'bg-red-950/20 border-red-800/40'
                  : 'bg-slate-800/40 border-slate-700/60'
              }`}
            >
              <div className="flex items-center gap-2.5 p-3">
                <span className="text-[9px] text-slate-600 font-mono w-5 flex-shrink-0">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <pre className="text-[9px] text-slate-400 font-mono truncate">
                    {tc.input.slice(0, 80)}
                  </pre>
                </div>
                <StatusBadge status={tc.status} />
                <button
                  onClick={() => setExpandedId(expandedId === tc.id ? null : tc.id)}
                  className="text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {expandedId === tc.id
                    ? <ChevronUp className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />
                  }
                </button>
                <button
                  onClick={() => handleRemoveCase(tc.id)}
                  className="text-slate-700 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {expandedId === tc.id && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-700/50 pt-2">
                  <div>
                    <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-0.5">输入</p>
                    <pre className="text-[9px] text-slate-400 font-mono bg-slate-900/50 rounded px-2 py-1.5 whitespace-pre-wrap">
                      {tc.input}
                    </pre>
                  </div>
                  {tc.expectedOutput && (
                    <div>
                      <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-0.5">期望输出</p>
                      <pre className="text-[9px] text-slate-500 font-mono bg-slate-900/50 rounded px-2 py-1.5 whitespace-pre-wrap">
                        {tc.expectedOutput}
                      </pre>
                    </div>
                  )}
                  {tc.actualOutput && (
                    <div>
                      <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-0.5">实际输出</p>
                      <pre className={`text-[9px] font-mono bg-slate-900/50 rounded px-2 py-1.5 whitespace-pre-wrap ${
                        tc.status === 'pass' ? 'text-green-400/80' : 'text-red-400/80'
                      }`}>
                        {tc.actualOutput}
                      </pre>
                    </div>
                  )}
                  {tc.errorMessage && (
                    <div>
                      <p className="text-[9px] text-red-600 font-mono uppercase tracking-wider mb-0.5">错误</p>
                      <p className="text-[9px] text-red-400 font-mono">{tc.errorMessage}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
