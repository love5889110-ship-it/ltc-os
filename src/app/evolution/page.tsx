'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, ThumbsUp, ThumbsDown, Edit3, Bot, Plus, Shield, ToggleLeft, ToggleRight, Trash2, Settings, Save, Lightbulb, RotateCcw, ChevronRight, Bell, CheckCircle } from 'lucide-react'
import { AGENT_LABELS, formatRelativeTime } from '@/lib/utils'
import { PageGuide } from '@/components/ui/page-guide'
import { Breadcrumb } from '@/components/ui/breadcrumb'

interface AISettings {
  signalSummaryStyle: 'brief' | 'detailed' | 'structured'
  signalMaxLength: number
  agentOutputDepth: 'standard' | 'deep'
  agentMaxTokens: number
  feishuWebhookUrl?: string
}

interface RuleSuggestion {
  id: string
  agentType: string
  agentLabel: string
  scenarioType: string
  count: number
  suggestedRule: {
    ruleType: string
    condition: string
    instruction: string
  }
  sampleIds: string[]
}

interface AgentPrompt {
  id: string
  agentType: string
  systemPrompt: string
  description: string | null
  enabled: boolean
}

interface FeedbackSample {
  id: string
  agentType: string | null
  scenarioType: string | null
  feedbackLabel: string
  feedbackReasonCode: string | null
  originalOutputJson: Record<string, unknown>
  correctedOutputJson: Record<string, unknown>
  reusableFlag: boolean | null
  createdAt: string | null
}

interface AgentRule {
  id: string
  agentType: string
  ruleType: 'forbid' | 'require' | 'prefer'
  condition: string
  instruction: string
  createdFrom: string
  enabled: boolean
  createdAt: string | null
}

const feedbackIcon = (label: string) => {
  if (label === 'accepted') return <ThumbsUp className="w-4 h-4 text-green-500" />
  if (label === 'rejected') return <ThumbsDown className="w-4 h-4 text-red-500" />
  return <Edit3 className="w-4 h-4 text-yellow-500" />
}

const feedbackLabelText = (label: string) => ({ accepted: '已采纳', modified: '已修改', rejected: '已驳回' }[label] ?? label)
const feedbackColor = (label: string) => ({
  accepted: 'bg-green-100 text-green-700',
  modified: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
}[label] ?? 'bg-gray-100 text-gray-600')

const ruleTypeLabel = { forbid: '禁止', require: '必须', prefer: '倾向' }
const ruleTypeColor = {
  forbid: 'bg-red-100 text-red-700',
  require: 'bg-blue-100 text-blue-700',
  prefer: 'bg-green-100 text-green-700',
}

