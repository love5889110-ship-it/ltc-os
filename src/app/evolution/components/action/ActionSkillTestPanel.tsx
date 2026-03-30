'use client'

import { useState, useEffect } from 'react'
import { Play, CheckCircle, XCircle, Clock, AlertTriangle, Plus, ChevronDown } from 'lucide-react'
import type { ActionSkill, SkillExecutionLog } from '../../types'
import { testActionSkill } from '../../services'
import { formatRelativeTime } from '@/lib/utils'

interface WorkspaceOption {
  id: string
  label: string  // "客户名·商机名"
  stage: string
  healthScore: number
}

interface Props {
  skill: ActionSkill
  onLogAdded: (log: SkillExecutionLog) => void
  onAddToFeedback: (log: SkillExecutionLog) => void
}

export function ActionSkillTestPanel({ skill, onLogAdded, onAddToFeedback }: Props) {
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [selectedWsId, setSelectedWsId] = useState<string>('')
  const [inputFields, setInputFields] = useState<Record<string, string>>({})
  const [showRawJson, setShowRawJson] = useState(false)
  const [rawJson, setRawJson] = useState(JSON.stringify(skill.inputSchema ?? {}, null, 2))
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [lastLog, setLastLog] = useState<SkillExecutionLog | null>(null)

  // 加载商机列表用于测试
  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => r.json())
      .then((data) => {
        const list: WorkspaceOption[] = (data.workspaces ?? []).map((ws: any) => ({
          id: ws.id,
          label: `${ws.customerName ?? '未知客户'} · ${ws.opportunityName ?? '未知商机'}`,
          stage: ws.currentStage ?? ws.opportunity?.stage ?? '未知阶段',
          healthScore: ws.healthScore ?? 0,
        }))
        setWorkspaces(list)
        if (list.length > 0 && !selectedWsId) {
          setSelectedWsId(list[0].id)
          prefillFromWorkspace(list[0])
        }
      })
      .catch(() => {})
  }, [])

  // 根据选中商机自动填充参数
  const prefillFromWorkspace = (ws: WorkspaceOption) => {
    const props = (skill.inputSchema as any)?.properties ?? {}
    const filled: Record<string, string> = {}
    Object.keys(props).forEach((k) => {
      const kLow = k.toLowerCase()
      if (kLow.includes('workspace') || kLow.includes('ws_id') || kLow.includes('workspaceid')) {
        filled[k] = ws.id
      } else if (kLow.includes('stage') || kLow.includes('阶段')) {
        filled[k] = ws.stage
      } else if (kLow.includes('customer') || kLow.includes('客户')) {
        filled[k] = ws.label.split(' · ')[0] ?? ''
      } else if (kLow.includes('opportunity') || kLow.includes('商机')) {
        filled[k] = ws.label.split(' · ')[1] ?? ''
      } else {
        filled[k] = inputFields[k] ?? ''
      }
    })
    setInputFields(filled)
  }

  const handleWsChange = (wsId: string) => {
    setSelectedWsId(wsId)
    const ws = workspaces.find((w) => w.id === wsId)
    if (ws) prefillFromWorkspace(ws)
  }

  const getTestInput = (): Record<string, unknown> => {
    if (showRawJson) {
      try { return JSON.parse(rawJson) } catch { return {} }
    }
    const input: Record<string, unknown> = { ...inputFields }
    if (selectedWsId) input.workspaceId = selectedWsId
    return input
  }

  const handleRun = async () => {
    if (showRawJson) {
      try { JSON.parse(rawJson) } catch { setJsonError('JSON 格式错误'); return }
    }
    setRunning(true)
    setLastLog(null)
    const log = await testActionSkill(skill, getTestInput())
    setLastLog(log)
    onLogAdded(log)
    setRunning(false)
  }

  const inputProps = Object.entries((skill.inputSchema as any)?.properties ?? {})
  const canRun = skill.status !== 'disabled'

  return (
    <div className="space-y-3">
      {skill.status === 'disabled' && (
        <div className="flex items-center gap-2 bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <p className="text-[11px] text-red-400">技能已停用，无法调试</p>
        </div>
      )}

      {/* 选择商机（业务友好方式） */}
      {workspaces.length > 0 && (
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block mb-1.5">
            选择测试商机（自动填入参数）
          </label>
          <div className="relative">
            <select
              value={selectedWsId}
              onChange={(e) => handleWsChange(e.target.value)}
              className="w-full text-xs bg-slate-800/60 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.label} — {ws.stage}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          </div>
        </div>
      )}

      {/* 参数填写 */}
      {!showRawJson && inputProps.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block">
            测试参数
          </label>
          {inputProps.map(([k, v]) => (
            <div key={k}>
              <label className="text-[9px] text-slate-600 block mb-0.5">
                <code className="text-cyan-500">{k}</code>
                <span className="ml-1 text-slate-700">{(v as any)?.description}</span>
              </label>
              <input
                value={inputFields[k] ?? ''}
                onChange={(e) => setInputFields({ ...inputFields, [k]: e.target.value })}
                placeholder={(v as any)?.example ?? `输入 ${k}`}
                disabled={!canRun || running}
                className="w-full text-xs bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 placeholder-slate-600 disabled:opacity-50"
              />
            </div>
          ))}
        </div>
      )}

      {/* 高级：手写 JSON 模式 */}
      {showRawJson && (
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block mb-1.5">
            自定义参数 (JSON)
          </label>
          <textarea
            value={rawJson}
            onChange={(e) => {
              setRawJson(e.target.value)
              try { JSON.parse(e.target.value); setJsonError(null) }
              catch { setJsonError('JSON 格式错误') }
            }}
            rows={6}
            disabled={!canRun || running}
            className={`w-full text-xs font-mono bg-slate-800/60 border ${
              jsonError ? 'border-red-600' : 'border-slate-700'
            } text-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 resize-y disabled:opacity-50`}
            spellCheck={false}
          />
          {jsonError && <p className="text-[10px] text-red-400 mt-0.5">{jsonError}</p>}
        </div>
      )}

      {/* 切换高级模式 */}
      <button
        onClick={() => setShowRawJson(!showRawJson)}
        className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors"
      >
        {showRawJson ? '← 返回业务填写模式' : '高级：手动编辑 JSON 参数 →'}
      </button>

      {/* 运行按钮 */}
      <button
        onClick={handleRun}
        disabled={!canRun || running || (showRawJson && !!jsonError)}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
      >
        {running ? (
          <><Play className="w-3.5 h-3.5 animate-pulse" />运行中...</>
        ) : (
          <><Play className="w-3.5 h-3.5" />执行测试</>
        )}
      </button>

      {/* 结果 */}
      {lastLog && (
        <div className={`rounded-xl border p-3 space-y-2 ${
          lastLog.status === 'success'
            ? 'bg-green-950/20 border-green-800/50'
            : 'bg-red-950/20 border-red-800/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {lastLog.status === 'success'
                ? <CheckCircle className="w-4 h-4 text-green-400" />
                : <XCircle className="w-4 h-4 text-red-400" />
              }
              <span className={`text-xs font-semibold ${lastLog.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {lastLog.status === 'success' ? '执行成功' : '执行失败'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-500 font-mono">{lastLog.durationMs}ms</span>
            </div>
          </div>

          {lastLog.output && (
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wider font-mono mb-1">输出结果</p>
              <pre className="text-[10px] text-slate-300 font-mono bg-slate-900/60 rounded-lg p-2 overflow-auto max-h-40 whitespace-pre-wrap leading-relaxed">
                {lastLog.output}
              </pre>
            </div>
          )}

          {lastLog.errorMessage && (
            <div>
              <p className="text-[9px] text-red-600 uppercase tracking-wider font-mono mb-1">错误信息</p>
              <p className="text-[10px] text-red-400 font-mono">{lastLog.errorMessage}</p>
            </div>
          )}

          {lastLog.status === 'failed' && (
            <button
              onClick={() => onAddToFeedback(lastLog)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-orange-400 border border-orange-800/60 rounded-lg hover:bg-orange-900/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              加入反馈候选（帮助改进技能）
            </button>
          )}
        </div>
      )}
    </div>
  )
}
