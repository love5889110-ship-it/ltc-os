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
