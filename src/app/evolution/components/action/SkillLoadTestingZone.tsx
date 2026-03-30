'use client'

import { useState, useMemo } from 'react'
import {
  PackageCheck, AlertCircle, CheckCircle, XCircle,
  Settings, Play, FileText, BarChart2, ChevronRight,
  Loader2,
} from 'lucide-react'
import type {
  SkillLoadCandidate,
  SkillAdapter,
  SkillExecutionLog,
  SkillTestCase,
  CandidateStatus,
} from '../../types'
import { CANDIDATE_STATUS_LABELS } from '../../types'
import { candidateToSkill } from '../../services'
import { ActionSkillAdapterPanel } from './ActionSkillAdapterPanel'
import { ActionSkillTestPanel } from './ActionSkillTestPanel'
import { ActionSkillTestCasePanel } from './ActionSkillTestCasePanel'
import { ActionSkillEvaluationPanel } from './ActionSkillEvaluationPanel'

type CandidateSubTab = 'adapter' | 'test' | 'cases' | 'evaluation'

const CANDIDATE_TABS: Array<{ id: CandidateSubTab; label: string; icon: React.ReactNode; required: boolean }> = [
  { id: 'adapter',    label: '适配层',  icon: <Settings className="w-3 h-3" />,   required: true },
  { id: 'test',       label: '单次调试', icon: <Play className="w-3 h-3" />,       required: true },
  { id: 'cases',      label: '样例测试', icon: <FileText className="w-3 h-3" />,   required: false },
  { id: 'evaluation', label: '评测报告', icon: <BarChart2 className="w-3 h-3" />,  required: false },
]

const CANDIDATE_STATUS_COLORS: Record<CandidateStatus, string> = {
  pending_adaptation: 'bg-slate-800 text-slate-400 border-slate-700',
  adapting:           'bg-yellow-900/30 text-yellow-400 border-yellow-700/40',
  testing:            'bg-blue-900/30 text-blue-400 border-blue-700/40',
  validated:          'bg-indigo-900/30 text-indigo-400 border-indigo-700/40',
  callable:           'bg-green-900/30 text-green-400 border-green-700/40',
  rejected:           'bg-red-900/30 text-red-400 border-red-700/40',
}

interface Props {
  candidates: SkillLoadCandidate[]
  adapters: SkillAdapter[]
  onAdapterSaved: (adapter: SkillAdapter) => void
  onPublishCandidate: (cand: SkillLoadCandidate) => Promise<void>
  onRejectCandidate: (candId: string) => void
  onCandidateStatusUpdate: (candId: string, status: CandidateStatus) => void
  publishingCandId: string | null
  onAddToFeedback: (log: SkillExecutionLog) => void
}

