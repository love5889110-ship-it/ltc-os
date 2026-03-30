'use client'

import { CheckCircle, XCircle, Clock, Plus } from 'lucide-react'
import type { SkillExecutionLog } from '../../types'
import { formatRelativeTime } from '@/lib/utils'

interface Props {
  logs: SkillExecutionLog[]
  skillId?: string
  onAddToFeedback: (log: SkillExecutionLog) => void
}

export function ActionSkillExecutionLogPanel({ logs, skillId, onAddToFeedback }: Props) {
  const filtered = skillId ? logs.filter((l) => l.skillId === skillId) : logs

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600">
        <p className="text-sm">暂无执行日志</p>
        <p className="text-xs mt-1">调试技能后，日志将自动记录在此处</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono">{filtered.length} 条执行记录</p>
      {[...filtered].reverse().map((log) => (
        <div
          key={log.id}
          className={`rounded-xl border p-3 ${
            log.status === 'success'
              ? 'bg-slate-800/40 border-slate-700/60'
              : 'bg-red-950/20 border-red-800/50'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {/* 状态图标 */}
            {log.status === 'success'
              ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
              : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            }
            <div className="flex-1 min-w-0">
              {/* 头部信息 */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[9px] font-semibold ${log.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {log.status === 'success' ? '成功' : '失败'}
                </span>
                <Clock className="w-2.5 h-2.5 text-slate-600" />
                <span className="text-[9px] text-slate-600 font-mono">{log.durationMs}ms</span>
                <span className="text-[9px] text-slate-600">{formatRelativeTime(log.createdAt)}</span>
              </div>

              {/* 输入 */}
              <div className="mb-1.5">
                <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-0.5">输入</p>
                <pre className="text-[9px] text-slate-400 font-mono bg-slate-900/50 rounded px-2 py-1 overflow-hidden whitespace-nowrap text-ellipsis max-w-full">
                  {log.input.slice(0, 120)}
                </pre>
              </div>

              {/* 输出 / 错误 */}
              {log.status === 'success' && log.output && (
                <div>
                  <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider mb-0.5">输出</p>
                  <pre className="text-[9px] text-green-400/70 font-mono bg-slate-900/50 rounded px-2 py-1 overflow-hidden whitespace-nowrap text-ellipsis max-w-full">
                    {log.output.slice(0, 120)}
                  </pre>
                </div>
              )}
              {log.status === 'failed' && log.errorMessage && (
                <div>
                  <p className="text-[9px] text-red-600 font-mono uppercase tracking-wider mb-0.5">错误</p>
                  <p className="text-[10px] text-red-400 font-mono">{log.errorMessage}</p>
                </div>
              )}

              {/* 失败日志操作 */}
              {log.status === 'failed' && (
                <button
                  onClick={() => onAddToFeedback(log)}
                  className="mt-2 flex items-center gap-1 text-[9px] text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                  加入反馈候选
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
