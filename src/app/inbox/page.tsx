'use client'

import { useState, useEffect, useCallback } from 'react'
import { Inbox, Filter, RefreshCw, Plus, CheckCircle, XCircle, Link2 } from 'lucide-react'
import {
  SIGNAL_TYPE_LABELS,
  SIGNAL_STATUS_LABELS,
  signalTypeColor,
  statusColor,
  formatRelativeTime,
} from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'

interface Signal {
  id: string
  sourceType: string
  contentSummary: string | null
  signalType: string | null
  priority: number | null
  confidenceScore: number | null
  status: string
  eventTime: string | null
  createdAt: string | null
  binding?: {
    bindingStatus: string
    bindingConfidence: number | null
    bindingCandidatesJson: unknown[]
  } | null
}

const STATUS_FILTERS = ['all', 'unbound', 'pending_confirm', 'bound', 'triggered', 'closed']
const TYPE_FILTERS = ['all', 'demand', 'risk', 'opportunity', 'blocker', 'escalation', 'info']

export default function InboxPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [showIngest, setShowIngest] = useState(false)
  const [ingestText, setIngestText] = useState('')
  const [ingestSource, setIngestSource] = useState('get_note')
  const [ingesting, setIngesting] = useState(false)
  const [confirmingSignal, setConfirmingSignal] = useState<Signal | null>(null)
  const [allOpportunities, setAllOpportunities] = useState<{ id: string; name: string }[]>([])
  const [selectedOppId, setSelectedOppId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    const res = await fetch(`/api/signals?${params}`)
    const data = await res.json()
    setSignals(data.signals ?? [])
    setLoading(false)
  }, [statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  const handleConfirm = async (signalId: string, opportunityId?: string) => {
    await fetch(`/api/signals/${signalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', opportunityId: opportunityId ?? null }),
    })
    load()
    setSelectedSignal(null)
    setConfirmingSignal(null)
    setSelectedOppId('')
  }

  const openConfirmModal = async (signal: Signal) => {
    setConfirmingSignal(signal)
    setSelectedOppId(
      (signal.binding?.bindingCandidatesJson as any[])?.[0]?.id ?? ''
    )
    if (allOpportunities.length === 0) {
      const res = await fetch('/api/opportunities')
      const data = await res.json()
      setAllOpportunities(data.opportunities ?? [])
    }
  }

  const handleIgnore = async (signalId: string) => {
    await fetch(`/api/signals/${signalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignore' }),
    })
    load()
    setSelectedSignal(null)
  }

  const handleIngest = async () => {
    if (!ingestText.trim()) return
    setIngesting(true)
    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: ingestSource, rawContent: ingestText }),
      })
      if (res.ok) {
        setIngestText('')
        setShowIngest(false)
        load()
      }
    } finally {
      setIngesting(false)
    }
  }

  const counts = {
    all: signals.length,
    unbound: signals.filter((s) => s.status === 'unbound').length,
    pending_confirm: signals.filter((s) => s.status === 'pending_confirm').length,
    bound: signals.filter((s) => s.status === 'bound').length,
  }

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Inbox className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold">AI 收件箱</h1>
            <span className="text-sm text-gray-500">
              {counts.pending_confirm > 0 && (
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {counts.pending_confirm} 待确认
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <button
              onClick={() => setShowIngest(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              手动录入信号
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">状态</span>
            <div className="flex gap-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {s === 'all' ? '全部' : SIGNAL_STATUS_LABELS[s]}
                  {s === 'pending_confirm' && counts.pending_confirm > 0 && (
                    <span className="ml-1 bg-yellow-500 text-white rounded-full px-1 text-xs">
                      {counts.pending_confirm}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">类型</span>
            <div className="flex gap-1">
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    typeFilter === t
                      ? 'bg-gray-200 text-gray-800 font-medium'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {t === 'all' ? '全部' : SIGNAL_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Signal list */}
        <div className="flex-1 overflow-auto">
          <div className="px-6 pt-4">
            <PageGuide
              role="销售"
              what="销售与客户/渠道的沟通内容经 AI 处理后在此汇聚，每条信号需确认归属到具体商机"
              firstStep="点击「待确认」筛选器，找到新信号，查看 AI 建议的商机归属，确认或修改后点击「确认归属」"
              storageKey="inbox"
            />
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">加载中...</div>
          ) : signals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Inbox className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">暂无信号</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  onClick={() => setSelectedSignal(signal)}
                  className={`px-6 py-4 cursor-pointer hover:bg-blue-50 transition-colors ${
                    selectedSignal?.id === signal.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {signal.signalType && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${signalTypeColor(signal.signalType)}`}>
                            {SIGNAL_TYPE_LABELS[signal.signalType]}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs ${statusColor(signal.status)}`}>
                          {SIGNAL_STATUS_LABELS[signal.status]}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">{signal.sourceType.replace('_', ' ')}</span>
                        {signal.priority && signal.priority >= 4 && (
                          <span className="text-xs text-red-600 font-medium">P{signal.priority}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 line-clamp-2">
                        {signal.contentSummary ?? '（无摘要）'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-gray-400">{formatRelativeTime(signal.createdAt)}</span>
                        {signal.confidenceScore && (
                          <span className="text-xs text-gray-400">
                            置信度 {Math.round(signal.confidenceScore * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {signal.status === 'pending_confirm' && (
                      <div className="flex gap-1 flex-shrink-0 mt-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); openConfirmModal(signal) }}
                          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                          title="确认归属"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleIgnore(signal.id) }}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                          title="忽略"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedSignal && (
        <div className="w-80 border-l bg-white flex flex-col">
          <div className="px-4 py-4 border-b flex items-center justify-between">
            <h2 className="font-medium text-sm">信号详情</h2>
            <button onClick={() => setSelectedSignal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>
          <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">摘要</p>
              <p className="text-sm">{selectedSignal.contentSummary ?? '—'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">类型</p>
                {selectedSignal.signalType ? (
                  <span className={`px-2 py-0.5 rounded text-xs ${signalTypeColor(selectedSignal.signalType)}`}>
                    {SIGNAL_TYPE_LABELS[selectedSignal.signalType]}
                  </span>
                ) : '—'}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">状态</p>
                <span className={`px-2 py-0.5 rounded text-xs ${statusColor(selectedSignal.status)}`}>
                  {SIGNAL_STATUS_LABELS[selectedSignal.status]}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">来源</p>
                <p className="text-xs text-gray-700 capitalize">{selectedSignal.sourceType}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">优先级</p>
                <p className="text-xs text-gray-700">P{selectedSignal.priority ?? '—'}</p>
              </div>
            </div>
            {selectedSignal.binding?.bindingCandidatesJson && (
              <div>
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  归属候选
                </p>
                <div className="space-y-1.5">
                  {(selectedSignal.binding.bindingCandidatesJson as any[]).slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-2.5 py-2">
                      <div>
                        <p className="text-xs font-medium">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.type}</p>
                      </div>
                      <span className="text-xs text-blue-600">{Math.round(c.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {selectedSignal.status === 'pending_confirm' && (
            <div className="px-4 py-3 border-t flex gap-2">
              <button
                onClick={() => openConfirmModal(selectedSignal)}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                确认归属
              </button>
              <button
                onClick={() => handleIgnore(selectedSignal.id)}
                className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                忽略
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirm binding modal */}
      {confirmingSignal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
            <h2 className="text-base font-semibold mb-1">确认信号归属</h2>
            <p className="text-xs text-gray-500 mb-4 line-clamp-2">{confirmingSignal.contentSummary}</p>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">归属到哪个商机？</label>
              <select
                value={selectedOppId}
                onChange={(e) => setSelectedOppId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— 不绑定商机 —</option>
                {allOpportunities.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            {confirmingSignal.binding?.bindingCandidatesJson && (confirmingSignal.binding.bindingCandidatesJson as any[]).length > 0 && (
              <div className="mb-4 bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium mb-2">AI 推荐候选</p>
                <div className="space-y-1">
                  {(confirmingSignal.binding.bindingCandidatesJson as any[]).slice(0, 3).map((c: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOppId(c.type === 'opportunity' ? c.id : selectedOppId)}
                      className="w-full flex items-center justify-between bg-white rounded px-2.5 py-1.5 hover:bg-blue-100 transition-colors text-left"
                    >
                      <span className="text-xs font-medium text-gray-700">{c.name}</span>
                      <span className="text-xs text-blue-500">{Math.round(c.confidence * 100)}% 匹配</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setConfirmingSignal(null); setSelectedOppId('') }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handleConfirm(confirmingSignal.id, selectedOppId || undefined)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
              >
                确认归属
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingest modal */}
      {showIngest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">
            <h2 className="text-base font-semibold mb-4">手动录入信号</h2>
            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-1">信号来源</label>
              <select
                value={ingestSource}
                onChange={(e) => setIngestSource(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="get_note">Get 笔记</option>
                <option value="recording">录音转写</option>
                <option value="dingtalk">钉钉</option>
                <option value="file_ocr">文件/OCR</option>
                <option value="manual">手动录入</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">信号内容</label>
              <textarea
                value={ingestText}
                onChange={(e) => setIngestText(e.target.value)}
                placeholder="粘贴会议纪要、沟通记录、需求文档等..."
                className="w-full border rounded-lg px-3 py-2 text-sm h-32 resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowIngest(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleIngest}
                disabled={ingesting || !ingestText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {ingesting ? 'AI 处理中...' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
