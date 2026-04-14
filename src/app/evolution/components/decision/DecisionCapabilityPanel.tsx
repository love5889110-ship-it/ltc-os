'use client'

import { useState } from 'react'
import type {
  EvolutionTab, FeedbackSample, FeedbackType, WritebackTarget,
  GovernanceRule, RefinementParam, CapabilityConfig,
  DecisionResult, DecisionEvaluation, ActionSkill,
} from '../../types'
import { FeedbackFilterBar } from './FeedbackFilterBar'
import { FeedbackSampleList } from './FeedbackSampleList'
import { FeedbackSampleDetailDrawer } from './FeedbackSampleDetailDrawer'
import { RuleGovernancePanel } from './RuleGovernancePanel'
import { RefinementParamsPanel } from './RefinementParamsPanel'
import { ConfigManagementPanel } from './ConfigManagementPanel'
import { DecisionResultPanel } from './DecisionResultPanel'
import { DecisionEvaluationPanel } from './DecisionEvaluationPanel'
import { EffectTrackingPanel } from './EffectTrackingPanel'
import { EvolutionSubTabs } from '../EvolutionSubTabs'

interface Props {
  activeTab: EvolutionTab
  onTabChange: (tab: EvolutionTab) => void
  feedbackSamples: FeedbackSample[]
  onFeedbackSamplesChange: (samples: FeedbackSample[]) => void
  onAdoptFeedback: (id: string, writebackTarget: WritebackTarget) => void
  onRejectFeedback: (id: string) => void
  rules: GovernanceRule[]
  onRulesChange: (rules: GovernanceRule[]) => void
  params: RefinementParam[]
  onParamsChange: (params: RefinementParam[]) => void
  configs: CapabilityConfig[]
  onConfigsChange: (configs: CapabilityConfig[]) => void
  decisionResults: DecisionResult[]
  decisionEvaluations: DecisionEvaluation[]
  actionSkills: ActionSkill[]
  onSkillHighlight: (skillIds: string[]) => void
  loading?: boolean
}

