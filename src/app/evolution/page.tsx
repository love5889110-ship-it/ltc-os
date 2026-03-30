'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  CapabilityMode,
  EvolutionTab,
  AgentCapabilityPageState,
  WritebackTarget,
  FeedbackSample,
  GovernanceRule,
  RefinementParam,
  CapabilityConfig,
  SkillExecutionLog,
} from './types'
import {
  getEvolutionStats,
  getFeedbackSamples,
  updateFeedbackStatus,
  getGovernanceRules,
  getRefinementParams,
  getCapabilityConfigs,
  getDecisionResults,
  getDecisionEvaluations,
  getActionSkills,
  getSkillAdapters,
  getSkillTestCases,
  getSkillBindings,
  getSkillRecommendations,
  addLogToFeedbackCandidate,
} from './services'
import { CapabilityModeTabs } from './components/CapabilityModeTabs'
import { EvolutionCenterHeader } from './components/EvolutionCenterHeader'
import { EvolutionStatsCards } from './components/EvolutionStatsCards'
import { DecisionCapabilityPanel } from './components/decision/DecisionCapabilityPanel'
import { ActionCapabilityPanel } from './components/action/ActionCapabilityPanel'

const INITIAL_STATE: AgentCapabilityPageState = {
  stats: { feedbackCount: 0, adoptionRate: 0, adoptedCount: 0 },
  feedbackSamples: [],
  decisionResults: [],
  decisionEvaluations: [],
  rules: [],
  params: [],
  configs: [],
  effectStats: null,
  actionSkills: [],
  skillAdapters: [],
  skillTestCases: [],
  skillEvaluations: [],
  skillBindings: [],
  executionLogs: [],
  skillRecommendations: [],
  skillLoadCandidates: [],
}

export default function EvolutionPage() {
  const [capabilityMode, setCapabilityMode] = useState<CapabilityMode>('decision')
  const [activeTab, setActiveTab] = useState<EvolutionTab>('feedback')
  const [highlightSkillIds, setHighlightSkillIds] = useState<string[]>([])
  const [state, setState] = useState<AgentCapabilityPageState>(INITIAL_STATE)
  const [loading, setLoading] = useState(true)

  // Load all data on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [
          stats, feedbackSamples, rules, params, configs,
          decisionResults, decisionEvaluations,
          actionSkills, skillAdapters, skillTestCases, skillBindings,
          skillRecommendations,
        ] = await Promise.all([
          getEvolutionStats('decision'),
          getFeedbackSamples({}),
          getGovernanceRules('decision'),
          getRefinementParams('decision'),
          getCapabilityConfigs(),
          getDecisionResults(),
          getDecisionEvaluations(),
          getActionSkills(),
          getSkillAdapters(),
          getSkillTestCases(),
          getSkillBindings(),
          getSkillRecommendations(),
        ])
        setState({
          ...INITIAL_STATE,
          stats,
          feedbackSamples,
          rules,
          params,
          configs,
          decisionResults,
          decisionEvaluations,
          actionSkills,
          skillAdapters,
          skillTestCases,
          skillBindings,
          skillRecommendations,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const patchState = useCallback((partial: Partial<AgentCapabilityPageState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  // Feedback adopt/reject handlers with writeback
  const handleAdoptFeedback = useCallback(async (id: string, writebackTarget: WritebackTarget) => {
    await updateFeedbackStatus(id, 'adopted', writebackTarget)
    setState((prev) => {
      const samples = prev.feedbackSamples.map((s) =>
        s.id === id ? { ...s, feedbackType: 'adopted' as const, writebackTarget } : s
      )
      const adoptedCount = samples.filter((s) => s.feedbackType === 'adopted').length
      const adoptionRate = samples.length > 0 ? adoptedCount / samples.length : 0
      return {
        ...prev,
        feedbackSamples: samples,
        stats: { ...prev.stats, adoptedCount, adoptionRate },
      }
    })
  }, [])

  const handleRejectFeedback = useCallback(async (id: string) => {
    await updateFeedbackStatus(id, 'rejected', 'none')
    setState((prev) => ({
      ...prev,
      feedbackSamples: prev.feedbackSamples.map((s) =>
        s.id === id ? { ...s, feedbackType: 'rejected' as const } : s
      ),
    }))
  }, [])

  const handleFeedbackSamplesChange = useCallback((samples: FeedbackSample[]) => {
    setState((prev) => {
      const adoptedCount = samples.filter((s) => s.feedbackType === 'adopted').length
      const adoptionRate = samples.length > 0 ? adoptedCount / samples.length : 0
      return {
        ...prev,
        feedbackSamples: samples,
        stats: { ...prev.stats, feedbackCount: samples.length, adoptedCount, adoptionRate },
      }
    })
  }, [])

  const handleRulesChange = useCallback(async (rules: GovernanceRule[]) => {
    setState((prev) => ({ ...prev, rules }))
  }, [])

  const handleParamsChange = useCallback(async (params: RefinementParam[]) => {
    setState((prev) => ({ ...prev, params }))
  }, [])

  const handleConfigsChange = useCallback(async (configs: CapabilityConfig[]) => {
    setState((prev) => ({ ...prev, configs }))
  }, [])

  // Decision→Action skill highlight linkage
  const handleSkillHighlight = useCallback((skillIds: string[]) => {
    setHighlightSkillIds(skillIds)
    setCapabilityMode('action')
  }, [])

  // Failed log → feedback candidate
  const handleAddToFeedback = useCallback(async (log: SkillExecutionLog) => {
    const skill = state.actionSkills.find((s) => s.id === log.skillId)
    await addLogToFeedbackCandidate(log, skill?.name ?? log.skillId)
    // Re-fetch feedback samples to include the new one
    const updated = await getFeedbackSamples({})
    setState((prev) => ({
      ...prev,
      feedbackSamples: updated,
      stats: {
        ...prev.stats,
        feedbackCount: updated.length,
        adoptedCount: updated.filter((s) => s.feedbackType === 'adopted').length,
        adoptionRate: updated.length > 0
          ? updated.filter((s) => s.feedbackType === 'adopted').length / updated.length
          : 0,
      },
    }))
  }, [state.actionSkills])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        <EvolutionCenterHeader />

        <EvolutionStatsCards stats={state.stats} />

        <CapabilityModeTabs
          mode={capabilityMode}
          onChange={(mode) => setCapabilityMode(mode)}
        />

        <div className="mt-4">
          {capabilityMode === 'decision' ? (
            <DecisionCapabilityPanel
              activeTab={activeTab}
              onTabChange={setActiveTab}
              feedbackSamples={state.feedbackSamples}
              onFeedbackSamplesChange={handleFeedbackSamplesChange}
              onAdoptFeedback={handleAdoptFeedback}
              onRejectFeedback={handleRejectFeedback}
              rules={state.rules}
              onRulesChange={handleRulesChange}
              params={state.params}
              onParamsChange={handleParamsChange}
              configs={state.configs}
              onConfigsChange={handleConfigsChange}
              decisionResults={state.decisionResults}
              decisionEvaluations={state.decisionEvaluations}
              actionSkills={state.actionSkills}
              onSkillHighlight={handleSkillHighlight}
              loading={loading}
            />
          ) : (
            <ActionCapabilityPanel
              state={state}
              highlightIds={highlightSkillIds}
              onStateUpdate={patchState}
              onAddToFeedback={handleAddToFeedback}
            />
          )}
        </div>
      </div>
    </div>
  )
}
