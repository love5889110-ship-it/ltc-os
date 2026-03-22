'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, CheckCircle, XCircle, MessageSquare, RefreshCw } from 'lucide-react'
import { ACTION_TYPE_LABELS, AGENT_LABELS, statusColor, formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'

interface Action {
  id: string
  actionType: string
  actionStatus: string
  actionPriority: number | null
  workspaceId: string
  actionPayloadJson: { title?: string; description?: string; draft?: string } | null
  createdAt: string | null
  runId: string | null
}

export default function InterventionPage() {
  const router = useRouter()
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending_approval')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectCorrection, setRejectCorrection] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; link?: { label: string; href: string } }>>([])

  const showToast = (message: string, link?: { label: string; href: string }) => {
    const toastId = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id: toastId, message, link }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 5000)
  }

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: filter, limit: '100' })
    const res = await fetch(`/api/actions?${params}`)
    const data = await res.json()
    setActions(data.actions ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const handleDecision = async (actionId: string, decision: 'approved' | 'rejected', comment?: string, correction?: string) => {
    const action = actions.find((a) => a.id === actionId)
    setProcessing(actionId)
    const correctedPayload = correction?.trim() ? { suggestion: correction.trim() } : undefined
    await fetch('/api/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId, decision, comments: comment, correctedPayload }),
    })
    setProcessing(null)
    setRejectingId(null)
    setRejectComment('')
    setRejectCorrection('')
    if (decision === 'approved' && action) {
      if (action.actionType === 'send_draft') {
        showToast('草稿已生成，可前往草稿中心审阅', { label: '前往草稿中心 →', href: '/drafts' })
      } else if (action.actionType === 'create_task') {
        showToast('任务已创建', { label: '前往任务中心 →', href: '/tasks' })
      }
    }
    load()
  }

  const FILTERS = [
    { key: 'pending_approval', label: '待审批' },
    { key: 'approved', label: '已通过' },
    { key: 'rejected', label: '已驳回' },
    { key: 'failed', label: '执行失败' },
  ]

  const pendingCount = actions.filter((a) => a.actionStatus === 'pending_approval').length

  return (
    <div className="p-6">
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div key={toast.id} className="bg-gray-900 text-white text-sm rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 min-w-64">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span>{toast.message}</span>
              {toast.link && (
                <button
                  onClick={() => router.push(toast.link!.href)}
                  className="text-blue-300 hover:text-blue-200 whitespace-nowrap ml-1"
                >
                  {toast.link.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <PageGuide
        role="销售 / 解方经理"
        what="AI 需要人工审批的动作都在这里排队，通过后系统自动执行"
        firstStep="筛选「待审批」，查看 AI 起草的邮件或任务建议，通过或修改后点击「审批通过」"
        storageKey="intervention"
      />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">人工干预台</h1>
          {pendingCount > 0 && filter === 'pending_approval' && (
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {pendingCount} 待处理
            </span>
          )}
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              filter === key ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : actions.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">暂无待处理项目</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <div key={action.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">
                      {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${statusColor(action.actionStatus)}`}>
                      {action.actionStatus === 'pending_approval' ? '待审批' :
                       action.actionStatus === 'approved' ? '已通过' :
                       action.actionStatus === 'rejected' ? '已驳回' : action.actionStatus}
                    </span>
                    {action.actionPriority && action.actionPriority >= 4 && (
                      <span className="text-xs text-red-500 font-medium">高优先级</span>
                    )}
                  </div>
                  {action.actionPayloadJson?.title && (
                    <p className="text-sm text-gray-700 mb-1">{action.actionPayloadJson.title}</p>
                  )}
                  {action.actionPayloadJson?.description && (
                    <p className="text-xs text-gray-500 mb-2">{action.actionPayloadJson.description}</p>
                  )}
                  {action.actionPayloadJson?.draft && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2">
                      <p className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        对客草稿
                      </p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">
                        {action.actionPayloadJson.draft}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{formatRelativeTime(action.createdAt)}</p>
                </div>

                {action.actionStatus === 'pending_approval' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDecision(action.id, 'approved')}
                      disabled={processing === action.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      通过
                    </button>
                    <button
                      onClick={() => setRejectingId(action.id)}
                      disabled={processing === action.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      驳回
                    </button>
                  </div>
                )}
              </div>

              {/* Reject comment box */}
              {rejectingId === action.id && (
                <div className="mt-3 pt-3 border-t">
                  <textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="驳回原因（必填，将沉淀为反馈样本）..."
                    className="w-full border rounded-lg px-3 py-2 text-sm h-16 resize-none mb-2"
                  />
                  <textarea
                    value={rejectCorrection}
                    onChange={(e) => setRejectCorrection(e.target.value)}
                    placeholder="（可选）你认为正确的做法是什么？填写后将自动标记为 modified 样本..."
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm h-16 resize-none mb-2 bg-blue-50 placeholder-blue-300"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setRejectingId(null); setRejectComment(''); setRejectCorrection('') }}
                      className="px-3 py-1.5 border rounded text-sm text-gray-600"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleDecision(action.id, 'rejected', rejectComment, rejectCorrection)}
                      disabled={!rejectComment.trim()}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      确认驳回
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
