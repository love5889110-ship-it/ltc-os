'use client'

import { useState, useEffect } from 'react'
import { FileEdit, CheckCircle, X, ChevronDown, ChevronUp, Clipboard, Send } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'

interface Draft {
  id: string
  workspaceId: string
  draftType: string
  title: string
  content: string
  draftStatus: 'pending_review' | 'approved' | 'sent' | 'archived'
  reviewNote: string | null
  recipientInfo: { channel?: string; to?: string } | null
  createdAt: string | null
}

const TYPE_LABELS: Record<string, string> = {
  email: '邮件',
  proposal_section: '方案章节',
  tender_response: '招标响应',
  wechat: '微信消息',
  report: '报告',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_review: { label: '待审阅', color: 'bg-orange-100 text-orange-700' },
  approved: { label: '已批准', color: 'bg-green-100 text-green-700' },
  sent: { label: '已发送', color: 'bg-blue-100 text-blue-700' },
  archived: { label: '已归档', color: 'bg-gray-100 text-gray-500' },
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [activeTab, setActiveTab] = useState<'pending_review' | 'approved' | 'sent' | 'archived'>('pending_review')
  const [editedContent, setEditedContent] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/drafts')
    if (res.ok) {
      const data = await res.json()
      setDrafts(data.drafts ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAction = async (draftId: string, action: 'approve' | 'reject' | 'mark_sent') => {
    setProcessingId(draftId)
    await fetch('/api/drafts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, action, reviewNote }),
    })
    setProcessingId(null)
    setReviewNote('')
    setExpandedId(null)
    load()
  }

  const handleCopy = async (draft: Draft) => {
    const content = editedContent[draft.id] ?? draft.content
    await navigator.clipboard.writeText(content)
    setCopiedId(draft.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredDrafts = drafts.filter((d) => d.draftStatus === activeTab)
  const pendingCount = drafts.filter((d) => d.draftStatus === 'pending_review').length

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">加载中...</div>

  const TABS = [
    { key: 'pending_review', label: '待审阅' },
    { key: 'approved', label: '已批准' },
    { key: 'sent', label: '已发送' },
    { key: 'archived', label: '已归档' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <FileEdit className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">草稿中心</h1>
          {pendingCount > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
              {pendingCount} 待审阅
            </span>
          )}
        </div>
        {/* Tabs */}
        <div className="flex gap-4 mt-3">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`text-sm pb-1 border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
              <span className="ml-1 text-xs">
                ({drafts.filter((d) => d.draftStatus === key).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <PageGuide
          role="销售"
          what="AI 起草的邮件、方案、微信消息等，需销售审阅后才能发出，销售可直接编辑内容"
          firstStep="在「待审阅」标签找到草稿，点击展开查看内容，可以直接修改，满意后点击「审批通过」"
          storageKey="drafts"
        />
        {filteredDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FileEdit className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无草稿</p>
            {activeTab === 'pending_review' && (
              <p className="text-xs mt-1">AI 审批通过 send_draft 动作后，草稿将显示在这里</p>
            )}
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {filteredDrafts.map((draft) => {
              const isExpanded = expandedId === draft.id
              const cfg = STATUS_CONFIG[draft.draftStatus]
              const currentContent = editedContent[draft.id] ?? draft.content
              return (
                <div key={draft.id} className="bg-white rounded-xl border">
                  <div className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {TYPE_LABELS[draft.draftType] ?? draft.draftType}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {formatRelativeTime(draft.createdAt)}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-800">{draft.title}</h3>
                      {!isExpanded && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{currentContent}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Send guidance for approved drafts */}
                      {draft.draftStatus === 'approved' && (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                          <Send className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>
                            请通过{' '}
                            <span className="font-medium">
                              {draft.recipientInfo?.channel
                                ? { email: '邮件', wechat: '微信', dingtalk: '钉钉', phone: '电话' }[draft.recipientInfo.channel] ?? draft.recipientInfo.channel
                                : '适当渠道'}
                            </span>
                            {draft.recipientInfo?.to && (
                              <> 发送给 <span className="font-medium">{draft.recipientInfo.to}</span></>
                            )}
                            ，发送后点击「已发送」标记状态
                          </span>
                        </div>
                      )}
                      {/* Inline editable textarea */}
                      <textarea
                        value={currentContent}
                        onChange={(e) => setEditedContent((prev) => ({ ...prev, [draft.id]: e.target.value }))}
                        rows={10}
                        className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y bg-gray-50"
                      />

                      {draft.reviewNote && (
                        <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                          审阅备注：{draft.reviewNote}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Copy button — always visible */}
                        <button
                          onClick={() => handleCopy(draft)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                          {copiedId === draft.id ? '已复制！' : '复制全文'}
                        </button>

                        {draft.draftStatus === 'pending_review' && (
                          <>
                            <input
                              type="text"
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              placeholder="审阅备注（可选）..."
                              className="flex-1 min-w-32 border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleAction(draft.id, 'approve')}
                              disabled={processingId === draft.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              批准
                            </button>
                            <button
                              onClick={() => handleAction(draft.id, 'reject')}
                              disabled={processingId === draft.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              退回
                            </button>
                          </>
                        )}

                        {draft.draftStatus === 'approved' && (
                          <button
                            onClick={() => handleAction(draft.id, 'mark_sent')}
                            disabled={processingId === draft.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            已发送
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
