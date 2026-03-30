'use client'

import { useState } from 'react'
import {
  ArrowRight, CheckCircle, Play, BarChart2, Link2,
  FileText, BookOpen, Sparkles, Zap, Settings,
  Bell, ChevronLeft,
} from 'lucide-react'
import type {
  ActionSkill,
  SkillAdapter,
  SkillTestCase,
  SkillBinding,
  SkillExecutionLog,
  AgentCapabilityPageState,
  SkillRecommendation,
  SkillLoadCandidate,
  CandidateStatus,
} from '../../types'
import {
  SKILL_STATUS_LABELS, SKILL_STATUS_TRANSITIONS,
} from '../../types'
import {
  updateActionSkillStatus,
  sendRecommendationToTesting,
  updateRecommendationStatus,
  publishCandidateAsCallable,
} from '../../services'
import { ActionSkillList } from './ActionSkillList'
import { SkillTrainingPanel } from './SkillTrainingPanel'
import { ActionSkillImportDialog } from './ActionSkillImportDialog'
import { ActionSkillAdapterPanel } from './ActionSkillAdapterPanel'
import { ActionSkillTestPanel } from './ActionSkillTestPanel'
import { ActionSkillTestCasePanel } from './ActionSkillTestCasePanel'
import { ActionSkillEvaluationPanel } from './ActionSkillEvaluationPanel'
import { ActionSkillBindingPanel } from './ActionSkillBindingPanel'
import { ActionSkillExecutionLogPanel } from './ActionSkillExecutionLogPanel'
import { SkillRecommendationCenter } from './SkillRecommendationCenter'
import { SkillLoadTestingZone } from './SkillLoadTestingZone'

type ViewMode = 'list' | 'training' | 'import' | 'recommend'
type ActionSubTab = 'test' | 'binding' | 'adapter' | 'cases' | 'evaluation' | 'logs'

// 精简 Tab：把最重要的放前面，技术向的放后面
const ACTION_SUB_TABS: Array<{ id: ActionSubTab; label: string; icon: React.ReactNode; badge?: string }> = [
  { id: 'test', label: '调试', icon: <Play className="w-3 h-3" /> },
  { id: 'binding', label: '绑定 Agent', icon: <Link2 className="w-3 h-3" /> },
  { id: 'adapter', label: '适配层', icon: <Settings className="w-3 h-3" /> },
  { id: 'cases', label: '测试样例', icon: <FileText className="w-3 h-3" /> },
  { id: 'evaluation', label: '评测', icon: <BarChart2 className="w-3 h-3" /> },
  { id: 'logs', label: '执行日志', icon: <BookOpen className="w-3 h-3" /> },
]

interface Props {
  state: AgentCapabilityPageState
  highlightIds: string[]
  onStateUpdate: (partial: Partial<AgentCapabilityPageState>) => void
  onAddToFeedback: (log: SkillExecutionLog) => void
}

