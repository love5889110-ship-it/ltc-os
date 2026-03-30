'use client'

import type { SampleType, FeedbackType } from '../../types'
import { SAMPLE_TYPE_LABELS, FEEDBACK_TYPE_LABELS } from '../../types'
import { AGENT_LABELS } from '@/lib/utils'

interface Props {
  agentFilter: string
  feedbackTypeFilter: FeedbackType | 'all'
  sampleTypeFilter: string
  onAgentChange: (v: string) => void
  onFeedbackTypeChange: (v: FeedbackType | 'all') => void
  onSampleTypeChange: (v: string) => void
}

export function FeedbackFilterBar({
  agentFilter, feedbackTypeFilter, sampleTypeFilter,
  onAgentChange, onFeedbackTypeChange, onSampleTypeChange,
}: Props) {
  const agentOptions = [
    { value: 'all', label: '全部员工' },
    ...Object.entries(AGENT_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ]

  const feedbackOptions: Array<{ value: FeedbackType | 'all'; label: string }> = [
    { value: 'all',     label: '全部类型' },
    { value: 'adopted', label: '已采纳' },
    { value: 'rejected', label: '已驳回' },
    { value: 'pending', label: '待处理' },
  ]

  const sampleOptions = [
    { value: 'all', label: '全部类型' },
    ...Object.entries(SAMPLE_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ]

  const selectCls = 'text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-slate-600 uppercase tracking-wider font-mono">筛选</span>
      <select value={agentFilter} onChange={(e) => onAgentChange(e.target.value)} className={selectCls}>
        {agentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={feedbackTypeFilter} onChange={(e) => onFeedbackTypeChange(e.target.value as FeedbackType | 'all')} className={selectCls}>
        {feedbackOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={sampleTypeFilter} onChange={(e) => onSampleTypeChange(e.target.value)} className={selectCls}>
        {sampleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
