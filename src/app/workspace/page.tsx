'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Swords, Plus, TrendingUp, AlertTriangle, Clock, Zap, RefreshCw } from 'lucide-react'
import { healthScoreColor, formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'

interface WorkspaceItem {
  workspace: {
    id: string
    workspaceStatus: string
    currentStage: string | null
    healthScore: number | null
    riskScore: number | null
    updatedAt: string | null
  }
  opportunity: {
    id: string
    name: string
    stage: string
    amount: number | null
  } | null
  customer: {
    id: string
    name: string
    industry: string | null
  } | null
  pendingActionCount: number
  runningAgentCount: number
}

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [opportunities, setOpportunities] = useState<{ id: string; name: string }[]>([])
  const [selectedOppId, setSelectedOppId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => r.json())
      .then((d) => { setWorkspaces(d.workspaces ?? []); setLoading(false) })
  }, [])

  const loadOpportunities = async () => {
    const res = await fetch('/api/opportunities')
    const data = await res.json()
    setOpportunities(data.opportunities ?? [])
  }

  const handleCreate = async () => {
    if (!selectedOppId) return
    setCreating(true)
    await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: selectedOppId }),
    })
    setCreating(false)
    setShowCreate(false)
    const res = await fetch('/api/workspaces')
    const data = await res.json()
    setWorkspaces(data.workspaces ?? [])
  }

  return (
    <div className="p-6">
      <PageGuide
        role="销售 / 解方经理"
        what="每个商机都有专属 AI 作战台，数字员工在这里分析信号、产出建议和行动"
        firstStep="点击任意商机卡片进入作战台，查看 AI 给出的风险预警和下一步建议"
        storageKey="workspace"
      />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Swords className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">商机作战台</h1>
          <span className="text-sm text-gray-500">{workspaces.length} 个活跃战场</span>
        </div>
        <button
          onClick={() => { setShowCreate(true); loadOpportunities() }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          开启战场
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-16">
          <Swords className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">还没有商机战场</p>
          <p className="text-gray-400 text-xs mt-1">为商机创建 AI 协同作战空间</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspaces.map((item) => {
            const { workspace, opportunity, customer, pendingActionCount, runningAgentCount } = item
            return (
              <Link
                key={workspace.id}
                href={`/workspace/${workspace.id}`}
                className="relative bg-white rounded-xl border hover:shadow-md transition-shadow p-5 block"
              >
                {/* Pending actions badge */}
                {pendingActionCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold z-10">
                    {pendingActionCount}
                  </span>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {runningAgentCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                      )}
                      <p className="font-medium text-sm text-gray-900 line-clamp-1">
                        {opportunity?.name ?? '未知商机'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{customer?.name ?? '—'}</p>
                  </div>
                  <span className={`text-xl font-bold ml-2 flex-shrink-0 ${healthScoreColor(workspace.healthScore ?? 0)}`}>
                    {Math.round(workspace.healthScore ?? 0)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {opportunity?.stage ?? workspace.currentStage ?? '—'}
                  </span>
                  {(workspace.riskScore ?? 0) > 30 && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      风险 {Math.round(workspace.riskScore ?? 0)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {opportunity?.amount
                        ? `¥${(opportunity.amount / 10000).toFixed(0)}万`
                        : '—'}
                    </div>
                    {pendingActionCount > 0 && (
                      <span className="flex items-center gap-0.5 text-orange-500">
                        <Zap className="w-3 h-3" />
                        {pendingActionCount} 待审
                      </span>
                    )}
                    {runningAgentCount > 0 && (
                      <span className="flex items-center gap-0.5 text-blue-500">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        运行中
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(workspace.updatedAt)}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-96 p-6">
            <h2 className="text-base font-semibold mb-4">开启商机战场</h2>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">选择商机</label>
              <select
                value={selectedOppId}
                onChange={(e) => setSelectedOppId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">请选择...</option>
                {opportunities.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button
                onClick={handleCreate}
                disabled={!selectedOppId || creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
