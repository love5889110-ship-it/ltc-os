'use client'

import { useState, useMemo } from 'react'
import {
  Bell, Send, XCircle, ChevronRight, X,
  AlertTriangle, CheckCircle, Info, Loader2,
} from 'lucide-react'
import type {
  SkillRecommendation,
  SkillSourceType,
  RecommendationStatus,
  RiskLevel,
} from '../../types'
import { RECOMMENDATION_STATUS_LABELS, SKILL_SOURCE_LABELS } from '../../types'

interface Props {
  recommendations: SkillRecommendation[]
  sendingRecId: string | null
  onSendToTesting: (rec: SkillRecommendation) => Promise<void>
  onDismiss: (recId: string) => void
}

const RISK_LABELS: Record<RiskLevel, string> = { low: '低风险', medium: '中风险', high: '高风险' }
const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-900/30 text-green-400 border-green-700/40',
  medium: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40',
  high: 'bg-red-900/30 text-red-400 border-red-700/40',
}
const STATUS_COLORS: Record<RecommendationStatus, string> = {
  recommended: 'bg-amber-900/30 text-amber-400 border-amber-700/40',
  sent_to_testing: 'bg-blue-900/30 text-blue-400 border-blue-700/40',
  dismissed: 'bg-slate-800 text-slate-500 border-slate-700',
}

