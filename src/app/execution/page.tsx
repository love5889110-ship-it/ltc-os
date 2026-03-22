'use client'

import { useState, useEffect } from 'react'
import { Zap, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react'
import { ACTION_TYPE_LABELS, statusColor, formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'

interface Action {
  id: string
  actionType: string
  actionStatus: string
  actionPriority: number | null
  workspaceId: string
  executorType: string | null
  retryCount: number | null
  executedAt: string | null
  failedAt: string | null
  createdAt: string | null
  actionPayloadJson: { title?: string; description?: string } | null
}

export default function ExecutionPage() {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (filter !== 'all') params.set('status', filter)
    const res = await fetch(`/api/actions?${params}`)
    const data = await res.json()
    setActions(data.actions ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  const stats = {
    total: actions.length,
    pending: actions.filter((a) => ['pending', 'pending_approval'].includes(a.actionStatus)).length,
    completed: actions.filter((a) => a.actionStatus === 'completed').length,
    failed: actions.filter((a) => a.actionStatus === 'failed').length,
    executing: actions.filter((a) => a.actionStatus === 'executing').length,
  }

  const FILTERS = [
    { key: 'all', label: '全部' },
    { key: 'pending_approval', label: '待审批' },
    { key: 'approved', label: '已批准' },
    { key: 'executing', label: '执行中' },
    { key: 'completed', label: '已完成' },
    { key: 'failed', label: '失败' },
    { key: 'rejected', label: '已驳回' },
  ]

  return (
    <div className="p-6">
      <PageGuide
        role="全员"
        what="展示 AI 数字员工产生的所有动作执行记录（发草稿、创任务、更新状态等）"
        firstStep="查看状态为「失败」或「待审批」的动作，确认是否需要人工处理"
        storageKey="execution"
      />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">执行中心</h1>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '待处理', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: '执行中', value: stats.executing, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '已完成', value: stats.completed, color: 'text-green-600', bg: 'bg-green-50' },
          { label: '执行失败', value: stats.failed, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
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
          <Zap className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">暂无动作记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">动作类型</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">内容</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">状态</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">优先级</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">重试</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {actions.map((action) => (
                <tr key={action.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-700">
                      {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {action.actionPayloadJson?.title ?? action.actionPayloadJson?.description ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusColor(action.actionStatus)}`}>
                      {action.actionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">P{action.actionPriority ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {(action.retryCount ?? 0) > 0 ? (
                      <span className="text-orange-500">{action.retryCount}次</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {formatRelativeTime(action.executedAt ?? action.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
