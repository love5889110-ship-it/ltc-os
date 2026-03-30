'use client'

import { TrendingUp, ThumbsUp, Database } from 'lucide-react'
import type { EvolutionStats } from '../types'

interface Props {
  stats: EvolutionStats
  loading?: boolean
}

export function EvolutionStatsCards({ stats, loading }: Props) {
  const cards = [
    {
      icon: Database,
      label: '反馈样本',
      value: loading ? '—' : String(stats.feedbackCount),
      color: 'blue',
    },
    {
      icon: TrendingUp,
      label: '采纳率',
      value: loading ? '—' : `${Math.round(stats.adoptionRate * 100)}%`,
      color: 'green',
    },
    {
      icon: ThumbsUp,
      label: '已采纳',
      value: loading ? '—' : String(stats.adoptedCount),
      color: 'indigo',
    },
  ]

  const colorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    blue:   { bg: 'bg-blue-950/40',   border: 'border-blue-800/60',   text: 'text-blue-300',   icon: 'text-blue-500' },
    green:  { bg: 'bg-green-950/40',  border: 'border-green-800/60',  text: 'text-green-300',  icon: 'text-green-500' },
    indigo: { bg: 'bg-indigo-950/40', border: 'border-indigo-800/60', text: 'text-indigo-300', icon: 'text-indigo-500' },
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => {
        const c = colorMap[card.color]
        const Icon = card.icon
        return (
          <div key={card.label} className={`rounded-xl border p-3 ${c.bg} ${c.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
              <span className="text-[11px] text-slate-500">{card.label}</span>
            </div>
            <p className={`text-2xl font-black font-mono ${c.text}`}>{card.value}</p>
          </div>
        )
      })}
    </div>
  )
}
