'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'

interface Task {
  id: string
  workspaceId: string
  title: string
  description: string | null
  assignedTo: string | null
  priority: number | null
  taskStatus: 'pending' | 'in_progress' | 'done' | 'cancelled'
  dueDate: string | null
  completedAt: string | null
  createdAt: string | null
}

const STATUS_CONFIG = {
  pending: { label: '待处理', color: 'bg-gray-100 text-gray-600', icon: Clock },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  done: { label: '已完成', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600', icon: AlertCircle },
}

const PRIORITY_COLOR: Record<number, string> = {
  5: 'text-red-500',
  4: 'text-orange-500',
  3: 'text-yellow-500',
  2: 'text-blue-400',
  1: 'text-gray-400',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/tasks')
    if (res.ok) {
      const data = await res.json()
      setTasks(data.tasks ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (taskId: string, taskStatus: Task['taskStatus']) => {
    setUpdatingId(taskId)
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, taskStatus }),
    })
    setUpdatingId(null)
    load()
  }

  const columns: Task['taskStatus'][] = ['pending', 'in_progress', 'done']

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">加载中...</div>

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">任务中心</h1>
          <span className="text-xs text-gray-400 ml-2">AI 数字员工产生的待办任务</span>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>全部 {tasks.length}</span>
          <span className="text-orange-500">待处理 {tasks.filter(t => t.taskStatus === 'pending').length}</span>
          <span className="text-blue-500">进行中 {tasks.filter(t => t.taskStatus === 'in_progress').length}</span>
          <span className="text-green-500">已完成 {tasks.filter(t => t.taskStatus === 'done').length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <PageGuide
          role="全员"
          what="AI 数字员工在分析商机时创建的待办任务（拜访客户、提交资料、内部协作等）"
          firstStep="查看「待处理」列，找到分配给自己的任务，点击「开始」并在完成后标记为「完成」"
          storageKey="tasks"
        />
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ClipboardList className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无任务</p>
            <p className="text-xs mt-1">AI 审批通过 create_task 动作后，任务将显示在这里</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {columns.map((status) => {
              const cfg = STATUS_CONFIG[status]
              const colTasks = tasks.filter((t) => t.taskStatus === status)
              return (
                <div key={status} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <cfg.icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
                    <span className="ml-auto text-xs text-gray-400">{colTasks.length}</span>
                  </div>
                  <div className="space-y-3">
                    {colTasks.map((task) => (
                      <div key={task.id} className="bg-white rounded-lg border p-3">
                        <div className="flex items-start gap-2 mb-2">
                          {task.priority !== null && (
                            <span className={`text-xs font-bold ${PRIORITY_COLOR[task.priority] ?? 'text-gray-400'}`}>
                              P{task.priority}
                            </span>
                          )}
                          <p className="text-sm font-medium text-gray-800 flex-1">{task.title}</p>
                        </div>
                        {task.description && (
                          <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
                        )}
                        {task.assignedTo && (
                          <p className="text-xs text-gray-400 mb-1">👤 {task.assignedTo}</p>
                        )}
                        <p className="text-xs text-gray-400 mb-2">
                          {formatRelativeTime(task.createdAt)}
                        </p>
                        <div className="flex gap-1.5">
                          {status === 'pending' && (
                            <button
                              onClick={() => updateStatus(task.id, 'in_progress')}
                              disabled={updatingId === task.id}
                              className="flex-1 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              开始
                            </button>
                          )}
                          {status === 'in_progress' && (
                            <button
                              onClick={() => updateStatus(task.id, 'done')}
                              disabled={updatingId === task.id}
                              className="flex-1 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              完成
                            </button>
                          )}
                          {status !== 'done' && (
                            <button
                              onClick={() => updateStatus(task.id, 'cancelled')}
                              disabled={updatingId === task.id}
                              className="py-1 px-2 text-xs border border-gray-200 text-gray-500 rounded hover:bg-gray-50 disabled:opacity-50"
                            >
                              取消
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-400">暂无</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
