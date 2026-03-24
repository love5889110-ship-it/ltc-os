'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserCheck, CheckCircle, XCircle, MessageSquare, RefreshCw, Edit3, Sparkles, TrendingUp, ThumbsUp, MessageCircle, ChevronDown } from 'lucide-react'
import { ACTION_TYPE_LABELS, AGENT_LABELS, statusColor, formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'
import { Breadcrumb } from '@/components/ui/breadcrumb'

interface Action {
  id: string
  actionType: string
  actionStatus: string
  actionPriority: number | null
  executorCategory: string | null
  workspaceId: string
  actionPayloadJson: { title?: string; description?: string; draft?: string } | null
  createdAt: string | null
  runId: string | null
}

// 所有面板模式
type PanelMode = 'reject' | 'modify' | 'approved_note'
interface PanelState {
  actionId: string
  mode: PanelMode
  comment: string
  correction: string
}

// 通过后轻量反馈 — 不阻塞主流程，通过后出现，可直接跳过
interface PostApprovalHint {
  actionId: string
  actionTitle: string
  note: string
  submitted: boolean
}

export default function InterventionPage() {
  const router = useRouter()
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending_approval')
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; link?: { label: string; href: string } }>>([])
  // 通过后非阻塞反馈浮层
  const [postApproval, setPostApproval] = useState<PostApprovalHint | null>(null)

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

  const handleDecision = async (
    actionId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
    correction?: string,
    isModified?: boolean
  ) => {
    const action = actions.find((a) => a.id === actionId)
    setProcessing(actionId)

    const correctedPayload = correction?.trim() ? { suggestion: correction.trim() } : undefined

    await fetch('/api/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId,
        decision,
        comments: comment,
        correctedPayload,
        feedbackLabel: isModified ? 'modified' : decision === 'approved' ? 'accepted' : 'rejected',
      }),
    })

    setProcessing(null)
    setPanel(null)

    if (decision === 'approved' && action) {
      if (action.actionType === 'send_draft') {
        showToast('草稿已生成', { label: '去对客草稿 →', href: '/drafts' })
      } else if (action.actionType === 'create_task') {
        showToast('任务已创建', { label: '去任务执行 →', href: '/tasks' })
      } else {
        showToast('动作已通过', { label: '查看执行记录 →', href: '/execution' })
      }
      if (isModified) {
        showToast('修改意见已记录为训练样本 ✓', { label: '进化中心查看 →', href: '/evolution' })
      } else {
        // 通过后出现轻量反馈浮层（非阻塞，可忽略）
        setPostApproval({
          actionId,
          actionTitle: action.actionPayloadJson?.title ?? ACTION_TYPE_LABELS[action.actionType] ?? action.actionType,
          note: '',
          submitted: false,
        })
      }
    }
    if (decision === 'rejected') {
      showToast('驳回已记录为训练样本，将推动 AI 进化', { label: '进化中心查看 →', href: '/evolution' })
    }
    load()
  }

  // 提交"通过但有保留意见"反馈
  const handlePostApprovalNote = async () => {
    if (!postApproval?.note.trim()) return
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'approved_with_note',
        sourceObjectId: postApproval.actionId,
        feedbackLabel: 'accepted',
        feedbackReasonCode: 'approved_with_note',
        correctedOutputJson: { note: postApproval.note.trim() },
        reusableFlag: true,
      }),
    })
    setPostApproval((p) => p ? { ...p, submitted: true } : null)
    showToast('保留意见已记录为训练参考 ✓', { label: '进化中心查看 →', href: '/evolution' })
    setTimeout(() => setPostApproval(null), 2000)
  }

  const FILTERS = [
    { key: 'pending_approval', label: '待审批' },
    { key: 'approved', label: '已通过' },
    { key: 'rejected', label: '已驳回' },
    { key: 'failed', label: '执行失败' },
  ]

  const pendingCount = actions.filter((a) => a.actionStatus === 'pending_approval').length

  // 分类标签
  const catLabel = (cat: string | null) =>
    cat === 'authorization' ? '授权类' : cat === 'collaboration' ? '协作类' : '执行类'
  const catStyle = (cat: string | null) =>
    cat === 'authorization' ? 'bg-red-50 text-red-600 border border-red-100' :
    cat === 'collaboration' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
    'bg-green-50 text-green-600 border border-green-100'

  return (
    <div className="p-6">
      {/* Toast */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div key={toast.id} className="bg-gray-900 text-white text-sm rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 min-w-64">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span>{toast.message}</span>
              {toast.link && (
                <button onClick={() => router.push(toast.link!.href)} className="text-blue-300 hover:text-blue-200 whitespace-nowrap ml-1">
                  {toast.link.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 通过后轻量反馈浮层 — 非阻塞，右下角出现，可关闭 */}
      {postApproval && !postApproval.submitted && (
        <div className="fixed bottom-6 right-6 z-40 w-80 bg-white border border-blue-200 rounded-xl shadow-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">帮助 AI 进化（可跳过）</span>
            </div>
            <button onClick={() => setPostApproval(null)} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
          </div>
          <p className="text-xs text-gray-500 mb-2 leading-relaxed">
            已通过「{postApproval.actionTitle}」<br />
            这次 AI 的判断方向准确吗？有保留意见吗？
          </p>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setPostApproval(null)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs hover:bg-green-100 border border-green-100"
            >
              <ThumbsUp className="w-3 h-3" />完全认可
            </button>
            <button
              onClick={() => setPostApproval((p) => p ? { ...p, note: p.note || ' ' } : null)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs hover:bg-amber-100 border border-amber-100"
            >
              <MessageCircle className="w-3 h-3" />有保留意见
            </button>
          </div>
          {postApproval.note.trim().length >= 0 && postApproval.note !== '' && (
            <>
              <textarea
                value={postApproval.note.trim() === '' ? '' : postApproval.note}
                onChange={(e) => setPostApproval((p) => p ? { ...p, note: e.target.value } : null)}
                placeholder="说说你的保留意见，比如：方向对但重点偏了，建议下次优先关注 X..."
                className="w-full border border-amber-200 rounded-lg px-3 py-2 text-xs h-16 resize-none bg-amber-50/50 mb-2"
                autoFocus
              />
              <button
                onClick={handlePostApprovalNote}
                disabled={!postApproval.note.trim()}
                className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-40"
              >
                记录意见（将用于训练）
              </button>
            </>
          )}
        </div>
      )}

      <Breadcrumb items={[{ label: '动作处理' }, { label: '待审批动作' }]} />
      <PageGuide
        storageKey="intervention"
        contents={{
          all: {
            roleLabel: '所有角色',
            purpose: 'AI 数字员工提出的所有待批准动作',
            whenToUse: '在战场页看到待审批数 > 0 时，或从信号台处理完信号后',
            aiAlreadyDid: '已分析商机并给出具体动作建议，含动作原因和执行载体',
            youDecide: '通过并执行、修改后通过、或驳回并说明原因',
            dontDo: '不需要在这里主动找动作来做，等 AI 推送过来',
            nextStepLabel: '查看执行结果',
            nextStepHref: '/execution',
          },
        }}
      />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">待审批动作</h1>
          {pendingCount > 0 && filter === 'pending_approval' && (
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {pendingCount} 待处理
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 训练说明 */}
          <div className="text-xs text-gray-400 flex items-center gap-1 mr-2">
            <Sparkles className="w-3 h-3 text-blue-400" />
            每次审批都在训练 AI
          </div>
          <button
            onClick={() => router.push('/evolution')}
            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs text-gray-500 hover:bg-gray-50 hover:text-blue-600 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            进化中心
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* 训练时机说明条 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-4 flex items-start gap-3">
        <Sparkles className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="flex gap-4 text-xs text-blue-700 flex-wrap">
          <span><span className="font-medium text-green-700">✓ 通过</span> → 认可样本，可留下保留意见</span>
          <span><span className="font-medium text-blue-700">✎ 修改后通过</span> → modified 样本（高价值）</span>
          <span><span className="font-medium text-red-600">✕ 驳回</span> → rejected 样本 + 原因</span>
        </div>
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${catStyle(action.executorCategory)}`}>
                      {catLabel(action.executorCategory)}
                    </span>
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
                    <p className="text-sm text-gray-700 mb-1 font-medium">{action.actionPayloadJson.title}</p>
                  )}
                  {action.actionPayloadJson?.description && (
                    <p className="text-xs text-gray-500 mb-2">{action.actionPayloadJson.description}</p>
                  )}
                  {action.workspaceId && (
                    <Link
                      href={`/workspace/${action.workspaceId}`}
                      className="inline-flex items-center text-[10px] text-blue-500 hover:text-blue-700 hover:underline mb-2"
                    >
                      ↩ 来源战场：{action.workspaceId.slice(-6)}
                    </Link>
                  )}
                  {action.actionPayloadJson?.draft && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2 mb-2">
                      <p className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />对客草稿
                      </p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">{action.actionPayloadJson.draft}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{formatRelativeTime(action.createdAt)}</p>
                </div>

                {action.actionStatus === 'pending_approval' && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {/* 通过 */}
                    <button
                      onClick={() => handleDecision(action.id, 'approved')}
                      disabled={processing === action.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />通过
                    </button>
                    {/* 修改后通过 */}
                    <button
                      onClick={() => setPanel({ actionId: action.id, mode: 'modify', comment: '', correction: '' })}
                      disabled={processing === action.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />修改后通过
                    </button>
                    {/* 驳回 */}
                    <button
                      onClick={() => setPanel({ actionId: action.id, mode: 'reject', comment: '', correction: '' })}
                      disabled={processing === action.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />驳回
                    </button>
                  </div>
                )}
              </div>

              {/* 操作面板 */}
              {panel?.actionId === action.id && (
                <div className={`mt-3 pt-3 border-t ${panel.mode === 'modify' ? 'border-blue-100 bg-blue-50/50 rounded-b-xl -mx-4 -mb-4 px-4 pb-4' : 'border-red-100 bg-red-50/30 rounded-b-xl -mx-4 -mb-4 px-4 pb-4'}`}>
                  {panel.mode === 'modify' ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        <p className="text-xs font-medium text-blue-700">修改意见将沉淀为高价值 modified 训练样本</p>
                      </div>
                      <textarea
                        value={panel.correction}
                        onChange={(e) => setPanel(p => p ? { ...p, correction: e.target.value } : null)}
                        placeholder="正确的做法是什么？越具体越有训练价值（必填）..."
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm h-20 resize-none mb-2 bg-white"
                        autoFocus
                      />
                      <textarea
                        value={panel.comment}
                        onChange={(e) => setPanel(p => p ? { ...p, comment: e.target.value } : null)}
                        placeholder="（可选）为什么 AI 的建议不够准确..."
                        className="w-full border rounded-lg px-3 py-2 text-sm h-14 resize-none mb-2 text-gray-600"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setPanel(null)} className="px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">取消</button>
                        <button
                          onClick={() => handleDecision(action.id, 'approved', panel.comment, panel.correction, true)}
                          disabled={!panel.correction.trim() || processing === action.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />记录并通过
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-red-400" />
                        <p className="text-xs font-medium text-red-600">驳回原因将沉淀为 rejected 训练样本</p>
                      </div>
                      <textarea
                        value={panel.comment}
                        onChange={(e) => setPanel(p => p ? { ...p, comment: e.target.value } : null)}
                        placeholder="驳回原因（必填）..."
                        className="w-full border rounded-lg px-3 py-2 text-sm h-16 resize-none mb-2"
                        autoFocus
                      />
                      <textarea
                        value={panel.correction}
                        onChange={(e) => setPanel(p => p ? { ...p, correction: e.target.value } : null)}
                        placeholder="（可选）正确的做法是什么？填写后升级为 modified 高价值样本..."
                        className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm h-14 resize-none mb-2 bg-blue-50 placeholder-blue-300"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setPanel(null)} className="px-3 py-1.5 border rounded text-sm text-gray-600">取消</button>
                        <button
                          onClick={() => handleDecision(action.id, 'rejected', panel.comment, panel.correction)}
                          disabled={!panel.comment.trim() || processing === action.id}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                        >
                          确认驳回
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
