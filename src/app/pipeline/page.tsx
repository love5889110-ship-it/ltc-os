'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, RefreshCw, AlertTriangle, Zap } from 'lucide-react'
import { healthScoreColor, formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'

const STAGES = ['需求挖掘', '方案设计', '招投标', '商务谈判', '合同签订', '交付', '售后']

interface AgentStatus {
  agentType: string
  status: string
  lastActiveAt: string | null
}

interface PipelineItem {
  workspaceId: string
  currentStage: string | null
  healthScore: number | null
  riskScore: number | null
  opportunity: { id: string; name: string; amount: number | null; stage: string } | null
  customer: { id: string; name: string } | null
  pendingActionCount: number
  runningAgentCount: number
  agentStatuses: AgentStatus[]
  stages: string[]
}

export default function PipelinePage() {
  const [items, setItems] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'health' | 'risk' | 'amount'>('risk')
  const router = useRouter()

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/pipeline')
    if (res.ok) {
      const data = await res.json()
      setItems(data.items ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sorted = [...items].sort((a, b) => {
    if (sortBy === 'health') return (b.healthScore ?? 0) - (a.healthScore ?? 0)
    if (sortBy === 'risk') return (b.riskScore ?? 0) - (a.riskScore ?? 0)
    if (sortBy === 'amount') return (b.opportunity?.amount ?? 0) - (a.opportunity?.amount ?? 0)
    return 0
  })

  const getStageIndex = (item: PipelineItem) => {
    const stage = item.currentStage ?? item.opportunity?.stage ?? ''
    const idx = STAGES.indexOf(stage)
    return idx >= 0 ? idx : -1
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">加载中...</div>

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-semibold">销售流水线</h1>
            <span className="text-xs text-gray-400 ml-2">{items.length} 个活跃商机</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">排序：</span>
            {[
              { key: 'risk', label: '风险优先' },
              { key: 'health', label: '健康优先' },
              { key: 'amount', label: '金额优先' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key as typeof sortBy)}
                className={`text-xs px-2 py-1 rounded ${
                  sortBy === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={load}
              className="p-1.5 border rounded hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline table */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 pt-4">
          <PageGuide
            role="管理层 / 销售"
            what="所有商机在 7 个销售阶段的进展全貌，颜色代表商机健康度，红色标签表示高风险"
            firstStep="按「风险优先」排序，找出健康分最低的商机，点击行名进入作战台查看 AI 风险分析"
            storageKey="pipeline"
          />
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <GitBranch className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">暂无活跃商机</p>
            <p className="text-xs mt-1">创建商机作战台后，这里将显示销售流水线</p>
          </div>
        ) : (
          <div className="min-w-max">
            {/* Stage header */}
            <div className="sticky top-0 bg-gray-50 border-b z-10 flex">
              <div className="w-64 flex-shrink-0 px-4 py-3 text-xs font-medium text-gray-500 border-r">
                商机
              </div>
              <div className="w-24 flex-shrink-0 px-3 py-3 text-xs font-medium text-gray-500 border-r text-center">
                健康分
              </div>
              {STAGES.map((stage) => (
                <div key={stage} className="w-36 flex-shrink-0 px-3 py-3 text-xs font-medium text-gray-500 border-r text-center">
                  {stage}
                </div>
              ))}
            </div>

            {/* Rows */}
            {sorted.map((item) => {
              const stageIdx = getStageIndex(item)
              return (
                <div
                  key={item.workspaceId}
                  className="flex border-b hover:bg-blue-50/30 cursor-pointer group"
                  onClick={() => router.push(`/workspace/${item.workspaceId}`)}
                >
                  {/* Opportunity info */}
                  <div className="w-64 flex-shrink-0 px-4 py-3 border-r">
                    <div className="text-xs text-gray-400 mb-0.5">{item.customer?.name ?? '—'}</div>
                    <div className="text-sm font-medium text-gray-800 line-clamp-1">
                      {item.opportunity?.name ?? '未知商机'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {item.opportunity?.amount && (
                        <span className="text-xs text-gray-500">
                          ¥{(item.opportunity.amount / 10000).toFixed(0)}万
                        </span>
                      )}
                      {item.pendingActionCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-orange-600">
                          <Zap className="w-3 h-3" />
                          {item.pendingActionCount} 待审
                        </span>
                      )}
                      {item.runningAgentCount > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-blue-600">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          运行中
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Health score */}
                  <div className="w-24 flex-shrink-0 px-3 py-3 border-r flex items-center justify-center">
                    <div className="text-center">
                      <div className={`text-lg font-bold ${healthScoreColor(item.healthScore ?? 0)}`}>
                        {Math.round(item.healthScore ?? 0)}
                      </div>
                      {(item.riskScore ?? 0) > 50 && (
                        <div className="flex items-center gap-0.5 text-xs text-red-500">
                          <AlertTriangle className="w-3 h-3" />
                          高风险
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stage cells */}
                  {STAGES.map((stage, idx) => {
                    const isCurrent = stageIdx === idx
                    const isPast = stageIdx > idx
                    const runningAgents = item.agentStatuses.filter(
                      (a) => a.status === 'running'
                    )
                    const hasRunning = isCurrent && runningAgents.length > 0

                    return (
                      <div
                        key={stage}
                        className={`w-36 flex-shrink-0 px-3 py-3 border-r flex items-center justify-center ${
                          isCurrent ? 'bg-blue-50' : ''
                        }`}
                      >
                        {isPast && (
                          <div className="w-2 h-2 rounded-full bg-green-400" title="已完成" />
                        )}
                        {isCurrent && (
                          <div className="flex flex-col items-center gap-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                              hasRunning ? 'bg-blue-400 animate-pulse' : 'bg-blue-500'
                            }`} />
                            {hasRunning && (
                              <span className="text-xs text-blue-600">运行中</span>
                            )}
                            {item.pendingActionCount > 0 && !hasRunning && (
                              <span className="text-xs text-orange-600">{item.pendingActionCount} 待审</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Summary footer */}
      <div className="bg-white border-t px-6 py-3 flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          已完成阶段
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          当前阶段
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
          AI 运行中
        </div>
        <div className="ml-auto">
          点击行可进入商机作战台
        </div>
      </div>
    </div>
  )
}