export function ActionCapabilityPanel({ state, highlightIds, onStateUpdate, onAddToFeedback }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<ActionSubTab>('test')
  const [transitioning, setTransitioning] = useState(false)
  const [sendingRecId, setSendingRecId] = useState<string | null>(null)
  const [publishingCandId, setPublishingCandId] = useState<string | null>(null)

  const selectedSkill = state.actionSkills.find((s) => s.id === selectedSkillId) ?? null
  const pendingRecs = state.skillRecommendations.filter((r) => r.status === 'recommended')

  const handleSkillTrained = (skill: ActionSkill) => {
    onStateUpdate({ actionSkills: [...state.actionSkills, skill] })
    setViewMode('list')
    setSelectedSkillId(skill.id)
    setActiveSubTab('test')
  }

  const handleSkillImported = (skill: ActionSkill) => {
    onStateUpdate({ actionSkills: [...state.actionSkills, skill] })
    setViewMode('list')
    setSelectedSkillId(skill.id)
    setActiveSubTab('adapter')
  }

  const handleAdapterSaved = (adapter: SkillAdapter) => {
    const existing = state.skillAdapters.find((a) => a.skillId === adapter.skillId)
    const updated = existing
      ? state.skillAdapters.map((a) => (a.skillId === adapter.skillId ? adapter : a))
      : [...state.skillAdapters, adapter]
    onStateUpdate({ skillAdapters: updated })
  }

  const handleLogAdded = (log: SkillExecutionLog) => {
    onStateUpdate({ executionLogs: [...state.executionLogs, log] })
  }

  const handleCasesUpdated = (cases: SkillTestCase[]) => {
    const otherCases = state.skillTestCases.filter((c) => c.skillId !== selectedSkillId)
    onStateUpdate({ skillTestCases: [...otherCases, ...cases] })
  }

  const handleBindingsUpdated = (bindings: SkillBinding[]) => {
    onStateUpdate({ skillBindings: bindings })
  }

  // 推荐 → 送入装载候选
  const handleSendToTesting = async (rec: SkillRecommendation) => {
    setSendingRecId(rec.id)
    try {
      const candidate = await sendRecommendationToTesting(rec)
      await updateRecommendationStatus(rec.id, 'sent_to_testing')
      onStateUpdate({
        skillRecommendations: state.skillRecommendations.map((r) =>
          r.id === rec.id ? { ...r, status: 'sent_to_testing' as const } : r
        ),
        skillLoadCandidates: [...state.skillLoadCandidates, candidate],
      })
    } finally {
      setSendingRecId(null)
    }
  }

  // 忽略推荐
  const handleDismissRec = async (recId: string) => {
    await updateRecommendationStatus(recId, 'dismissed')
    onStateUpdate({
      skillRecommendations: state.skillRecommendations.map((r) =>
        r.id === recId ? { ...r, status: 'dismissed' as const } : r
      ),
    })
  }

  // 候选 → 发布为可调用技能（绑定到所有推荐 Agent）
  const handlePublishCandidate = async (cand: SkillLoadCandidate) => {
    setPublishingCandId(cand.id)
    try {
      const adapter = state.skillAdapters.find((a) => a.skillId === cand.skillId) ?? null
      const skill = await publishCandidateAsCallable(cand, adapter, cand.targetAgents)
      const exists = state.actionSkills.find((s) => s.id === skill.id)
      onStateUpdate({
        actionSkills: exists
          ? state.actionSkills.map((s) => (s.id === skill.id ? skill : s))
          : [...state.actionSkills, skill],
        skillLoadCandidates: state.skillLoadCandidates.map((c) =>
          c.id === cand.id ? { ...c, status: 'callable' as const } : c
        ),
      })
      setViewMode('list')
      setSelectedSkillId(skill.id)
    } finally {
      setPublishingCandId(null)
    }
  }

  // Status transition
  const validNextStatuses = selectedSkill ? (SKILL_STATUS_TRANSITIONS[selectedSkill.status] ?? []) : []

  const handleStatusTransition = async (nextStatus: ActionSkill['status']) => {
    if (!selectedSkill) return
    setTransitioning(true)
    try {
      const result = await updateActionSkillStatus(selectedSkill.id, selectedSkill.status, nextStatus)
      if (result.success) {
        onStateUpdate({
          actionSkills: state.actionSkills.map((s) =>
            s.id === selectedSkill.id ? { ...s, status: nextStatus } : s
          ),
        })
      }
    } finally {
      setTransitioning(false)
    }
  }

  const statusTransitionLabels: Record<ActionSkill['status'], string> = {
    draft: '开始测试',
    testing: '标记为已验证',
    validated: '发布为可调用',
    callable: '停用技能',
    disabled: '恢复为草稿',
  }

  const statusTransitionColors: Record<ActionSkill['status'], string> = {
    draft: 'bg-yellow-600/80 hover:bg-yellow-500',
    testing: 'bg-blue-600/80 hover:bg-blue-500',
    validated: 'bg-green-600/80 hover:bg-green-500',
    callable: 'bg-red-700/80 hover:bg-red-600',
    disabled: 'bg-slate-600/80 hover:bg-slate-500',
  }

  // 训练或导入模式：全屏展示
  if (viewMode === 'training') {
    return (
      <SkillTrainingPanel
        onPublished={handleSkillTrained}
        onCancel={() => setViewMode('list')}
      />
    )
  }

  if (viewMode === 'import') {
    return (
      <div className="flex flex-col gap-4">
        <ActionSkillImportDialog
          onImported={handleSkillImported}
          onCancel={() => setViewMode('list')}
        />
      </div>
    )
  }

  // 推荐中心：完整版（筛选+详情抽屉+装载候选流程）
  if (viewMode === 'recommend') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setViewMode('list')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          返回技能库
        </button>

        <SkillRecommendationCenter
          recommendations={state.skillRecommendations}
          sendingRecId={sendingRecId}
          onSendToTesting={handleSendToTesting}
          onDismiss={handleDismissRec}
        />

        {state.skillLoadCandidates.length > 0 && (
          <SkillLoadTestingZone
            candidates={state.skillLoadCandidates}
            adapters={state.skillAdapters}
            onAdapterSaved={handleAdapterSaved}
            onPublishCandidate={handlePublishCandidate}
            onRejectCandidate={(candId) => {
              onStateUpdate({
                skillLoadCandidates: state.skillLoadCandidates.map((c) =>
                  c.id === candId ? { ...c, status: 'rejected' as const } : c
                ),
              })
            }}
            onCandidateStatusUpdate={(candId, status) => {
              onStateUpdate({
                skillLoadCandidates: state.skillLoadCandidates.map((c) =>
                  c.id === candId ? { ...c, status } : c
                ),
              })
            }}
            publishingCandId={publishingCandId}
            onAddToFeedback={onAddToFeedback}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex gap-4 min-h-0">
      {/* 左侧：技能列表 */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-2">
        {/* 主操作按钮：AI 训练 */}
        <button
          onClick={() => setViewMode('training')}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/40 hover:border-indigo-500/60 text-indigo-300 rounded-xl transition-colors group"
        >
          <Sparkles className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 flex-shrink-0" />
          <div className="text-left min-w-0">
            <p className="text-xs font-semibold">训练新技能</p>
            <p className="text-[9px] text-indigo-400/70 truncate">用对话描述，AI 自动构建</p>
          </div>
        </button>

        {/* 推荐中心入口 */}
        <button
          onClick={() => setViewMode('recommend')}
          className="w-full flex items-center gap-2 px-3 py-2 bg-amber-900/10 hover:bg-amber-900/20 border border-amber-800/30 hover:border-amber-700/50 text-amber-400/80 hover:text-amber-300 rounded-xl transition-colors"
        >
          <Bell className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[10px] flex-1 text-left">推荐中心</span>
          {pendingRecs.length > 0 && (
            <span className="text-[9px] bg-amber-600/80 text-white px-1.5 py-0.5 rounded-full leading-none">
              {pendingRecs.length}
            </span>
          )}
        </button>

        {/* 次操作：导入 */}
        <button
          onClick={() => setViewMode('import')}
          className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 rounded-xl transition-colors"
        >
          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-[10px]">导入现有技能（JSON）</span>
        </button>

        {/* 技能列表 */}
        <ActionSkillList
          skills={state.actionSkills}
          selectedId={selectedSkillId}
          highlightIds={highlightIds}
          bindings={state.skillBindings}
          onSelect={(skill) => {
            setSelectedSkillId(skill.id)
            setActiveSubTab('test')
          }}
        />
      </div>

      {/* 右侧：技能详情 */}
      <div className="flex-1 min-w-0">
        {!selectedSkill ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-600 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500">选择左侧技能查看详情</p>
              <p className="text-xs text-slate-600 mt-1">或点击「训练新技能」开始 AI 对话训练</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 技能信息头 */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white truncate">{selectedSkill.name}</h3>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
                      selectedSkill.status === 'callable' ? 'bg-green-900/40 text-green-400' :
                      selectedSkill.status === 'validated' ? 'bg-blue-900/40 text-blue-400' :
                      selectedSkill.status === 'testing' ? 'bg-yellow-900/40 text-yellow-400' :
                      selectedSkill.status === 'disabled' ? 'bg-red-900/40 text-red-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {SKILL_STATUS_LABELS[selectedSkill.status]}
                    </span>
                    {selectedSkill.requiresHumanReview && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-400 flex-shrink-0">
                        需人工审核
                      </span>
                    )}
                    {highlightIds.includes(selectedSkill.id) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400 flex-shrink-0 flex items-center gap-0.5">
                        <CheckCircle className="w-2.5 h-2.5" />决策推荐
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{selectedSkill.description}</p>
                </div>

                {/* 状态流转按钮 */}
                {validNextStatuses.length > 0 && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {validNextStatuses.map((next) => (
                      <button
                        key={next}
                        onClick={() => handleStatusTransition(next)}
                        disabled={transitioning}
                        className={`flex items-center gap-1 text-[9px] text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${statusTransitionColors[selectedSkill.status]}`}
                      >
                        <ArrowRight className="w-2.5 h-2.5" />
                        {statusTransitionLabels[selectedSkill.status]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 新手引导：草稿状态显示下一步提示 */}
            {selectedSkill.status === 'draft' && (
              <div className="flex items-center gap-3 bg-yellow-900/10 border border-yellow-800/30 rounded-xl px-3 py-2.5">
                <div className="flex-shrink-0 w-5 h-5 bg-yellow-600/20 rounded-full flex items-center justify-center">
                  <span className="text-[10px] text-yellow-400 font-bold">1</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-yellow-300 font-medium">先测试，再发布</p>
                  <p className="text-[9px] text-yellow-500/70">在「调试」Tab 中选择一个真实商机，验证技能能否正常执行</p>
                </div>
                <button
                  onClick={() => setActiveSubTab('test')}
                  className="text-[9px] text-yellow-400 hover:text-yellow-300 transition-colors flex-shrink-0"
                >
                  去调试 →
                </button>
              </div>
            )}

            {selectedSkill.status === 'validated' && (
              <div className="flex items-center gap-3 bg-blue-900/10 border border-blue-800/30 rounded-xl px-3 py-2.5">
                <div className="flex-shrink-0 w-5 h-5 bg-blue-600/20 rounded-full flex items-center justify-center">
                  <span className="text-[10px] text-blue-400 font-bold">2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-blue-300 font-medium">已验证，可以发布</p>
                  <p className="text-[9px] text-blue-500/70">点击右上角「发布为可调用」，然后在「绑定 Agent」中分配给 Agent</p>
                </div>
              </div>
            )}

            {selectedSkill.status === 'callable' && (
              <div className="flex items-center gap-3 bg-green-900/10 border border-green-800/30 rounded-xl px-3 py-2.5">
                <div className="flex-shrink-0 w-5 h-5 bg-green-600/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-green-300 font-medium">技能已上线</p>
                  <p className="text-[9px] text-green-500/70">Agent 在处理相关任务时会自动调用此技能</p>
                </div>
                <button
                  onClick={() => setActiveSubTab('binding')}
                  className="text-[9px] text-green-400 hover:text-green-300 transition-colors flex-shrink-0"
                >
                  查看绑定 →
                </button>
              </div>
            )}

            {/* 子 Tab 导航 */}
            <div className="flex gap-1 border-b border-slate-800 pb-0">
              {ACTION_SUB_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[10px] transition-colors border-b-2 -mb-px ${
                    activeSubTab === tab.id
                      ? 'text-indigo-400 border-indigo-500'
                      : 'text-slate-500 border-transparent hover:text-slate-400'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 子 Tab 内容 */}
            <div>
              {activeSubTab === 'test' && (
                <ActionSkillTestPanel
                  skill={selectedSkill}
                  onLogAdded={handleLogAdded}
                  onAddToFeedback={onAddToFeedback}
                />
              )}
              {activeSubTab === 'binding' && (
                <ActionSkillBindingPanel
                  skills={state.actionSkills}
                  bindings={state.skillBindings}
                  onBindingsUpdated={handleBindingsUpdated}
                />
              )}
              {activeSubTab === 'adapter' && (
                <ActionSkillAdapterPanel
                  skill={selectedSkill}
                  adapters={state.skillAdapters}
                  onAdapterSaved={handleAdapterSaved}
                />
              )}
              {activeSubTab === 'cases' && (
                <ActionSkillTestCasePanel
                  skill={selectedSkill}
                  testCases={state.skillTestCases}
                  onCasesUpdated={handleCasesUpdated}
                  onLogAdded={handleLogAdded}
                />
              )}
              {activeSubTab === 'evaluation' && (
                <ActionSkillEvaluationPanel
                  skillId={selectedSkill.id}
                  executionLogs={state.executionLogs}
                />
              )}
              {activeSubTab === 'logs' && (
                <ActionSkillExecutionLogPanel
                  logs={state.executionLogs}
                  skillId={selectedSkill.id}
                  onAddToFeedback={onAddToFeedback}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