export function SkillLoadTestingZone({
  candidates,
  adapters,
  onAdapterSaved,
  onPublishCandidate,
  onRejectCandidate,
  onCandidateStatusUpdate,
  publishingCandId,
  onAddToFeedback,
}: Props) {
  const [selectedCandId, setSelectedCandId] = useState<string | null>(
    candidates[0]?.id ?? null
  )
  const [activeTab, setActiveTab] = useState<CandidateSubTab>('adapter')
  // 候选维度本地 state，不污染全局 executionLogs
  const [localLogs, setLocalLogs] = useState<SkillExecutionLog[]>([])
  const [localCases, setLocalCases] = useState<SkillTestCase[]>([])

  const selectedCand = candidates.find((c) => c.id === selectedCandId) ?? null

  // 门控检查
  function canPublish(cand: SkillLoadCandidate): { ok: boolean; reasons: string[] } {
    const reasons: string[] = []
    const hasAdapter = adapters.some((a) => a.skillId === cand.id)
    if (!hasAdapter) reasons.push('未完成适配层配置')

    const candLogs = localLogs.filter((l) => l.skillId === cand.id)
    if (candLogs.length === 0) reasons.push('未进行过调试测试')

    const candCases = localCases.filter((c) => c.skillId === cand.id)
    if (candCases.length > 0 && candCases.some((c) => c.status === 'fail')) {
      reasons.push('存在未通过的测试样例')
    }

    if (candLogs.length > 0) {
      const successRate = candLogs.filter((l) => l.status === 'success').length / candLogs.length
      if (successRate < 0.5) reasons.push('调试成功率低于 50%')
    }

    return { ok: reasons.length === 0, reasons }
  }

  // 适配器保存后自动推进状态
  function handleAdapterSaved(adapter: SkillAdapter) {
    onAdapterSaved(adapter)
    if (selectedCand && ['pending_adaptation', 'adapting'].includes(selectedCand.status)) {
      onCandidateStatusUpdate(selectedCand.id, 'testing')
    }
  }

  // 调试日志新增后检查是否可以自动 validated
  function handleLogAdded(log: SkillExecutionLog) {
    const newLogs = [...localLogs, log]
    setLocalLogs(newLogs)

    if (!selectedCand) return
    const candLogs = newLogs.filter((l) => l.skillId === selectedCand.id)
    const successRate = candLogs.filter((l) => l.status === 'success').length / candLogs.length
    const hasCases = localCases.some((c) => c.skillId === selectedCand.id)
    const allCasesPassed = !hasCases || localCases.filter((c) => c.skillId === selectedCand.id).every((c) => c.status === 'pass')

    if (successRate >= 0.8 && allCasesPassed && selectedCand.status === 'testing') {
      onCandidateStatusUpdate(selectedCand.id, 'validated')
    }
  }

  function handleCasesUpdated(newCases: SkillTestCase[]) {
    const othersSkillId = selectedCand?.id
    const otherCases = localCases.filter((c) => c.skillId !== othersSkillId)
    setLocalCases([...otherCases, ...newCases])
  }

  // 进度指示：已完成哪些步骤
  const progress = useMemo(() => (cand: SkillLoadCandidate) => {
    const hasAdapter = adapters.some((a) => a.skillId === cand.id)
    const hasTested = localLogs.some((l) => l.skillId === cand.id)
    return { hasAdapter, hasTested }
  }, [adapters, localLogs])

  if (candidates.length === 0) return null

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/60">
        <PackageCheck className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-slate-300">安全测试装载区</span>
        <span className="text-[9px] text-slate-600">{candidates.length} 条候选</span>
        <span className="text-[9px] text-slate-700 ml-2">— 候选技能需完成适配→调试→评测后才能发布上线</span>
      </div>

      <div className="flex min-h-0">
        {/* 左侧：候选列表 */}
        <div className="w-56 flex-shrink-0 border-r border-slate-800 flex flex-col">
          {candidates.map((cand) => {
            const { hasAdapter, hasTested } = progress(cand)
            return (
              <button
                key={cand.id}
                onClick={() => { setSelectedCandId(cand.id); setActiveTab('adapter') }}
                className={`flex items-start gap-2 px-3 py-2.5 text-left border-b border-slate-800/60 transition-colors ${
                  selectedCandId === cand.id
                    ? 'bg-slate-800/50 border-l-2 border-l-indigo-500'
                    : 'hover:bg-slate-800/20 border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-200 font-medium truncate mb-0.5">
                    {cand.rawName}
                  </p>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded border ${CANDIDATE_STATUS_COLORS[cand.status]}`}>
                    {CANDIDATE_STATUS_LABELS[cand.status]}
                  </span>
                  {/* 进度小图标 */}
                  <div className="flex items-center gap-1 mt-1">
                    <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${hasAdapter ? 'bg-green-500' : 'bg-slate-700'}`}>
                      <Settings className="w-1.5 h-1.5 text-white" />
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${hasTested ? 'bg-green-500' : 'bg-slate-700'}`}>
                      <Play className="w-1.5 h-1.5 text-white" />
                    </div>
                    {(cand.needsSchemaNormalization || cand.needsPermissionReview || cand.needsReviewGate) && (
                      <AlertCircle className="w-2.5 h-2.5 text-yellow-500 ml-0.5" />
                    )}
                  </div>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0 mt-0.5" />
              </button>
            )
          })}
        </div>

        {/* 右侧：候选详情 */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selectedCand ? (
            <div className="flex items-center justify-center h-48 text-slate-600 text-xs">
              选择左侧候选技能
            </div>
          ) : (
            <>
              {/* 候选信息头 */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/30">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h4 className="text-sm font-semibold text-white">{selectedCand.rawName}</h4>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${CANDIDATE_STATUS_COLORS[selectedCand.status]}`}>
                        {CANDIDATE_STATUS_LABELS[selectedCand.status]}
                      </span>
                    </div>
                    {selectedCand.description && (
                      <p className="text-[10px] text-slate-500">{selectedCand.description}</p>
                    )}
                    {/* 检查项提示 */}
                    {(selectedCand.needsSchemaNormalization || selectedCand.needsPermissionReview || selectedCand.needsReviewGate) && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <AlertCircle className="w-3 h-3 text-yellow-500" />
                        {selectedCand.needsSchemaNormalization && (
                          <span className="text-[9px] text-yellow-500 bg-yellow-900/20 px-1.5 py-0.5 rounded">需 Schema 归一化</span>
                        )}
                        {selectedCand.needsPermissionReview && (
                          <span className="text-[9px] text-yellow-500 bg-yellow-900/20 px-1.5 py-0.5 rounded">需权限审查</span>
                        )}
                        {selectedCand.needsReviewGate && (
                          <span className="text-[9px] text-yellow-500 bg-yellow-900/20 px-1.5 py-0.5 rounded">需审核门</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tab 导航 */}
              <div className="flex gap-1 border-b border-slate-800 px-4 pb-0">
                {CANDIDATE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[10px] transition-colors border-b-2 -mb-px ${
                      activeTab === tab.id
                        ? 'text-indigo-400 border-indigo-500'
                        : 'text-slate-500 border-transparent hover:text-slate-400'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.required && (
                      <span className="text-[7px] text-red-500 leading-none">*</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab 内容（复用现有面板） */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {activeTab === 'adapter' && (
                  <ActionSkillAdapterPanel
                    skill={candidateToSkill(selectedCand)}
                    adapters={adapters}
                    onAdapterSaved={handleAdapterSaved}
                  />
                )}
                {activeTab === 'test' && (
                  <ActionSkillTestPanel
                    skill={candidateToSkill(selectedCand)}
                    onLogAdded={handleLogAdded}
                    onAddToFeedback={onAddToFeedback}
                  />
                )}
                {activeTab === 'cases' && (
                  <ActionSkillTestCasePanel
                    skill={candidateToSkill(selectedCand)}
                    testCases={localCases.filter((c) => c.skillId === selectedCand.id)}
                    onCasesUpdated={handleCasesUpdated}
                    onLogAdded={handleLogAdded}
                  />
                )}
                {activeTab === 'evaluation' && (
                  <ActionSkillEvaluationPanel
                    skillId={selectedCand.id}
                    executionLogs={localLogs}
                  />
                )}
              </div>

              {/* 发布区域（底部门控） */}
              {selectedCand.status !== 'callable' && selectedCand.status !== 'rejected' && (
                <div className="border-t border-slate-800 px-4 py-3 bg-slate-900/30">
                  {(() => {
                    const { ok, reasons } = canPublish(selectedCand)
                    return (
                      <div className="space-y-2">
                        {!ok && (
                          <div className="space-y-1">
                            {reasons.map((reason) => (
                              <div key={reason} className="flex items-center gap-1.5 text-[9px] text-yellow-400">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                {reason}
                              </div>
                            ))}
                          </div>
                        )}
                        {ok && (
                          <div className="flex items-center gap-1.5 text-[9px] text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            已满足发布条件
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => onRejectCandidate(selectedCand.id)}
                            className="flex items-center gap-1 text-[9px] text-red-400 hover:text-red-300 border border-red-800/40 hover:border-red-700/60 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                            拒绝装载
                          </button>
                          <button
                            onClick={() => onPublishCandidate(selectedCand)}
                            disabled={!ok || publishingCandId === selectedCand.id}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[9px] bg-green-700/80 hover:bg-green-600 disabled:opacity-40 text-white py-1.5 rounded-lg transition-colors font-semibold"
                          >
                            {publishingCandId === selectedCand.id ? (
                              <><Loader2 className="w-3 h-3 animate-spin" />发布中…</>
                            ) : ok ? (
                              <><PackageCheck className="w-3 h-3" />发布上线</>
                            ) : (
                              <>还需完成 {reasons.length} 项检查</>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              {selectedCand.status === 'callable' && (
                <div className="border-t border-slate-800 px-4 py-3 bg-green-950/10">
                  <div className="flex items-center gap-1.5 text-[10px] text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    此候选已发布上线，可在「技能库」中查看
                  </div>
                </div>
              )}
              {selectedCand.status === 'rejected' && (
                <div className="border-t border-slate-800 px-4 py-3 bg-red-950/10">
                  <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                    此候选已被拒绝装载
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
