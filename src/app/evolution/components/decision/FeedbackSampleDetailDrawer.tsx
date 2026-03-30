'use client'

import { useState } from 'react'
import { X, ThumbsUp, ThumbsDown, ChevronDown } from 'lucide-react'
import type { FeedbackSample, FeedbackType, WritebackTarget } from '../../types'
import { SAMPLE_TYPE_LABELS, FEEDBACK_TYPE_LABELS, WRITEBACK_TARGET_LABELS } from '../../types'
import { formatRelativeTime } from '@/lib/utils'

interface Props {
  sample: FeedbackSample | null
  onClose: () => void
  onAdopt: (id: string, writebackTarget: WritebackTarget) => void
  onReject: (id: string) => void
}

export function FeedbackSampleDetailDrawer({ sample, onClose, onAdopt, onReject }: Props) {
  const [writebackTarget, setWritebackTarget] = useState<WritebackTarget>('none')
  const [comment, setComment] = useState('')

  if (!sample) return null

  const handleAdopt = () => {
    onAdopt(sample.id, writebackTarget)
    onClose()
  }

  const handleReject = () => {
    onReject(sample.id)
    onClose()
  }

  const feedbackColors: Record<string, string> = {
    adopted:  'bg-green-900/40 text-green-300 border-green-700',
    rejected: 'bg-red-900/40 text-red-300 border-red-700',
    pending:  'bg-yellow-900/40 text-yellow-300 border-yellow-700',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">反馈样本详情</h2>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${feedbackColors[sample.feedbackType]}`}>
              {FEEDBACK_TYPE_LABELS[sample.feedbackType]}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Meta */}
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="bg-slate-700/50 px-2 py-0.5 rounded">{sample.agentName}</span>
            {sample.sampleType && (
              <span className="bg-indigo-900/40 text-indigo-400 px-2 py-0.5 rounded">
                {SAMPLE_TYPE_LABELS[sample.sampleType]}
              </span>
            )}
            <span>{formatRelativeTime(sample.createdAt)}</span>
          </div>

          {/* 原始输入 */}
          <section>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">原始输入</p>
            <pre className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed overflow-auto max-h-36">
              {sample.inputSnapshot}
            </pre>
          </section>

          {/* 原始输出 */}
          <section>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">原始输出</p>
            <pre className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed overflow-auto max-h-36">
              {sample.outputSnapshot}
            </pre>
          </section>

          {/* 关联信息 */}
          {(sample.decisionId || sample.ruleId || sample.skillId || sample.actionName) && (
            <section>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">关联对象</p>
              <div className="space-y-1 text-xs text-slate-400">
                {sample.decisionId && <p>决策 ID：<span className="font-mono text-slate-300">{sample.decisionId}</span></p>}
                {sample.ruleId && <p>规则 ID：<span className="font-mono text-slate-300">{sample.ruleId}</span></p>}
                {sample.skillId && <p>技能 ID：<span className="font-mono text-slate-300">{sample.skillId}</span></p>}
                {sample.actionName && <p>动作名称：<span className="text-slate-300">{sample.actionName}</span></p>}
              </div>
            </section>
          )}

          {/* 反馈意见 */}
          {sample.feedbackComment && (
            <section>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">反馈意见</p>
              <p className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                {sample.feedbackComment}
              </p>
            </section>
          )}

          {/* 写回目标 */}
          {sample.feedbackType === 'pending' && (
            <section>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">写回目标</p>
              <div className="relative">
                <select
                  value={writebackTarget}
                  onChange={(e) => setWritebackTarget(e.target.value as WritebackTarget)}
                  className="w-full text-xs bg-slate-800 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 appearance-none pr-8 cursor-pointer"
                >
                  {Object.entries(WRITEBACK_TARGET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
              {writebackTarget !== 'none' && (
                <p className="text-[10px] text-indigo-400 mt-1.5">
                  ✓ 采纳后将写回到：{WRITEBACK_TARGET_LABELS[writebackTarget]}
                </p>
              )}
            </section>
          )}
        </div>

        {/* Footer：操作按钮（仅 pending 状态可操作） */}
        {sample.feedbackType === 'pending' && (
          <div className="px-5 py-4 border-t border-slate-800 flex gap-3">
            <button
              onClick={handleReject}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-red-900/40 border border-slate-700 hover:border-red-700 text-slate-300 hover:text-red-300 rounded-xl text-xs font-medium transition-all"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              驳回
            </button>
            <button
              onClick={handleAdopt}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              采纳{writebackTarget !== 'none' ? ' + 写回' : ''}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
