'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, TrendingUp, AlertTriangle, Bot, Zap, Activity, Shield, XCircle, Trophy, TrendingDown } from 'lucide-react'
import { healthScoreColor } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'

interface DashboardData {
  workspaceCount: number
  signalCount: number
  pendingActionCount: number
  feedbackCount: number
  avgHealthScore: number
  runningAgentCount: number
  failedActionCount: number
  activeRulesCount: number
  acceptRate: number
  wonCount: number
  lostCount: number
  lostReasonDist: Record<string, number>
  lostReasonLabels: Record<string, string>
  highRiskWorkspaces: Array<{ id: string; name: string; healthScore: number; riskScore: number }>
  signalsByType: Record<string, number>
  actionsByStatus: Record<string, number>
  feedbackByLabel: Record<string, number>
  agentEffectiveness: Array<{ agentType: string; agentLabel: string; totalRuns: number; acceptRate: number; correctedCount: number }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () => fetch('/api/dashboard').then((r) => r.json()).then((d) => { setData(d); setLoading(false) })
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400">加载驾驶舱数据...</div>
  )

  if (!data) return null

  return (
    <div className="p-6">
      <PageGuide
        role="管理层"
        what="全局运营数据总览：商机健康度、信号分布、AI 执行状态、进化反馈采纳率、赢单/输单分析"
        firstStep="查看「风险商机」卡片，点击高风险商机名称直接进入该作战台处理"
        storageKey="dashboard"
      />
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard className="w-5 h-5 text-blue-600" />
        <h1 className="text-lg font-semibold">全局运行驾驶舱</h1>
        <span className="text-xs text-gray-400 bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
          系统运行中
        </span>
      </div>

      {/* Alert bar — running agents + failed actions */}
      {(data.runningAgentCount > 0 || data.failedActionCount > 0) && (
        <div className="flex gap-3 mb-4">
          {data.runningAgentCount > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              {data.runningAgentCount} 个数字员工运行中
            </div>
          )}
          {data.failedActionCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <XCircle className="w-4 h-4" />
              {data.failedActionCount} 个动作执行失败，需关注
            </div>
          )}
        </div>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: '活跃战场', value: data.workspaceCount, icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '信号总量', value: data.signalCount, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: '待处理动作', value: data.pendingActionCount, icon: AlertTriangle, color: data.pendingActionCount > 10 ? 'text-red-600' : 'text-orange-600', bg: data.pendingActionCount > 10 ? 'bg-red-50' : 'bg-orange-50' },
          { label: '平均健康分', value: Math.round(data.avgHealthScore), icon: TrendingUp, color: healthScoreColor(data.avgHealthScore), bg: 'bg-green-50' },
          { label: '生效规则数', value: data.activeRulesCount, icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Signal type distribution */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-500" />
            信号类型分布
          </h2>
          <div className="space-y-2">
            {Object.entries(data.signalsByType).map(([type, count]) => {
              const labels: Record<string, string> = {
                demand: '需求', risk: '风险', opportunity: '商机',
                blocker: '阻塞', escalation: '升级', info: '信息'
              }
              const colors: Record<string, string> = {
                demand: 'bg-blue-400', risk: 'bg-red-400', opportunity: 'bg-green-400',
                blocker: 'bg-orange-400', escalation: 'bg-purple-400', info: 'bg-gray-400'
              }
              const total = Object.values(data.signalsByType).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{labels[type] ?? type}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors[type] ?? 'bg-gray-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Action status distribution */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            动作执行状态
          </h2>
          <div className="space-y-2">
            {Object.entries(data.actionsByStatus).map(([status, count]) => {
              const labels: Record<string, string> = {
                pending: '待处理', pending_approval: '待审批',
                approved: '已批准', executing: '执行中',
                completed: '已完成', failed: '失败', rejected: '已驳回'
              }
              const colors: Record<string, string> = {
                pending: 'bg-gray-300', pending_approval: 'bg-yellow-400',
                approved: 'bg-blue-400', executing: 'bg-blue-400',
                completed: 'bg-green-400', failed: 'bg-red-400', rejected: 'bg-red-300'
              }
              const total = Object.values(data.actionsByStatus).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{labels[status] ?? status}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colors[status] ?? 'bg-gray-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Feedback / evolution */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Bot className="w-4 h-4 text-green-500" />
            进化反馈
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-1.5 rounded-full">采纳率 {data.acceptRate}%</span>
          </h2>
          <div className="space-y-2">
            {[
              { key: 'accepted', label: '已采纳', color: 'bg-green-400' },
              { key: 'modified', label: '已修改', color: 'bg-yellow-400' },
              { key: 'rejected', label: '已驳回', color: 'bg-red-400' },
            ].map(({ key, label, color }) => {
              const count = data.feedbackByLabel[key] ?? 0
              const total = Object.values(data.feedbackByLabel).reduce((a, b) => a + b, 0)
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{label}</span>
                    <span className="text-gray-400">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3 pt-2 border-t">共 {data.feedbackCount} 条反馈样本</p>
        </div>

        {/* High risk workspaces */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            风险商机
          </h2>
          {data.highRiskWorkspaces.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">暂无高风险商机</p>
          ) : (
            <div className="space-y-2">
              {data.highRiskWorkspaces.map((w) => (
                <a key={w.id} href={`/workspace/${w.id}`} className="block hover:bg-gray-50 rounded p-2 -mx-2 transition-colors">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-700 truncate flex-1">{w.name}</p>
                    <span className={`text-xs font-bold ml-2 ${healthScoreColor(w.healthScore)}`}>
                      {Math.round(w.healthScore)}
                    </span>
                  </div>
                  <p className="text-xs text-red-500 mt-0.5">风险分 {Math.round(w.riskScore)}</p>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Win/Loss analysis row */}
      <div className="grid grid-cols-2 gap-6 mt-6">
        {/* Win/Loss overview */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            赢单 / 输单统计
          </h2>
          {data.wonCount === 0 && data.lostCount === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">暂无已关闭商机</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Trophy className="w-4 h-4 text-green-500" />
                  <span className="text-2xl font-bold text-green-600">{data.wonCount}</span>
                </div>
                <p className="text-xs text-gray-500">赢单</p>
              </div>
              <div className="w-px h-12 bg-gray-100" />
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-2xl font-bold text-red-600">{data.lostCount}</span>
                </div>
                <p className="text-xs text-gray-500">输单</p>
              </div>
              <div className="w-px h-12 bg-gray-100" />
              <div className="flex-1 text-center">
                <span className="text-2xl font-bold text-blue-600">
                  {data.wonCount + data.lostCount > 0
                    ? Math.round((data.wonCount / (data.wonCount + data.lostCount)) * 100)
                    : 0}%
                </span>
                <p className="text-xs text-gray-500">赢单率</p>
              </div>
            </div>
          )}
        </div>

        {/* Loss reason distribution */}
        <div className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            输单原因分析
          </h2>
          {Object.keys(data.lostReasonDist).length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">暂无输单记录</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(data.lostReasonDist)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => {
                  const total = Object.values(data.lostReasonDist).reduce((a, b) => a + b, 0)
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  const label = data.lostReasonLabels[reason] ?? reason
                  return (
                    <div key={reason}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{label}</span>
                        <span className="text-gray-400">{count}次 ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Agent effectiveness */}
      <div className="mt-6 bg-white rounded-xl border p-4">
        <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-500" />
          数字员工效果（全周期采纳率对比）
        </h2>
        {data.agentEffectiveness.every((a) => a.totalRuns === 0) ? (
          <p className="text-xs text-gray-400 py-4 text-center">暂无反馈数据，数字员工运行并收到人工反馈后将在此展示</p>
        ) : (
          <div className="space-y-3">
            {data.agentEffectiveness.map((agent) => (
              <div key={agent.agentType}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700 w-24 shrink-0">{agent.agentLabel}</span>
                  <div className="flex-1 mx-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        agent.acceptRate >= 70 ? 'bg-green-400' :
                        agent.acceptRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${agent.acceptRate}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <span className={`font-medium w-8 ${
                      agent.acceptRate >= 70 ? 'text-green-600' :
                      agent.acceptRate >= 50 ? 'text-yellow-600' : 'text-red-500'
                    }`}>{agent.totalRuns > 0 ? `${agent.acceptRate}%` : '—'}</span>
                    <span className="text-gray-400 w-12">{agent.totalRuns > 0 ? `${agent.totalRuns}次` : '无数据'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