export default function EvolutionPage() {
  const [tab, setTab] = useState<'feedback' | 'rules' | 'settings' | 'config' | 'stats'>('feedback')
  const [samples, setSamples] = useState<FeedbackSample[]>([])
  const [rules, setRules] = useState<AgentRule[]>([])
  const [loading, setLoading] = useState(true)
  const [agentFilter, setAgentFilter] = useState('all')
  const [labelFilter, setLabelFilter] = useState('all')
  const [showNewRule, setShowNewRule] = useState(false)
  const [newRule, setNewRule] = useState({ agentType: 'sales_copilot', ruleType: 'forbid', condition: '', instruction: '' })
  const [saving, setSaving] = useState(false)
  const [aiSettings, setAISettings] = useState<AISettings>({
    signalSummaryStyle: 'detailed',
    signalMaxLength: 60,
    agentOutputDepth: 'standard',
    agentMaxTokens: 2048,
  })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [webhookTesting, setWebhookTesting] = useState(false)
  const [webhookTestResult, setWebhookTestResult] = useState<'success' | 'error' | null>(null)
  const [webhookTestMsg, setWebhookTestMsg] = useState('')

  // Feature 3: feedback suggestions
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([])
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  const [adoptingSuggestion, setAdoptingSuggestion] = useState<string | null>(null)

  // Feature 2: agent prompt config
  const [agentPrompts, setAgentPrompts] = useState<Record<string, string>>({})
  const [selectedConfigAgent, setSelectedConfigAgent] = useState<string>('sales_copilot')
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [promptSource, setPromptSource] = useState<Record<string, 'db' | 'default'>>({})
  const [promptDescription, setPromptDescription] = useState('')

  // 提炼为规则
  const [distillPanel, setDistillPanel] = useState<{
    sampleId: string
    agentType: string
    condition: string
    instruction: string
    ruleType: 'forbid' | 'require' | 'prefer'
  } | null>(null)
  const [distilling, setDistilling] = useState(false)

  // Stats tab state
  interface AgentStat {
    agentType: string
    agentLabel: string
    totalRuns: number
    acceptedCount: number
    correctedCount: number
    acceptRate: number
    scenarioBreakdown: Array<{ scenarioType: string; count: number }>
    weeklyTrend: Array<{ week: string; acceptRate: number; accepted: number; total: number }>
    recentFewShots: Array<{ scenarioType: string; createdAt: string | null; original: string; corrected: string }>
  }
  const [agentStats, setAgentStats] = useState<AgentStat[]>([])
  const [selectedStatsAgent, setSelectedStatsAgent] = useState<string>('sales_copilot')
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/feedback').then((r) => r.json()),
      fetch('/api/rules').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/feedback/suggestions').then((r) => r.json()),
      fetch('/api/agent-prompts').then((r) => r.json()),
    ]).then(([fd, rd, settings, sg, ap]) => {
      setSamples(fd.samples ?? [])
      setRules(rd.rules ?? [])
      setAISettings(settings)
      setSuggestions(sg.suggestions ?? [])

      // Build prompt map: agentType → systemPrompt
      const promptMap: Record<string, string> = {}
      const sourceMap: Record<string, 'db' | 'default'> = {}
      const agentTypes = Object.keys(AGENT_LABELS)
      for (const at of agentTypes) {
        const dbRow = (ap.prompts ?? []).find((p: AgentPrompt) => p.agentType === at)
        if (dbRow) {
          promptMap[at] = dbRow.systemPrompt
          sourceMap[at] = 'db'
        } else {
          promptMap[at] = ''
          sourceMap[at] = 'default'
        }
      }
      setAgentPrompts(promptMap)
      setPromptSource(sourceMap)

      setLoading(false)
    })
  }, [])

  const filteredSamples = samples
    .filter((s) => agentFilter === 'all' || s.agentType === agentFilter)
    .filter((s) => labelFilter === 'all' || s.feedbackLabel === labelFilter)

  const stats = {
    total: samples.length,
    accepted: samples.filter((s) => s.feedbackLabel === 'accepted').length,
    modified: samples.filter((s) => s.feedbackLabel === 'modified').length,
    rejected: samples.filter((s) => s.feedbackLabel === 'rejected').length,
  }
  const acceptRate = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0

  const handleToggleRule = async (rule: AgentRule) => {
    await fetch('/api/rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
    })
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
  }

  const handleDeleteRule = async (id: string) => {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' })
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  const handleDistillToRule = async () => {
    if (!distillPanel || !distillPanel.condition.trim() || !distillPanel.instruction.trim()) return
    setDistilling(true)
    await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentType: distillPanel.agentType,
        ruleType: distillPanel.ruleType,
        condition: distillPanel.condition.trim(),
        instruction: distillPanel.instruction.trim(),
        createdFrom: distillPanel.sampleId,
      }),
    })
    const rd = await fetch('/api/rules').then(r => r.json())
    setRules(rd.rules ?? [])
    setDistilling(false)
    setDistillPanel(null)
  }

  const handleSaveRule = async () => {
    if (!newRule.condition.trim() || !newRule.instruction.trim()) return
    setSaving(true)
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRule),
    })
    const data = await res.json()
    setRules((prev) => [{
      id: data.id,
      agentType: newRule.agentType,
      ruleType: newRule.ruleType as AgentRule['ruleType'],
      condition: newRule.condition,
      instruction: newRule.instruction,
      createdFrom: 'manual',
      enabled: true,
      createdAt: new Date().toISOString(),
    }, ...prev])
    setNewRule({ agentType: 'sales_copilot', ruleType: 'forbid', condition: '', instruction: '' })
    setShowNewRule(false)
    setSaving(false)
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiSettings),
    })
    setSaving(false)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 3000)
  }

  const handleTestWebhook = async () => {
    const url = aiSettings.feishuWebhookUrl?.trim()
    if (!url) return
    setWebhookTesting(true)
    setWebhookTestResult(null)
    try {
      const res = await fetch('/api/settings/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.ok) {
        setWebhookTestResult('success')
        setWebhookTestMsg('发送成功，请查看飞书')
      } else {
        setWebhookTestResult('error')
        setWebhookTestMsg(data.error ?? '发送失败')
      }
    } catch {
      setWebhookTestResult('error')
      setWebhookTestMsg('网络请求失败')
    } finally {
      setWebhookTesting(false)
      setTimeout(() => setWebhookTestResult(null), 5000)
    }
  }

  const handleAdoptSuggestion = async (suggestion: RuleSuggestion) => {
    setAdoptingSuggestion(suggestion.id)
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: suggestion.agentType,
          ruleType: suggestion.suggestedRule.ruleType,
          condition: suggestion.suggestedRule.condition,
          instruction: suggestion.suggestedRule.instruction,
        }),
      })
      const data = await res.json()
      setRules((prev) => [{
        id: data.id,
        agentType: suggestion.agentType,
        ruleType: suggestion.suggestedRule.ruleType as AgentRule['ruleType'],
        condition: suggestion.suggestedRule.condition,
        instruction: suggestion.suggestedRule.instruction,
        createdFrom: 'feedback',
        enabled: true,
        createdAt: new Date().toISOString(),
      }, ...prev])
      setDismissedSuggestions((prev) => new Set([...prev, suggestion.id]))
    } finally {
      setAdoptingSuggestion(null)
    }
  }

  const handleSavePrompt = async () => {
    const promptText = agentPrompts[selectedConfigAgent]
    if (!promptText?.trim()) return
    setConfigSaving(true)
    try {
      await fetch('/api/agent-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: selectedConfigAgent,
          systemPrompt: promptText,
          description: promptDescription || null,
        }),
      })
      setPromptSource((prev) => ({ ...prev, [selectedConfigAgent]: 'db' }))
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 3000)
    } finally {
      setConfigSaving(false)
    }
  }

  const handleRestoreDefault = async () => {
    await fetch(`/api/agent-prompts?agentType=${selectedConfigAgent}`, { method: 'DELETE' })
    setAgentPrompts((prev) => ({ ...prev, [selectedConfigAgent]: '' }))
    setPromptSource((prev) => ({ ...prev, [selectedConfigAgent]: 'default' }))
  }

  const activeSuggestions = suggestions.filter((s) => !dismissedSuggestions.has(s.id))
  const currentStat = agentStats.find((s) => s.agentType === selectedStatsAgent)
  const maxScenarioCount = currentStat?.scenarioBreakdown[0]?.count ?? 1

  const handleLoadStats = async () => {
    if (agentStats.length > 0) return  // already loaded
    setStatsLoading(true)
    try {
      const res = await fetch('/api/agent-stats')
      const data = await res.json()
      setAgentStats(data.stats ?? [])
    } finally {
      setStatsLoading(false)
    }
  }

  return (
    <div className="p-6">
      <Breadcrumb items={[{ label: '知识进化' }, { label: '进化中心' }]} />
      <PageGuide
        storageKey="evolution"
        contents={{
          manager: {
            roleLabel: '管理层',
            purpose: '让 AI 越来越懂你公司的周度治理中心',
            whenToUse: '每周例会后，或发现 AI 反复判断偏差时来这里',
            aiAlreadyDid: '已收集所有人工修改记录，统计反馈采纳率，识别高频偏差模式',
            youDecide: '把反复出现的偏差提炼为规则，注入 AI 系统约束未来判断',
            dontDo: '不是一线日常操作页，不需要每天来',
            nextStepLabel: '查看运行驾驶舱',
            nextStepHref: '/dashboard',
          },
          sales: {
            roleLabel: '销售',
            purpose: '你的纠偏反馈都沉淀在这里',
            whenToUse: '好奇 AI 学没学会你之前的纠偏时来看看',
            aiAlreadyDid: '已记录你每次驳回和修改的原因，作为训练样本',
            youDecide: '查看规则库，确认 AI 规则方向是否符合实际',
            nextStepLabel: '返回信号台',
            nextStepHref: '/inbox',
          },
        }}
      />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">进化中心</h1>
        </div>
        {tab === 'rules' && (
          <button
            onClick={() => setShowNewRule(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            新增规则
          </button>
        )}
        {tab === 'settings' && (
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {settingsSaved ? '已保存 ✓' : saving ? '保存中...' : '保存设置'}
          </button>
        )}
        {tab === 'config' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestoreDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              恢复默认
            </button>
            <button
              onClick={handleSavePrompt}
              disabled={configSaving || !agentPrompts[selectedConfigAgent]?.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {configSaved ? '已保存 ✓' : configSaving ? '保存中...' : '保存配置'}
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: '反馈样本', value: stats.total, color: 'text-gray-700', bg: 'bg-white' },
          { label: '采纳率', value: `${acceptRate}%`, color: 'text-green-600', bg: 'bg-green-50' },
          { label: '已采纳', value: stats.accepted, color: 'text-green-600', bg: 'bg-green-50' },
          { label: '已修改', value: stats.modified, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: '已驳回', value: stats.rejected, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border rounded-xl p-3`}>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('feedback')} className={`px-3 py-1.5 rounded-md text-sm transition-colors ${tab === 'feedback' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
          反馈样本
        </button>
        <button onClick={() => setTab('rules')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${tab === 'rules' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
          <Shield className="w-3.5 h-3.5" />
          规则治理
          {rules.filter((r) => r.enabled).length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-1.5 rounded-full">
              {rules.filter((r) => r.enabled).length} 条生效
            </span>
          )}
        </button>
        <button onClick={() => setTab('settings')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${tab === 'settings' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
          <Settings className="w-3.5 h-3.5" />
          提炼参数
        </button>
        <button onClick={() => setTab('config')} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${tab === 'config' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
          <Bot className="w-3.5 h-3.5" />
          配置管理
        </button>
        <button onClick={() => { setTab('stats'); handleLoadStats() }} className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${tab === 'stats' ? 'bg-white shadow font-medium' : 'text-gray-500'}`}>
          <TrendingUp className="w-3.5 h-3.5" />
          效果追踪
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : tab === 'feedback' ? (
        <>
          {/* Rule suggestions from feedback patterns */}
          {activeSuggestions.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">规则建议</span>
                <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">{activeSuggestions.length} 条</span>
                <span className="text-xs text-gray-400">根据高频反馈自动识别，点击「采纳」一键转为规则</span>
              </div>
              <div className="space-y-2">
                {activeSuggestions.map((s) => (
                  <div key={s.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Bot className="w-3 h-3 text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">{s.agentLabel}</span>
                          </div>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{s.scenarioType}</span>
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{s.count} 次修改/驳回</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                            s.suggestedRule.ruleType === 'forbid' ? 'bg-red-100 text-red-700' :
                            s.suggestedRule.ruleType === 'require' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {s.suggestedRule.ruleType === 'forbid' ? '禁止' : s.suggestedRule.ruleType === 'require' ? '必须' : '倾向'}
                          </span>
                          <div className="text-xs text-gray-700">
                            <span className="text-gray-400">当 </span>{s.suggestedRule.condition}<span className="text-gray-400"> 时，</span>{s.suggestedRule.instruction}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleAdoptSuggestion(s)}
                          disabled={adoptingSuggestion === s.id}
                          className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700 disabled:opacity-60"
                        >
                          {adoptingSuggestion === s.id ? '采纳中...' : '采纳为规则'}
                        </button>
                        <button
                          onClick={() => setDismissedSuggestions((prev) => new Set([...prev, s.id]))}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1"
                        >
                          忽略
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Feedback filters */}
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">数字员工</span>
              <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="all">全部</option>
                {Object.entries(AGENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">反馈类型</span>
              <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
                <option value="all">全部</option>
                <option value="accepted">已采纳</option>
                <option value="modified">已修改</option>
                <option value="rejected">已驳回</option>
              </select>
            </div>
          </div>
          {filteredSamples.length === 0 ? (
            <div className="text-center py-16">
              <TrendingUp className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">暂无反馈样本</p>
              <p className="text-gray-400 text-xs mt-1">审批或驳回动作后，反馈样本将自动沉淀到这里</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSamples.map((sample) => (
                <div key={sample.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-start gap-3">
                    {feedbackIcon(sample.feedbackLabel)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {sample.agentType && (
                          <div className="flex items-center gap-1">
                            <Bot className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{AGENT_LABELS[sample.agentType] ?? sample.agentType}</span>
                          </div>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded ${feedbackColor(sample.feedbackLabel)}`}>
                          {feedbackLabelText(sample.feedbackLabel)}
                        </span>
                        {sample.scenarioType && <span className="text-xs text-gray-400">{sample.scenarioType}</span>}
                        <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(sample.createdAt)}</span>
                      </div>
                      {sample.feedbackLabel === 'modified' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-red-50 rounded px-2.5 py-2">
                            <p className="text-xs text-red-500 font-medium mb-1">修改前</p>
                            <p className="text-xs text-gray-600 truncate">{JSON.stringify(sample.originalOutputJson).slice(0, 120)}</p>
                          </div>
                          <div className="bg-green-50 rounded px-2.5 py-2">
                            <p className="text-xs text-green-600 font-medium mb-1">修改后</p>
                            <p className="text-xs text-gray-600 truncate">{JSON.stringify(sample.correctedOutputJson).slice(0, 120)}</p>
                          </div>
                        </div>
                      )}
                      {/* 提炼为规则按钮（仅 modified/rejected 样本显示） */}
                      {(sample.feedbackLabel === 'modified' || sample.feedbackLabel === 'rejected') && sample.agentType && (
                        <div className="mt-2">
                          {distillPanel?.sampleId === sample.id ? (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                              <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                                <Lightbulb className="w-3.5 h-3.5" />提炼为规则 — 下次运行将自动遵守
                              </p>
                              <div className="flex gap-1">
                                {(['require', 'forbid', 'prefer'] as const).map(rt => (
                                  <button key={rt} onClick={() => setDistillPanel(p => p ? { ...p, ruleType: rt } : null)}
                                    className={`text-xs px-2 py-0.5 rounded border transition-all ${distillPanel.ruleType === rt ? ruleTypeColor[rt] + ' border-transparent' : 'border-gray-200 text-gray-500'}`}>
                                    {ruleTypeLabel[rt]}
                                  </button>
                                ))}
                              </div>
                              <input
                                value={distillPanel.condition}
                                onChange={e => setDistillPanel(p => p ? { ...p, condition: e.target.value } : null)}
                                placeholder="触发条件（如：商务谈判阶段且客户提出降价）"
                                className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <input
                                value={distillPanel.instruction}
                                onChange={e => setDistillPanel(p => p ? { ...p, instruction: e.target.value } : null)}
                                placeholder="规则内容（如：必须先用价值置换策略，不直接降价）"
                                className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setDistillPanel(null)} className="text-xs px-2.5 py-1 border rounded text-gray-500 hover:bg-gray-50">取消</button>
                                <button
                                  onClick={handleDistillToRule}
                                  disabled={distilling || !distillPanel.condition.trim() || !distillPanel.instruction.trim()}
                                  className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {distilling ? '保存中...' : '保存为规则'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDistillPanel({
                                sampleId: sample.id,
                                agentType: sample.agentType!,
                                condition: '',
                                instruction: typeof sample.correctedOutputJson?.suggestion === 'string'
                                  ? sample.correctedOutputJson.suggestion
                                  : '',
                                ruleType: 'require',
                              })}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                            >
                              <Lightbulb className="w-3 h-3" />提炼为规则
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === 'rules' ? (
        /* Rules tab */
        <>
          {rules.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">暂无规则</p>
              <p className="text-gray-400 text-xs mt-1">添加规则后，对应数字员工的所有运行将自动遵守</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className={`bg-white rounded-xl border p-4 ${!rule.enabled ? 'opacity-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${ruleTypeColor[rule.ruleType]}`}>
                          {ruleTypeLabel[rule.ruleType]}
                        </span>
                        <div className="flex items-center gap-1">
                          <Bot className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{AGENT_LABELS[rule.agentType] ?? rule.agentType}</span>
                        </div>
                        {rule.createdFrom !== 'manual' && (
                          <span className="text-xs text-blue-400">来自反馈</span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">{formatRelativeTime(rule.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">触发条件：<span className="text-gray-700">{rule.condition}</span></p>
                      <p className="text-xs text-gray-500">执行规则：<span className="text-gray-700 font-medium">{rule.instruction}</span></p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => handleToggleRule(rule)} title={rule.enabled ? '停用' : '启用'}>
                        {rule.enabled
                          ? <ToggleRight className="w-5 h-5 text-blue-500" />
                          : <ToggleLeft className="w-5 h-5 text-gray-300" />}
                      </button>
                      <button onClick={() => handleDeleteRule(rule.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === 'settings' ? (
        /* Settings tab */
        <div className="space-y-5 max-w-2xl">
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
            调整以下参数后，新触发的信号提炼和数字员工分析将立即采用新配置，无需重启或修改代码。
          </div>

          {/* Signal Summary Style */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-1">信号提炼模式</h3>
            <p className="text-xs text-gray-400 mb-3">决定 AI 对录音/文字信号的提炼深度和格式</p>
            <div className="space-y-2">
              {([
                { value: 'brief', label: '简洁模式', desc: '一句话核心摘要，≤60字，快速浏览用' },
                { value: 'detailed', label: '详细模式（推荐）', desc: '3-5 个关键要点分条列出，信息密度更高' },
                { value: 'structured', label: '结构化模式', desc: '按竞品/金额/时间节点/风险分类提炼，适合复杂商机' },
              ] as const).map((opt) => (
                <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${aiSettings.signalSummaryStyle === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="signalSummaryStyle"
                    value={opt.value}
                    checked={aiSettings.signalSummaryStyle === opt.value}
                    onChange={() => setAISettings((p) => ({ ...p, signalSummaryStyle: opt.value }))}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            {aiSettings.signalSummaryStyle === 'brief' && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-gray-500 whitespace-nowrap">最大字数</label>
                <input
                  type="number"
                  min={20}
                  max={200}
                  value={aiSettings.signalMaxLength}
                  onChange={(e) => setAISettings((p) => ({ ...p, signalMaxLength: Number(e.target.value) }))}
                  className="border rounded px-2 py-1 text-sm w-24"
                />
                <span className="text-xs text-gray-400">字（20-200）</span>
              </div>
            )}
          </div>

          {/* Agent Output Depth */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-1">数字员工分析深度</h3>
            <p className="text-xs text-gray-400 mb-3">决定每次 AI 分析输出的推理详细程度</p>
            <div className="space-y-2">
              {([
                { value: 'standard', label: '标准模式', desc: '简洁建议和判断，快速决策用' },
                { value: 'deep', label: '深度模式', desc: '每条判断含 2-3 句详细推理，每条行动含具体执行步骤，适合复盘和训练' },
              ] as const).map((opt) => (
                <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${aiSettings.agentOutputDepth === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    type="radio"
                    name="agentOutputDepth"
                    value={opt.value}
                    checked={aiSettings.agentOutputDepth === opt.value}
                    onChange={() => setAISettings((p) => ({ ...p, agentOutputDepth: opt.value }))}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-gray-500 whitespace-nowrap">最大 Token 数</label>
              <input
                type="number"
                min={512}
                max={4096}
                step={256}
                value={aiSettings.agentMaxTokens}
                onChange={(e) => setAISettings((p) => ({ ...p, agentMaxTokens: Number(e.target.value) }))}
                className="border rounded px-2 py-1 text-sm w-24"
              />
              <span className="text-xs text-gray-400">（512-4096，深度模式建议 ≥3072）</span>
            </div>
          </div>

          {/* Feishu Webhook config */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-500" />
              飞书通知配置
            </h3>
            <p className="text-xs text-gray-400 mb-3">配置后，数字员工生成的「通知」和「协作」类动作审批通过后将自动推送飞书消息</p>
            <div className="flex items-center gap-2">
              <input
                value={aiSettings.feishuWebhookUrl ?? ''}
                onChange={(e) => setAISettings((p) => ({ ...p, feishuWebhookUrl: e.target.value }))}
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                onClick={handleTestWebhook}
                disabled={webhookTesting || !aiSettings.feishuWebhookUrl?.trim()}
                className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
              >
                {webhookTesting ? '发送中...' : '测试发送'}
              </button>
            </div>
            {webhookTestResult && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs ${webhookTestResult === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                <CheckCircle className="w-3.5 h-3.5" />
                {webhookTestMsg}
              </div>
            )}
          </div>
        </div>
      ) : tab === 'config' ? (
        /* Config tab — agent prompt editor */
        <div className="flex gap-4 h-[600px]">
          {/* Left: agent list */}
          <div className="w-48 shrink-0 space-y-1">
            <p className="text-xs text-gray-400 mb-2 px-1">选择数字员工</p>
            {Object.entries(AGENT_LABELS).map(([agentType, label]) => (
              <button
                key={agentType}
                onClick={() => { setSelectedConfigAgent(agentType); setPromptDescription('') }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                  selectedConfigAgent === agentType
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="truncate">{label}</span>
                {promptSource[agentType] === 'db' && (
                  <span className={`text-xs px-1 rounded shrink-0 ml-1 ${selectedConfigAgent === agentType ? 'bg-blue-500 text-blue-100' : 'bg-blue-100 text-blue-600'}`}>
                    已定制
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right: prompt editor */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-medium text-gray-800">{AGENT_LABELS[selectedConfigAgent]} — System Prompt</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {promptSource[selectedConfigAgent] === 'db'
                    ? '当前显示：数据库自定义版本（已覆盖默认值）'
                    : '当前显示：硬编码默认版本（未定制）'}
                </p>
              </div>
            </div>

            <textarea
              value={agentPrompts[selectedConfigAgent] ?? ''}
              onChange={(e) => setAgentPrompts((prev) => ({ ...prev, [selectedConfigAgent]: e.target.value }))}
              placeholder="此字段为空时使用硬编码默认 Prompt。在此输入自定义内容后保存，即可覆盖默认行为。"
              className="flex-1 border rounded-xl px-4 py-3 text-xs font-mono text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 leading-relaxed"
            />

            <div className="mt-3 flex items-center gap-3">
              <input
                value={promptDescription}
                onChange={(e) => setPromptDescription(e.target.value)}
                placeholder="改动说明（选填），例：增加了对煤矿行业的专项提示"
                className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-600">
              保存后，<strong>{AGENT_LABELS[selectedConfigAgent]}</strong> 下次运行时将使用你编辑的 Prompt，无需重新部署。点击右上角「恢复默认」可随时撤销定制。
            </div>
          </div>
        </div>
      ) : (
        /* Stats tab — agent effectiveness tracking */
        <div>
          {/* Agent selector */}
          <div className="flex gap-1 flex-wrap mb-5">
            {Object.entries(AGENT_LABELS).map(([agentType, label]) => (
              <button
                key={agentType}
                onClick={() => setSelectedStatsAgent(agentType)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${selectedStatsAgent === agentType ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {statsLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : !currentStat || currentStat.totalRuns === 0 ? (
            <div className="text-center py-16">
              <TrendingUp className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">{AGENT_LABELS[selectedStatsAgent]} 暂无反馈数据</p>
              <p className="text-gray-400 text-xs mt-1">数字员工运行并收到人工反馈后，效果数据将在此展示</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Key metrics */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '采纳率', value: `${currentStat.acceptRate}%`, color: currentStat.acceptRate >= 70 ? 'text-green-600' : currentStat.acceptRate >= 50 ? 'text-yellow-600' : 'text-red-500', bg: currentStat.acceptRate >= 70 ? 'bg-green-50' : currentStat.acceptRate >= 50 ? 'bg-yellow-50' : 'bg-red-50' },
                  { label: '反馈总数', value: String(currentStat.totalRuns), color: 'text-gray-700', bg: 'bg-white' },
                  { label: '被纠偏', value: String(currentStat.correctedCount), color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Few-shot 样本', value: String(currentStat.recentFewShots.length), color: 'text-blue-600', bg: 'bg-blue-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} border rounded-xl p-3`}>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Scenario breakdown */}
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">最常被纠偏的场景</h3>
                  {currentStat.scenarioBreakdown.length === 0 ? (
                    <p className="text-xs text-gray-400">暂无纠偏数据</p>
                  ) : (
                    <div className="space-y-2">
                      {currentStat.scenarioBreakdown.map((s) => (
                        <div key={s.scenarioType}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600">{s.scenarioType}</span>
                            <span className="text-gray-400">{s.count} 次</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-orange-400"
                              style={{ width: `${Math.round((s.count / maxScenarioCount) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weekly trend */}
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">近4周采纳率趋势</h3>
                  {currentStat.weeklyTrend.length === 0 ? (
                    <p className="text-xs text-gray-400">暂无趋势数据（需至少1周的反馈记录）</p>
                  ) : (
                    <div className="space-y-2">
                      {currentStat.weeklyTrend.map((w, i) => (
                        <div key={w.week}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">第 {i + 1} 周</span>
                            <span className="text-gray-600 font-medium">{w.acceptRate}%
                              <span className="text-gray-400 font-normal ml-1">({w.accepted}/{w.total})</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${w.acceptRate >= 70 ? 'bg-green-400' : w.acceptRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${w.acceptRate}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Few-shot samples currently injected */}
              {currentStat.recentFewShots.length > 0 && (
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    已注入的纠偏示例（few-shot）
                    <span className="text-xs bg-blue-100 text-blue-600 px-1.5 rounded-full">{currentStat.recentFewShots.length} 条</span>
                    <span className="text-xs text-gray-400 font-normal">每次运行时自动注入 Prompt，帮助 Agent 避免重复错误</span>
                  </h3>
                  <div className="space-y-2">
                    {currentStat.recentFewShots.map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 text-xs">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{s.scenarioType || '通用'}</span>
                          <span className="text-gray-400">{s.createdAt ? new Date(s.createdAt).toLocaleDateString('zh-CN') : ''}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-red-50 rounded px-2 py-1.5">
                            <p className="text-red-500 font-medium mb-1">AI 原始输出</p>
                            <p className="text-gray-600 truncate">{s.original}</p>
                          </div>
                          <div className="bg-green-50 rounded px-2 py-1.5">
                            <p className="text-green-600 font-medium mb-1">人工纠正为</p>
                            <p className="text-gray-600 truncate">{s.corrected}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* New rule modal */}
      {showNewRule && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[520px] p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              新增规则
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">适用数字员工</label>
                <select value={newRule.agentType} onChange={(e) => setNewRule((p) => ({ ...p, agentType: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {Object.entries(AGENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">规则类型</label>
                <select value={newRule.ruleType} onChange={(e) => setNewRule((p) => ({ ...p, ruleType: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="forbid">禁止（Forbid）</option>
                  <option value="require">必须（Require）</option>
                  <option value="prefer">倾向（Prefer）</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs text-gray-500 block mb-1">触发条件</label>
              <input
                value={newRule.condition}
                onChange={(e) => setNewRule((p) => ({ ...p, condition: e.target.value }))}
                placeholder="例：商机处于初接触阶段"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1">规则内容</label>
              <textarea
                value={newRule.instruction}
                onChange={(e) => setNewRule((p) => ({ ...p, instruction: e.target.value }))}
                placeholder="例：不要推荐发送报价单或合同，应优先建议安排需求调研会议"
                className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none"
              />
            </div>
            <div className="bg-blue-50 rounded-lg px-3 py-2 mb-4 text-xs text-blue-600">
              规则生效后，<strong>{AGENT_LABELS[newRule.agentType]}</strong> 的所有运行将自动遵守此规则，无需修改代码。
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewRule(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button
                onClick={handleSaveRule}
                disabled={saving || !newRule.condition.trim() || !newRule.instruction.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存规则'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