export function SkillRecommendationCenter({
  recommendations,
  sendingRecId,
  onSendToTesting,
  onDismiss,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | 'all'>('recommended')
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<SkillSourceType | 'all'>('all')
  const [detailRec, setDetailRec] = useState<SkillRecommendation | null>(null)

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (riskFilter !== 'all' && r.riskLevel !== riskFilter) return false
      if (sourceFilter !== 'all' && r.sourceType !== sourceFilter) return false
      return true
    })
  }, [recommendations, statusFilter, riskFilter, sourceFilter])

  const pendingCount = recommendations.filter((r) => r.status === 'recommended').length

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">技能推荐中心</span>
          {pendingCount > 0 && (
            <span className="text-[9px] bg-amber-600/80 text-white px-1.5 py-0.5 rounded-full leading-none">
              {pendingCount} 条待处理
            </span>
          )}
        </div>
        <p className="text-[9px] text-slate-600">预置技能库和内置工具中尚未分配给 Agent 的技能</p>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/30 flex-wrap">
        {/* 状态筛选 */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-600 mr-0.5">状态</span>
          {(['all', 'recommended', 'sent_to_testing', 'dismissed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-indigo-600/40 text-indigo-300 border-indigo-600/50'
                  : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-400'
              }`}
            >
              {s === 'all' ? '全部' : RECOMMENDATION_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {/* 风险筛选 */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-600 mr-0.5">风险</span>
          {(['all', 'low', 'medium', 'high'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                riskFilter === r
                  ? 'bg-indigo-600/40 text-indigo-300 border-indigo-600/50'
                  : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-400'
              }`}
            >
              {r === 'all' ? '全部' : RISK_LABELS[r]}
            </button>
          ))}
        </div>
        {/* 来源筛选 */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-600 mr-0.5">来源</span>
          {(['all', 'internal', 'employee_built', 'external'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                sourceFilter === s
                  ? 'bg-indigo-600/40 text-indigo-300 border-indigo-600/50'
                  : 'bg-transparent text-slate-500 border-slate-700 hover:text-slate-400'
              }`}
            >
              {s === 'all' ? '全部' : SKILL_SOURCE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 列表区（含详情抽屉） */}
      <div className="flex min-h-0 relative">
        {/* 推荐列表 */}
        <div className={`flex-1 min-w-0 transition-all ${detailRec ? 'max-w-[60%]' : ''}`}>
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-600 text-xs">
              {statusFilter === 'recommended' ? '暂无待处理推荐' : '暂无符合条件的推荐'}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {filtered.map((rec) => (
                <div
                  key={rec.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-800/20 transition-colors cursor-pointer ${
                    detailRec?.id === rec.id ? 'bg-slate-800/30' : ''
                  }`}
                  onClick={() => setDetailRec(detailRec?.id === rec.id ? null : rec)}
                >
                  {/* 状态点 */}
                  <div className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                    rec.status === 'recommended' ? 'bg-amber-400' :
                    rec.status === 'sent_to_testing' ? 'bg-blue-400' : 'bg-slate-600'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-xs text-slate-200 font-medium">{rec.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[rec.status]}`}>
                        {RECOMMENDATION_STATUS_LABELS[rec.status]}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${RISK_COLORS[rec.riskLevel]}`}>
                        {RISK_LABELS[rec.riskLevel]}
                      </span>
                      {rec.requiresAdaptation && (
                        <span className="text-[9px] bg-purple-900/30 text-purple-400 border border-purple-700/40 px-1.5 py-0.5 rounded">
                          需适配
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1">{rec.description}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5 line-clamp-1">{rec.recommendationReason}</p>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {rec.status === 'recommended' && (
                      <>
                        <button
                          onClick={() => onSendToTesting(rec)}
                          disabled={sendingRecId === rec.id}
                          className="flex items-center gap-1 text-[9px] bg-indigo-600/80 hover:bg-indigo-500 text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {sendingRecId === rec.id
                            ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            : <Send className="w-2.5 h-2.5" />}
                          {sendingRecId === rec.id ? '送入中…' : '送入装载'}
                        </button>
                        <button
                          onClick={() => onDismiss(rec.id)}
                          className="text-[9px] text-slate-600 hover:text-slate-400 transition-colors px-1"
                        >
                          忽略
                        </button>
                      </>
                    )}
                    {rec.status === 'sent_to_testing' && (
                      <span className="text-[9px] text-blue-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />已送入
                      </span>
                    )}
                    {rec.status === 'dismissed' && (
                      <span className="text-[9px] text-slate-600 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />已忽略
                      </span>
                    )}
                    <button
                      onClick={() => setDetailRec(detailRec?.id === rec.id ? null : rec)}
                      className="text-[9px] text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-0.5 ml-1"
                    >
                      详情 <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 详情抽屉 */}
        {detailRec && (
          <div className="w-[40%] flex-shrink-0 border-l border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300">推荐详情</span>
              <button
                onClick={() => setDetailRec(null)}
                className="text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-96">
              {/* 名称与状态 */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">{detailRec.title}</h4>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[detailRec.status]}`}>
                    {RECOMMENDATION_STATUS_LABELS[detailRec.status]}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${RISK_COLORS[detailRec.riskLevel]}`}>
                    {RISK_LABELS[detailRec.riskLevel]}
                  </span>
                  <span className="text-[9px] bg-slate-800 text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                    {SKILL_SOURCE_LABELS[detailRec.sourceType]}
                    {detailRec.sourceName ? ` · ${detailRec.sourceName}` : ''}
                  </span>
                </div>
              </div>

              {/* 描述 */}
              <div>
                <p className="text-[9px] text-slate-500 mb-0.5 uppercase tracking-wider">功能描述</p>
                <p className="text-[10px] text-slate-300 leading-relaxed">{detailRec.description}</p>
              </div>

              {/* 推荐理由 */}
              <div className="bg-indigo-950/30 border border-indigo-800/30 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Info className="w-3 h-3 text-indigo-400" />
                  <span className="text-[9px] text-indigo-400 font-medium">推荐理由</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">{detailRec.recommendationReason}</p>
              </div>

              {/* 适用范围 */}
              <div className="space-y-1">
                {detailRec.recommendedForTaskType && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 w-20 flex-shrink-0">适用任务类型</span>
                    <span className="text-[9px] text-slate-300">{detailRec.recommendedForTaskType}</span>
                  </div>
                )}
                {detailRec.recommendedForAgent && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 w-20 flex-shrink-0">适用 Agent</span>
                    <span className="text-[9px] text-slate-300">{detailRec.recommendedForAgent}</span>
                  </div>
                )}
                {detailRec.estimatedUsefulness !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 w-20 flex-shrink-0">预估有用程度</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.round(detailRec.estimatedUsefulness * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400">{Math.round(detailRec.estimatedUsefulness * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 注意事项 */}
              {(detailRec.requiresAdaptation || detailRec.requiresReviewGate) && (
                <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-xl px-3 py-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    <span className="text-[9px] text-yellow-400 font-medium">注意事项</span>
                  </div>
                  {detailRec.requiresAdaptation && (
                    <p className="text-[9px] text-yellow-400/80">此技能需要完成 Schema 适配才能正式装载</p>
                  )}
                  {detailRec.requiresReviewGate && (
                    <p className="text-[9px] text-yellow-400/80">此技能执行前需要人工审核门</p>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              {detailRec.status === 'recommended' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { onDismiss(detailRec.id); setDetailRec(null) }}
                    className="flex-1 text-[9px] text-red-400 hover:text-red-300 border border-red-800/40 hover:border-red-700/60 py-1.5 rounded-lg transition-colors"
                  >
                    忽略此推荐
                  </button>
                  <button
                    onClick={() => { onSendToTesting(detailRec); setDetailRec(null) }}
                    disabled={sendingRecId === detailRec.id}
                    className="flex-[2] flex items-center justify-center gap-1.5 text-[9px] bg-indigo-600/80 hover:bg-indigo-500 text-white py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {sendingRecId === detailRec.id
                      ? <><Loader2 className="w-2.5 h-2.5 animate-spin" />送入中…</>
                      : <><Send className="w-2.5 h-2.5" />送入测试装载区</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