export function DecisionCapabilityPanel({
  activeTab, onTabChange,
  feedbackSamples, onAdoptFeedback, onRejectFeedback,
  rules, onRulesChange,
  params, onParamsChange,
  configs, onConfigsChange,
  decisionResults, decisionEvaluations,
  actionSkills, onSkillHighlight,
  loading,
}: Props) {
  const [selectedSample, setSelectedSample] = useState<FeedbackSample | null>(null)
  const [agentFilter, setAgentFilter] = useState('all')
  const [feedbackTypeFilter, setFeedbackTypeFilter] = useState<FeedbackType | 'all'>('all')
  const [sampleTypeFilter, setSampleTypeFilter] = useState('all')

  const filteredSamples = feedbackSamples.filter((s) => {
    if (agentFilter !== 'all' && s.agentName !== agentFilter) return false
    if (feedbackTypeFilter !== 'all' && s.feedbackType !== feedbackTypeFilter) return false
    if (sampleTypeFilter !== 'all' && s.sampleType !== sampleTypeFilter) return false
    return true
  })

  const activeRulesCount = rules.filter((r) => r.status === 'active').length

  return (
    <div className="space-y-4">
      <EvolutionSubTabs
        activeTab={activeTab}
        onChange={onTabChange}
        activeRulesCount={activeRulesCount}
      />

      {activeTab === 'correction' && (
        <div className="space-y-5">
          {/* 待纠偏样本：只展示 modified/rejected（映射为 pending/rejected） */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">
              待处理的纠偏样本
              {feedbackSamples.filter(s => s.feedbackType === 'pending' || s.feedbackType === 'rejected').length > 0 && (
                <span className="ml-2 bg-amber-500 text-amber-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {feedbackSamples.filter(s => s.feedbackType === 'pending' || s.feedbackType === 'rejected').length}
                </span>
              )}
            </p>
            {feedbackSamples.filter(s => s.feedbackType === 'pending' || s.feedbackType === 'rejected').length === 0 ? (
              <p className="text-slate-500 text-xs px-1">暂无待处理的纠偏样本。当 AI 的动作被人工修改或驳回时，样本会自动出现在这里。</p>
            ) : (
              <FeedbackSampleList
                samples={feedbackSamples.filter(s => s.feedbackType === 'pending' || s.feedbackType === 'rejected')}
                loading={loading}
                onSelect={setSelectedSample}
              />
            )}
            <FeedbackSampleDetailDrawer
              sample={selectedSample}
              onClose={() => setSelectedSample(null)}
              onAdopt={onAdoptFeedback}
              onReject={onRejectFeedback}
            />
          </div>

          {/* 规则库摘要 */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-2">
              当前生效规则
              {activeRulesCount > 0 && (
                <span className="ml-2 text-blue-400 font-bold">{activeRulesCount} 条</span>
              )}
            </p>
            {rules.filter(r => r.status === 'active').length === 0 ? (
              <p className="text-slate-500 text-xs px-1">暂无生效规则。采纳纠偏建议后，规则会自动写入并对 AI 生效。</p>
            ) : (
              <div className="space-y-1.5">
                {rules.filter(r => r.status === 'active').slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-start gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${
                      r.ruleType === 'forbid' ? 'bg-red-900/60 text-red-400' :
                      r.ruleType === 'require' ? 'bg-blue-900/60 text-blue-400' :
                      'bg-amber-900/60 text-amber-400'
                    }`}>
                      {r.ruleType === 'forbid' ? '禁止' : r.ruleType === 'require' ? '必须' : '建议'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400">当：{r.condition}</p>
                      <p className="text-xs text-slate-200 mt-0.5">{r.instruction}</p>
                    </div>
                  </div>
                ))}
                {rules.filter(r => r.status === 'active').length > 5 && (
                  <button onClick={() => onTabChange('rules')} className="text-xs text-indigo-400 hover:text-indigo-300 px-1">
                    查看全部 {rules.filter(r => r.status === 'active').length} 条规则 →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="space-y-3">
          <FeedbackFilterBar
            agentFilter={agentFilter}
            feedbackTypeFilter={feedbackTypeFilter}
            sampleTypeFilter={sampleTypeFilter}
            onAgentChange={setAgentFilter}
            onFeedbackTypeChange={setFeedbackTypeFilter}
            onSampleTypeChange={setSampleTypeFilter}
          />
          <FeedbackSampleList
            samples={filteredSamples}
            loading={loading}
            onSelect={setSelectedSample}
          />
          <FeedbackSampleDetailDrawer
            sample={selectedSample}
            onClose={() => setSelectedSample(null)}
            onAdopt={onAdoptFeedback}
            onReject={onRejectFeedback}
          />
        </div>
      )}

      {activeTab === 'rules' && (
        <RuleGovernancePanel rules={rules} onRulesChange={onRulesChange} />
      )}

      {activeTab === 'params' && (
        <RefinementParamsPanel params={params} onParamsChange={onParamsChange} />
      )}

      {activeTab === 'config' && (
        <div className="space-y-5">
          <ConfigManagementPanel configs={configs} onConfigsChange={onConfigsChange} />
          {/* 决策结果结构化展示（配置管理 Tab 下方追加） */}
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono mb-3">决策结果记录</p>
            <DecisionResultPanel
              results={decisionResults}
              actionSkills={actionSkills}
              onSkillHighlight={onSkillHighlight}
            />
          </div>
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-mono mb-3">决策评测</p>
            <DecisionEvaluationPanel
              evaluations={decisionEvaluations}
              decisionResults={decisionResults}
            />
          </div>
        </div>
      )}

      {activeTab === 'tracking' && (
        <EffectTrackingPanel />
      )}
    </div>
  )
}
