'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PackageOpen, RefreshCw, CheckCircle, Search, Filter } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

interface Deliverable {
  id: string
  workspaceId: string
  type: string
  title: string
  status: string
  approvalStatus: string | null
  version: number
  stage: string | null
  audience: string | null
  content: string | null
  createdAt: string | null
  updatedAt: string | null
}

const TYPE_LABELS: Record<string, string> = {
  solution_ppt: '方案PPT',
  scene_render: '场地效果图',
  layout_plan: '场地平面图',
  safety_proposal: '安全培训方案',
  requirement_summary: '需求摘要',
  bid_package: '投标文件',
  bid_prelim: '标前立项',
  contract_review: '合同审查意见',
  handover_package: '交接包',
  acceptance_doc: '验收文件',
  after_sales_report: '售后报告',
  quotation: '报价单',
  other: '其他',
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  drafting:       { label: '草稿中',  cls: 'bg-gray-100 text-gray-500' },
  pending_review: { label: '待审核',  cls: 'bg-amber-50 text-amber-600' },
  approved:       { label: '已批准',  cls: 'bg-green-50 text-green-600' },
  sent:           { label: '已发送',  cls: 'bg-blue-50 text-blue-600' },
  archived:       { label: '已归档',  cls: 'bg-gray-50 text-gray-400' },
}

const TYPE_GROUPS = [
  { key: '',                  label: '全部类型' },
  { key: 'solution_ppt',      label: '方案PPT' },
  { key: 'bid_package',       label: '投标文件' },
  { key: 'bid_prelim',        label: '标前立项' },
  { key: 'contract_review',   label: '合同审查' },
  { key: 'scene_render',      label: '效果图' },
  { key: 'handover_package',  label: '交接包' },
]

const STATUS_FILTERS = [
  { key: '',               label: '全部状态' },
  { key: 'pending_review', label: '待审核' },
  { key: 'approved',       label: '已批准' },
  { key: 'sent',           label: '已发送' },
  { key: 'drafting',       label: '草稿中' },
]

export default function DeliverablesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const showToast = (message: string) => {
    const toastId = Math.random().toString(36).slice(2)
    setToasts(p => [...p, { id: toastId, message }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== toastId)), 4000)
  }

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter) params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetch(`/api/deliverables?${params}`)
    const data = await res.json()
    setItems(data.deliverables ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [typeFilter, statusFilter])

  const handleAction = async (id: string, action: string, title: string) => {
    await fetch('/api/deliverables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliverableId: id, action }),
    })
    const msg = action === 'approve' ? `${title} 已批准` : action === 'mark_sent' ? `${title} 已标记发送` : `${title} 已退回`
    showToast(msg)
    load()
  }

  const filtered = items.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase())
  )

  // 统计
  const stats = {
    total: items.length,
    pending: items.filter(d => d.status === 'pending_review').length,
    approved: items.filter(d => d.status === 'approved').length,
    sent: items.filter(d => d.status === 'sent').length,
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Toast */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map(t => (
            <div key={t.id} className="bg-gray-900 text-white text-sm rounded-lg px-4 py-3 shadow-lg flex items-center gap-2 min-w-56">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PackageOpen className="w-5 h-5 text-purple-600" />
          <h1 className="text-lg font-semibold">成果物中心</h1>
          <span className="text-xs text-gray-400">AI 生成的所有对外材料统一归档于此</span>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* 统计条 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: '全部', value: stats.total, cls: 'bg-gray-50 text-gray-700' },
          { label: '待审核', value: stats.pending, cls: 'bg-amber-50 text-amber-700' },
          { label: '已批准', value: stats.approved, cls: 'bg-green-50 text-green-700' },
          { label: '已发送', value: stats.sent, cls: 'bg-blue-50 text-blue-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl px-4 py-3 ${s.cls}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* 搜索 */}
        <div className="relative flex-1 min-w-48 max-w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索成果物标题..."
            className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        {/* 类型筛选 */}
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none"
          >
            {TYPE_GROUPS.map(g => (
              <option key={g.key} value={g.key}>{g.label}</option>
            ))}
          </select>
        </div>
        {/* 状态筛选 */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-2.5 py-1.5 text-sm text-gray-600 focus:outline-none"
        >
          {STATUS_FILTERS.map(f => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <PackageOpen className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">暂无成果物</p>
          <p className="text-xs text-gray-300 mt-1">Agent 生成方案、投标文件、合同意见等后会出现在这里</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const st = STATUS_CONFIG[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-500' }
            const isExpanded = expandedId === d.id
            return (
              <div key={d.id} className="bg-white rounded-xl border">
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">
                          {TYPE_LABELS[d.type] ?? d.type}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.cls}`}>
                          {st.label}
                        </span>
                        {d.version > 1 && (
                          <span className="text-[10px] text-gray-400">v{d.version}</span>
                        )}
                        {d.stage && (
                          <span className="text-[10px] text-gray-400">· {d.stage}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400">{formatRelativeTime(d.createdAt)}</span>
                        <Link
                          href={`/workspace/${d.workspaceId}?tab=deliverables`}
                          className="text-[10px] text-blue-500 hover:underline"
                        >
                          ↩ 前往商机工作区
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {d.content && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : d.id)}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          {isExpanded ? '收起' : '预览'}
                        </button>
                      )}
                      {(d.status === 'drafting' || d.status === 'pending_review') && (
                        <button
                          onClick={() => handleAction(d.id, 'approve', d.title)}
                          className="text-[10px] px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 border border-green-200"
                        >
                          批准
                        </button>
                      )}
                      {d.status === 'approved' && (
                        <button
                          onClick={() => handleAction(d.id, 'mark_sent', d.title)}
                          className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200"
                        >
                          标记发送
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(d.id, 'archive', d.title)}
                        className="text-[10px] px-2 py-1 bg-gray-50 text-gray-400 rounded hover:bg-gray-100 border border-gray-200"
                      >
                        归档
                      </button>
                    </div>
                  </div>

                  {/* 内容预览 */}
                  {isExpanded && d.content && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3">
                      {(() => {
                        try {
                          const parsed = JSON.parse(d.content)
                          if (parsed?.slides && Array.isArray(parsed.slides)) {
                            return (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-gray-600 mb-2">{parsed.title ?? d.title}</p>
                                {(parsed.slides as Array<{ page: number; title: string; bullets: string[] }>).map(slide => (
                                  <div key={slide.page} className="bg-white rounded border px-3 py-2">
                                    <p className="text-xs font-medium text-gray-700 mb-1">P{slide.page}. {slide.title}</p>
                                    <ul className="space-y-0.5">
                                      {slide.bullets.map((b, i) => (
                                        <li key={i} className="text-[11px] text-gray-500 flex items-start gap-1.5">
                                          <span className="text-blue-400 flex-shrink-0">·</span>{b}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        } catch { /* not JSON */ }
                        return (
                          <pre className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                            {d.content}
                          </pre>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
