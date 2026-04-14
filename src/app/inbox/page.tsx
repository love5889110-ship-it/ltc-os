'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Radio, RefreshCw, Plus, CheckCircle, XCircle, Link2, Upload, FileText, Image, X, Plug, ChevronDown, Inbox, Square, CheckSquare } from 'lucide-react'
import {
  SIGNAL_TYPE_LABELS,
  SIGNAL_STATUS_LABELS,
  signalTypeColor,
  statusColor,
  formatRelativeTime,
} from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'
import { Breadcrumb } from '@/components/ui/breadcrumb'

interface Signal {
  id: string
  sourceType: string
  rawContent: string | null
  contentSummary: string | null
  signalType: string | null
  priority: number | null
  confidenceScore: number | null
  status: string
  eventTime: string | null
  createdAt: string | null
  parsedEntitiesJson?: {
    keyPoints?: string[]
    riskFlags?: string[]
    customerNames?: string[]
    competitorMentions?: string[]
    amounts?: string[]
    deadlines?: string[]
  } | null
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
  const [statusFilter, setStatusFilter] = useState('pending_confirm')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [showIngest, setShowIngest] = useState(false)
  const [showIngestDropdown, setShowIngestDropdown] = useState(false)
  const [ingestText, setIngestText] = useState('')
  const [ingestSource, setIngestSource] = useState('manual')
  const [ingesting, setIngesting] = useState(false)
  const [confirmingSignal, setConfirmingSignal] = useState<Signal | null>(null)
  const [allOpportunities, setAllOpportunities] = useState<{ id: string; name: string }[]>([])
  const [selectedOppId, setSelectedOppId] = useState('')
  const [oppSearchQ, setOppSearchQ] = useState('')
  const [createMode, setCreateMode] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newOppName, setNewOppName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadLabel, setUploadLabel] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ summary?: string; fileName?: string; extractedLength?: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [syncing, setSyncing] = useState(false)
  const [ignoringSignalId, setIgnoringSignalId] = useState<string | null>(null)
  const [ignoreReason, setIgnoreReason] = useState('')
  const [confirmedWorkspaceId, setConfirmedWorkspaceId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const router = useRouter()

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
    setCreateMode(false)
    setNewCustomerName('')
    setNewOppName('')
    setCreatedWorkspaceId(null)
    // Show "进入战场" toast if we have an opportunityId
    if (opportunityId) {
      try {
        const wsRes = await fetch(`/api/workspaces?limit=100`)
        const wsData = await wsRes.json()
        const ws = (wsData.workspaces ?? []).find((w: any) => w.workspace?.opportunityId === opportunityId || w.opportunityId === opportunityId)
        const wsId = ws?.workspace?.id ?? ws?.id
        if (wsId) setConfirmedWorkspaceId(wsId)
      } catch { /* ignore */ }
    }
  }

  const handleConfirmAndCreateWorkspace = async () => {
    if (!confirmingSignal) return
    setCreating(true)
    try {
      // 1. Create opportunity (+ customer if needed)
      const oppRes = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOppName.trim(), customerName: newCustomerName.trim() }),
      })
      const oppData = await oppRes.json()
      if (!oppData.opportunityId) throw new Error('创建商机失败')

      // 2. Create workspace
      const wsRes = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: oppData.opportunityId }),
      })
      const wsData = await wsRes.json()

      // 3. Bind signal
      await fetch(`/api/signals/${confirmingSignal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', opportunityId: oppData.opportunityId }),
      })

      load()
      setSelectedSignal(null)
      setConfirmingSignal(null)
      setCreateMode(false)
      setNewCustomerName('')
      setNewOppName('')
      if (wsData.workspaceId) {
        setCreatedWorkspaceId(wsData.workspaceId)
      }
    } finally {
      setCreating(false)
    }
  }

  const openConfirmModal = async (signal: Signal) => {
    setConfirmingSignal(signal)
    setCreateMode(false)
    setNewCustomerName('')
    setNewOppName('')
    setCreatedWorkspaceId(null)
    setSelectedOppId(
      (signal.binding?.bindingCandidatesJson as any[])?.[0]?.id ?? ''
    )
    if (allOpportunities.length === 0) {
      const res = await fetch('/api/opportunities')
      const data = await res.json()
      setAllOpportunities(data.opportunities ?? [])
    }
    setOppSearchQ('')
  }

  const handleIgnore = async (signalId: string, reason?: string) => {
    await fetch(`/api/signals/${signalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignore', ignoreReason: reason }),
    })
    load()
    setSelectedSignal(null)
    setIgnoringSignalId(null)
    setIgnoreReason('')
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadError(null)
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('sourceType', 'file_upload')
      formData.append('fileLabel', uploadLabel)
      const res = await fetch('/api/signals/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error ?? '上传失败')
      } else {
        setUploadResult({ summary: data.normalized?.summary, fileName: data.fileName, extractedLength: data.extractedLength })
        load()
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkDeleting(true)
    // [P0-5/P0-6] Use PATCH ignore instead of DELETE to preserve training signals
    await fetch('/api/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignore', ids: Array.from(selectedIds), ignoreReason: 'bulk_ignored' }),
    })
    setBulkDeleting(false)
    setSelectedIds(new Set())
    setSelectedSignal(null)
    load()
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === signals.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(signals.map((s) => s.id)))
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
            <Radio className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold">信号台</h1>
            <span className="text-sm text-gray-500">
              {counts.pending_confirm > 0 && (
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {counts.pending_confirm} 待确认
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors"
            >
              <Plug className="w-3.5 h-3.5" />
              连接器
            </button>
            <div className="relative">
              <button
                onClick={() => setShowIngestDropdown(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                接入信号
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showIngestDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowIngestDropdown(false)} />
                  <div className="absolute right-0 top-10 z-20 bg-white border rounded-xl shadow-lg w-44 overflow-hidden">
                    <button
                      onClick={() => { setShowIngestDropdown(false); setShowUpload(true); setUploadFile(null); setUploadResult(null); setUploadError(null) }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-gray-400" />
                      上传文件
                    </button>
                    <button
                      onClick={() => { setShowIngestDropdown(false); setShowIngest(true) }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="w-3.5 h-3.5 text-gray-400" />
                      手动录入
                    </button>
                    <div className="border-t my-1" />
                    <a
                      href="/settings"
                      onClick={() => setShowIngestDropdown(false)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      接入钉钉 / 企微
                    </a>
                  </div>
                </>
              )}
            </div>
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
            <Breadcrumb items={[{ label: '商机推进' }, { label: '信号台' }]} />
            <PageGuide
              storageKey="inbox"
              contents={{
                sales: {
                  roleLabel: '销售',
                  purpose: '待裁决的 AI 感知信号队列',
                  whenToUse: '每次客户有动态、有会议记录或收到文件后来这里',
                  aiAlreadyDid: '已将原始内容标准化为结构化信号，并给出推荐归属商机和置信度',
                  youDecide: '确认 AI 归属是否准确，或指定正确商机；必要时忽略并说明原因',
                  dontDo: '不需要手动录入所有信息，AI 已结构化；不需要去战场页主动找信号',
                  nextStepLabel: '进入战场总览',
                  nextStepHref: '/workspace',
                },
                solution: {
                  roleLabel: '方案经理',
                  purpose: '待裁决的 AI 感知信号队列',
                  whenToUse: '客户发来技术需求或竞品资料后来这里确认',
                  aiAlreadyDid: '已解析信号类型、提取关键实体、生成归属候选',
                  youDecide: '确认是否归属到当前方案商机，有无竞品威胁信号需要跟进',
                  nextStepLabel: '查看待审批动作',
                  nextStepHref: '/intervention',
                },
              }}
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
            <>
              {/* 批量操作栏 */}
              <div className="px-6 py-2 flex items-center gap-3 border-b bg-gray-50">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  {selectedIds.size === signals.length && signals.length > 0
                    ? <CheckSquare className="w-4 h-4 text-blue-600" />
                    : <Square className="w-4 h-4" />
                  }
                  {selectedIds.size === signals.length && signals.length > 0 ? '取消全选' : '全选'}
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-xs text-gray-400">已选 {selectedIds.size} 条</span>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded-lg text-xs hover:bg-gray-600 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {bulkDeleting ? '忽略中...' : '批量忽略'}
                    </button>
                  </>
                )}
              </div>
              <div className="divide-y divide-gray-100">
              {signals.map((signal) => (
                <div
                  key={signal.id}
                  onClick={() => setSelectedSignal(signal)}
                  className={`px-6 py-4 cursor-pointer hover:bg-blue-50 transition-colors ${
                    selectedSignal?.id === signal.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  } ${selectedIds.has(signal.id) ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => toggleSelect(signal.id, e)}
                      className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-blue-600"
                    >
                      {selectedIds.has(signal.id)
                        ? <CheckSquare className="w-4 h-4 text-blue-600" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>
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
                      {/* AI 判断包 */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(signal.parsedEntitiesJson?.riskFlags?.length ?? 0) > 0 && (
                          <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                            风险: {signal.parsedEntitiesJson!.riskFlags![0]}
                          </span>
                        )}
                        {signal.binding?.bindingCandidatesJson && (signal.binding.bindingCandidatesJson as any[]).length > 0 && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            AI推荐: {(signal.binding.bindingCandidatesJson as any[])[0]?.name}（{Math.round(((signal.binding.bindingCandidatesJson as any[])[0]?.confidence ?? 0) * 100)}%）
                          </span>
                        )}
                        {!signal.binding && signal.status === 'unbound' && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">待归属</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-gray-400">{formatRelativeTime(signal.createdAt)}</span>
                        {signal.confidenceScore && (
                          <span className="text-xs text-gray-400">
                            置信度 {Math.round(signal.confidenceScore * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {(signal.status === 'pending_confirm' || signal.status === 'unbound') && (
                      <div className="flex gap-1 flex-shrink-0 mt-0.5">
                        {(signal.status === 'pending_confirm' || signal.status === 'unbound') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openConfirmModal(signal) }}
                            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                            title="批准 AI 归属"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setIgnoringSignalId(signal.id); setIgnoreReason(''); setSelectedSignal(signal) }}
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
            </>
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
            {selectedSignal.rawContent && (
              <div>
                <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1 block">原始内容</label>
                <p className="text-xs text-gray-600 bg-gray-50 rounded px-3 py-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {selectedSignal.rawContent}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">摘要</p>
              <p className="text-sm">{selectedSignal.contentSummary ?? '—'}</p>
            </div>

            {/* 关键信息点 */}
            {selectedSignal.parsedEntitiesJson?.keyPoints && selectedSignal.parsedEntitiesJson.keyPoints.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1.5">关键信息</p>
                <ul className="space-y-1">
                  {selectedSignal.parsedEntitiesJson.keyPoints.map((pt, i) => (
                    <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                      <span className="text-blue-400 mt-0.5 flex-shrink-0">·</span>{pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 风险标记 */}
            {selectedSignal.parsedEntitiesJson?.riskFlags && selectedSignal.parsedEntitiesJson.riskFlags.length > 0 && (
              <div className="bg-red-50 rounded-lg px-3 py-2">
                <p className="text-xs text-red-600 font-medium mb-1">风险信号</p>
                {selectedSignal.parsedEntitiesJson.riskFlags.map((r, i) => (
                  <p key={i} className="text-xs text-red-700">⚠ {r}</p>
                ))}
              </div>
            )}

            {/* 竞品/金额/截止 */}
            {(selectedSignal.parsedEntitiesJson?.competitorMentions?.length ||
              selectedSignal.parsedEntitiesJson?.amounts?.length ||
              selectedSignal.parsedEntitiesJson?.deadlines?.length) && (
              <div className="grid grid-cols-1 gap-2">
                {selectedSignal.parsedEntitiesJson.competitorMentions?.length ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">竞品</p>
                    <p className="text-xs text-orange-600">{selectedSignal.parsedEntitiesJson.competitorMentions.join('、')}</p>
                  </div>
                ) : null}
                {selectedSignal.parsedEntitiesJson.amounts?.length ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">金额/预算</p>
                    <p className="text-xs text-gray-700">{selectedSignal.parsedEntitiesJson.amounts.join('、')}</p>
                  </div>
                ) : null}
                {selectedSignal.parsedEntitiesJson.deadlines?.length ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">时间节点</p>
                    <p className="text-xs text-gray-700">{selectedSignal.parsedEntitiesJson.deadlines.join('、')}</p>
                  </div>
                ) : null}
              </div>
            )}

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

          {/* Action buttons — all statuses except already closed */}
          {selectedSignal.status !== 'closed' && (
            <div className="px-4 py-3 border-t space-y-2">
              <div className="flex gap-2">
                {(selectedSignal.status === 'pending_confirm' || selectedSignal.status === 'unbound') && (
                  <button
                    onClick={() => openConfirmModal(selectedSignal)}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                  >
                    批准 AI 归属
                  </button>
                )}
                {selectedSignal.status === 'bound' && (
                  <button
                    onClick={() => openConfirmModal(selectedSignal)}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    修改归属
                  </button>
                )}
                <button
                  onClick={() => setIgnoringSignalId(ignoringSignalId === selectedSignal.id ? null : selectedSignal.id)}
                  className="px-3 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 transition-colors"
                >
                  忽略
                </button>
              </div>
              {ignoringSignalId === selectedSignal.id && (
                <div className="bg-red-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-red-700">忽略原因（必填）</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { value: 'misjudge', label: '误判' },
                      { value: 'duplicate', label: '重复信号' },
                      { value: 'invalid', label: '无效信号' },
                      { value: 'no_followup', label: '无需跟进' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setIgnoreReason(opt.value)}
                        className={`py-1.5 rounded text-xs border transition-colors ${
                          ignoreReason === opt.value
                            ? 'border-red-500 bg-red-100 text-red-700 font-medium'
                            : 'border-red-200 text-red-500 hover:bg-red-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleIgnore(selectedSignal.id, ignoreReason)}
                    disabled={!ignoreReason}
                    className="w-full py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-40"
                  >
                    确认忽略
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirm binding modal */}
      {confirmingSignal && !createdWorkspaceId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[500px] p-6">
            <h2 className="text-base font-semibold mb-1">确认信号归属</h2>
            <p className="text-xs text-gray-500 mb-4 line-clamp-2">{confirmingSignal.contentSummary}</p>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCreateMode(false)}
                className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${!createMode ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                绑定已有商机
              </button>
              <button
                onClick={() => setCreateMode(true)}
                className={`flex-1 py-1.5 rounded-lg text-xs border transition-all ${createMode ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >
                + 新建商机 & 战场
              </button>
            </div>

            {!createMode ? (
              <>
                <div className="mb-4">
                  <label className="text-xs text-gray-500 block mb-1">归属到哪个商机？</label>
                  {/* [P1-7] Search box for opportunity modal */}
                  <input
                    type="text"
                    value={oppSearchQ}
                    onChange={(e) => setOppSearchQ(e.target.value)}
                    placeholder="搜索商机名称..."
                    className="w-full border rounded-lg px-3 py-1.5 text-sm mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
                  />
                  <select
                    value={selectedOppId}
                    onChange={(e) => setSelectedOppId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    size={Math.min(6, (oppSearchQ ? allOpportunities.filter(o => o.name.includes(oppSearchQ)) : allOpportunities).length + 1)}
                  >
                    <option value="">— 不绑定商机 —</option>
                    {(oppSearchQ
                      ? allOpportunities.filter(o => o.name.toLowerCase().includes(oppSearchQ.toLowerCase()))
                      : allOpportunities
                    ).map((o) => (
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
              </>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">客户名称</label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="例：阳光电源"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">商机名称</label>
                    <input
                      type="text"
                      value={newOppName}
                      onChange={(e) => setNewOppName(e.target.value)}
                      placeholder="例：阳光电源储能安全培训项目"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setCreateMode(false)}
                    className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    返回
                  </button>
                  <button
                    onClick={handleConfirmAndCreateWorkspace}
                    disabled={creating || !newCustomerName.trim() || !newOppName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? '创建中...' : '创建商机 & 战场'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Workspace created success banner */}
      {createdWorkspaceId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[400px] p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-base font-semibold mb-1">战场已创建</h2>
            <p className="text-sm text-gray-500 mb-5">信号已归属，商机战场已就绪，AI 数字员工将自动启动分析</p>
            <div className="flex gap-2">
              <button
                onClick={() => setCreatedWorkspaceId(null)}
                className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                留在信号台
              </button>
              <button
                onClick={() => router.push(`/workspace/${createdWorkspaceId}`)}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                进入战场 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmed binding toast */}
      {confirmedWorkspaceId && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-green-200 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm text-gray-700">归属已确认</span>
          <button
            onClick={() => router.push(`/workspace/${confirmedWorkspaceId}`)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
          >
            进入战场 →
          </button>
          <button onClick={() => setConfirmedWorkspaceId(null)} className="text-gray-400 hover:text-gray-600 ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* File upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[480px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">上传文件信号</h2>
              <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* File label */}
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1.5">文件用途</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'competitor', label: '竞品资料', color: 'orange' },
                  { value: 'quotation', label: '报价单', color: 'blue' },
                  { value: 'proposal', label: '方案文档', color: 'purple' },
                  { value: 'contract', label: '合同/协议', color: 'green' },
                  { value: 'other', label: '其他文件', color: 'gray' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setUploadLabel(opt.value)}
                    className={`py-2 rounded-lg text-xs border transition-all ${
                      uploadLabel === opt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) { setUploadFile(f); setUploadResult(null); setUploadError(null) }
              }}
              className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-4"
            >
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2">
                  {uploadFile.type.startsWith('image/') ? (
                    <Image className="w-5 h-5 text-blue-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-500" />
                  )}
                  <span className="text-sm text-gray-800 font-medium">{uploadFile.name}</span>
                  <span className="text-xs text-gray-400">({(uploadFile.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">点击选择或拖拽文件</p>
                  <p className="text-xs text-gray-400 mt-1">支持图片、文本、CSV、JSON（最大 10MB）</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.txt,.md,.csv,.json,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) { setUploadFile(f); setUploadResult(null); setUploadError(null) }
              }}
            />

            {/* Result / error */}
            {uploadResult && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                <p className="text-xs font-medium text-green-700 mb-1">✓ 信号已创建</p>
                {uploadResult.summary && (
                  <p className="text-xs text-green-800">{uploadResult.summary}</p>
                )}
                <p className="text-[11px] text-green-600 mt-1">提取 {uploadResult.extractedLength} 字符</p>
              </div>
            )}
            {uploadError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-700">{uploadError}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                {uploadResult ? '关闭' : '取消'}
              </button>
              {!uploadResult && (
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'AI 解析中...' : '上传并分析'}
                </button>
              )}
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
