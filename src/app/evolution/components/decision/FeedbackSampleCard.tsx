'use client'

import { ThumbsUp, ThumbsDown, Clock, ChevronRight } from 'lucide-react'
import type { FeedbackSample } from '../../types'
import { SAMPLE_TYPE_LABELS, FEEDBACK_TYPE_LABELS } from '../../types'
import { formatRelativeTime } from '@/lib/utils'

interface Props {
  sample: FeedbackSample
  onClick: (sample: FeedbackSample) => void
}

const feedbackColors: Record<string, string> = {
  adopted:  'bg-green-900/40 text-green-300 border-green-800/60',
  rejected: 'bg-red-900/40 text-red-300 border-red-800/60',
  pending:  'bg-yellow-900/40 text-yellow-300 border-yellow-800/60',
}

const sampleTypeColors: Record<string, string> = {
  task_understanding:    'bg-blue-900/30 text-blue-400',
  rule_match:            'bg-purple-900/30 text-purple-400',
  action_recommendation: 'bg-teal-900/30 text-teal-400',
  skill_routing:         'bg-cyan-900/30 text-cyan-400',
  risk_assessment:       'bg-orange-900/30 text-orange-400',
  execution:             'bg-slate-700/60 text-slate-400',
}

export function FeedbackSampleCard({ sample, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(sample)}
      className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl p-3 transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* 标签行 */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${feedbackColors[sample.feedbackType] ?? feedbackColors.pending}`}>
              {FEEDBACK_TYPE_LABELS[sample.feedbackType]}
            </span>
            {sample.sampleType && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${sampleTypeColors[sample.sampleType] ?? sampleTypeColors.execution}`}>
                {SAMPLE_TYPE_LABELS[sample.sampleType]}
              </span>
            )}
            <span className="text-[9px] text-slate-600 bg-slate-700/50 px-1.5 py-0.5 rounded">
              {sample.agentName}
            </span>
          </div>
          {/* 输入摘要 */}
          <p className="text-xs text-slate-400 truncate leading-relaxed">
            {sample.inputSnapshot.slice(0, 80)}
          </p>
          {/* 时间 */}
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="w-2.5 h-2.5 text-slate-600" />
            <span className="text-[9px] text-slate-600">{formatRelativeTime(sample.createdAt)}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </button>
  )
}
