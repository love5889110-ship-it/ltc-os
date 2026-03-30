'use client'

import type { FeedbackSample, FeedbackType } from '../../types'
import { FeedbackSampleCard } from './FeedbackSampleCard'

interface Props {
  samples: FeedbackSample[]
  loading?: boolean
  onSelect: (sample: FeedbackSample) => void
}

export function FeedbackSampleList({ samples, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-800/30 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-600">
        <p className="text-sm">暂无反馈样本</p>
        <p className="text-xs mt-1">人工审批/驳回 AI 建议后，样本自动沉淀到此处</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {samples.map((s) => (
        <FeedbackSampleCard key={s.id} sample={s} onClick={onSelect} />
      ))}
    </div>
  )
}
