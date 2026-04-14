'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Check, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

interface RuleSuggestion {
  id: string
  agentType: string
  ruleType: 'forbid' | 'require' | 'prefer'
  condition: string
  instruction: string
  rationale: string | null
  status: string
  createdAt: string | null
}

const AGENT_LABELS: Record<string, string> = {
  coordinator: '总控',
  sales: '销售',
  presales_assistant: '售前',
  tender_assistant: '招标',
  handover: '交付',
  service_triage: '服务',
  asset_governance: '资产',
}

const RULE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  forbid: { label: '禁止', color: 'bg-red-100 text-red-700' },
  require: { label: '必须', color: 'bg-blue-100 text-blue-700' },
  prefer: { label: '建议', color: 'bg-amber-100 text-amber-700' },
}

export function RuleSuggestionsBanner() {
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/rule-suggestions')
    const data = await res.json()
    setSuggestions(data.suggestions ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    await fetch('/api/rule-suggestions', { method: 'POST' })
    await load()
    setGenerating(false)
  }

  const handleAccept = async (s: RuleSuggestion) => {
    setProcessing(s.id)
    await fetch('/api/rule-suggestions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionId: s.id, action: 'accept' }),
    })
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id))
    setProcessing(null)
  }

  const handleDismiss = async (id: string) => {
    setProcessing(id)
    await fetch('/api/rule-suggestions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionId: id, action: 'dismiss' }),
    })
    setSuggestions((prev) => prev.filter((x) => x.id !== id))
    setProcessing(null)
  }

  if (!loading && suggestions.length === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-400">
        <Sparkles className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span>暂无规则候选。系统会在每日巡检后自动从被驳回/修改的样本中提炼。</span>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs text-slate-300 disabled:opacity-50"
        >
          {generating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          立即提炼
        </button>
      </div>
    )
  }

  return (
    <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-800/30">
        <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-sm font-medium text-amber-300">
          AI 纠偏提炼
          {suggestions.length > 0 && (
            <span className="ml-2 bg-amber-500 text-amber-950 text-xs px-1.5 py-0.5 rounded-full font-bold">{suggestions.length}</span>
          )}
        </span>
        <span className="text-xs text-amber-600 flex-1">根据被驳回/修改的样本自动生成，确认后写入规则库</span>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-1 px-2.5 py-1 bg-amber-900/50 hover:bg-amber-900 border border-amber-700/50 rounded-lg text-xs text-amber-300 disabled:opacity-50"
        >
          {generating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          重新提炼
        </button>
        <button onClick={() => setExpanded((v) => !v)} className="text-amber-600 hover:text-amber-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 候选列表 */}
      {expanded && (
        <div className="divide-y divide-amber-900/30">
          {loading ? (
            <div className="py-4 text-center text-xs text-slate-500">加载中...</div>
          ) : (
            suggestions.map((s) => {
              const rt = RULE_TYPE_LABELS[s.ruleType] ?? { label: s.ruleType, color: 'bg-gray-100 text-gray-700' }
              return (
                <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${rt.color}`}>{rt.label}</span>
                      <span className="text-xs text-slate-400 font-medium">{AGENT_LABELS[s.agentType] ?? s.agentType} Agent</span>
                      <span className="text-xs text-slate-500">当：{s.condition}</span>
                    </div>
                    <p className="text-sm text-slate-200 leading-snug">{s.instruction}</p>
                    {s.rationale && (
                      <p className="text-xs text-slate-500 leading-snug">{s.rationale}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(s)}
                      disabled={processing === s.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-green-900/60 hover:bg-green-800 border border-green-700/50 rounded-lg text-xs text-green-300 disabled:opacity-50"
                    >
                      {processing === s.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      采纳
                    </button>
                    <button
                      onClick={() => handleDismiss(s.id)}
                      disabled={processing === s.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600/50 rounded-lg text-xs text-slate-400 disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                      忽略
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
