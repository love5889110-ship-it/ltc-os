'use client'

import { useState } from 'react'
import { FlaskConical, Bot, Play, ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle, Zap, Copy } from 'lucide-react'
import { PageGuide } from '@/components/ui/page-guide'

const AGENT_OPTIONS = [
  { value: 'sales_copilot', label: '销售推进员', desc: '分析商机健康度、识别风险、驱动推进' },
  { value: 'presales_assistant', label: '售前助手', desc: '结构化需求、推荐方案、匹配案例' },
  { value: 'tender_assistant', label: '招投标助手', desc: '解析招标文件、识别控标风险、管理截止时间' },
  { value: 'commercial', label: '商务助手', desc: '报价策略、合同条款风险、谈判建议' },
  { value: 'handover', label: '交接助手', desc: '生成交接包、确认边界、检查承诺' },
  { value: 'service_triage', label: '服务分诊员', desc: '工单分类、识别续约风险、挖掘增购机会' },
  { value: 'asset_governance', label: '资产治理员', desc: '提炼赢单/输单经验、管理话术资产' },
] as const

const DEFAULT_CONTEXT = {
  opportunityName: '大同煤矿井下采掘VR安全培训项目',
  currentStage: '需求确认',
  healthScore: 62,
  riskScore: 55,
  recentSignals: [
    {
      type: 'risk',
      priority: 5,
      summary: '渠道反馈：竞品幻威已到客户现场演示，报价比我方低18%',
      keyPoints: ['竞品幻威已演示', '报价低18%', '客户要求提供煤矿行业案例', '下周要见安全总监'],
    },
  ],
  contacts: [
    { name: '赵总监', role: '安全总监', reachable: true },
    { name: '李总', role: '渠道负责人', reachable: true },
  ],
  currentStageNote: '客户已收到三家方案，本周五内部评审',
}

interface SandboxResult {
  agentType: string
  summary: string
  decisions: Array<{
    type: string
    label: string
    confidence: number
    severity: number
    rationale: string
  }>
  actions: Array<{
    type: string
    priority: number
    requiresApproval: boolean
    payload: { title: string; description: string; draft?: string }
  }>
  rawOutput: string
  latencyMs: number
  rulesApplied: number
}

const DECISION_TYPE_COLORS: Record<string, string> = {
  risk_alert: 'bg-red-50 border-red-200 text-red-700',
  stage_assessment: 'bg-blue-50 border-blue-200 text-blue-700',
  opportunity_found: 'bg-green-50 border-green-200 text-green-700',
  blocker_identified: 'bg-orange-50 border-orange-200 text-orange-700',
  action_recommended: 'bg-purple-50 border-purple-200 text-purple-700',
}

const DECISION_TYPE_LABELS: Record<string, string> = {
  risk_alert: '风险预警', stage_assessment: '阶段评估',
  opportunity_found: '机会识别', blocker_identified: '阻塞点',
  action_recommended: '行动建议',
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: '创建任务', send_draft: '生成草稿', update_status: '更新状态',
  escalate: '升级上报', notify: '发出通知', create_snapshot: '状态快照', create_collab: '协作',
}

export default function SandboxPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>('sales_copilot')
  const [contextText, setContextText] = useState(JSON.stringify(DEFAULT_CONTEXT, null, 2))
  const [contextError, setContextError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SandboxResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleContextChange = (val: string) => {
    setContextText(val)
    try {
      JSON.parse(val)
      setContextError(null)
    } catch {
      setContextError('JSON 格式错误，请检查')
    }
  }

  const handleRun = async () => {
    let contextJson: object
    try {
      contextJson = JSON.parse(contextText)
    } catch {
      setContextError('JSON 格式错误，请修正后再运行')
      return
    }

    setRunning(true)
    setResult(null)
    setRunError(null)

    const res = await fetch('/api/sandbox/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentType: selectedAgent, contextJson }),
    })
    const data = await res.json()
    setRunning(false)

    if (data.error) {
      setRunError(data.error)
    } else {
      setResult(data)
    }
  }

  const handleCopyRaw = () => {
    if (result?.rawOutput) {
      navigator.clipboard.writeText(result.rawOutput)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const currentAgent = AGENT_OPTIONS.find((a) => a.value === selectedAgent)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageGuide
        storageKey="sandbox"
        contents={{
          manager: {
            roleLabel: '管理层',
            purpose: '不影响真实数据的 AI 行为调试台',
            whenToUse: '修改规则后验证效果，或调试数字员工输出时',
            aiAlreadyDid: '提供隔离的测试运行环境，不写入正式数据',
            youDecide: '提交模拟上下文，观察 AI 决策输出是否符合预期',
            nextStepLabel: '进化中心',
            nextStepHref: '/evolution',
          },
        }}
      />

      <div className="flex items-center gap-3 mb-6">
        <FlaskConical className="w-5 h-5 text-purple-600" />
        <h1 className="text-lg font-semibold">沙盘测试</h1>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">不写入真实数据</span>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Left: config */}
        <div className="col-span-2 space-y-4">
          {/* Agent selector */}
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">选择数字员工</p>
            <div className="space-y-1.5">
              {AGENT_OPTIONS.map((agent) => (
                <button
                  key={agent.value}
                  onClick={() => setSelectedAgent(agent.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border-2 text-xs transition-all ${
                    selectedAgent === agent.value
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium">{agent.label}</p>
                  <p className={`text-xs mt-0.5 ${selectedAgent === agent.value ? 'text-purple-500' : 'text-gray-400'}`}>{agent.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={running || !!contextError}
            className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {running ? (
              <><FlaskConical className="w-4 h-4 animate-pulse" />运行中...</>
            ) : (
              <><Play className="w-4 h-4" />运行沙盘测试</>
            )}
          </button>

          {result && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-xs text-purple-700 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              耗时 {result.latencyMs}ms · 注入 {result.rulesApplied} 条规则
            </div>
          )}
        </div>

        {/* Right: context + output */}
        <div className="col-span-3 space-y-4">
          {/* Context input */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">商机上下文 JSON</p>
              {contextError && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />{contextError}
                </span>
              )}
            </div>
            <textarea
              value={contextText}
              onChange={(e) => handleContextChange(e.target.value)}
              rows={16}
              className={`w-full font-mono text-xs border rounded-lg p-3 focus:outline-none focus:ring-2 resize-y ${
                contextError ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-purple-300'
              }`}
              spellCheck={false}
            />
          </div>

          {/* Error */}
          {runError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              ✗ {runError}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="bg-white rounded-xl border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" />
                <p className="text-sm font-medium text-gray-700">{currentAgent?.label} 分析结果</p>
              </div>

              {result.summary && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 leading-relaxed border">
                  {result.summary}
                </div>
              )}

              {/* Decisions */}
              {result.decisions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">决策输出（{result.decisions.length} 条）</p>
                  <div className="space-y-2">
                    {result.decisions.map((d, i) => (
                      <div key={i} className={`rounded-lg border px-3 py-2.5 text-xs ${DECISION_TYPE_COLORS[d.type] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{DECISION_TYPE_LABELS[d.type] ?? d.type} · {d.label}</span>
                          <div className="flex items-center gap-2">
                            {d.severity >= 4 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                            <span className="text-gray-400">置信度 {Math.round((d.confidence ?? 0) * 100)}%</span>
                            {d.severity && <span className="font-bold">S{d.severity}</span>}
                          </div>
                        </div>
                        <p className="text-gray-600 leading-relaxed">{d.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {result.actions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">行动建议（{result.actions.length} 条）</p>
                  <div className="space-y-2">
                    {result.actions.map((a, i) => (
                      <div key={i} className="rounded-lg border bg-gray-50 px-3 py-2.5 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">
                            <Zap className="w-3 h-3 inline mr-1 text-orange-500" />
                            {ACTION_TYPE_LABELS[a.type] ?? a.type} · {a.payload?.title}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${a.requiresApproval ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                              {a.requiresApproval ? '需审批' : '自动'}
                            </span>
                            <span className="text-gray-400">P{a.priority}</span>
                          </div>
                        </div>
                        {a.payload?.description && (
                          <p className="text-gray-500 leading-relaxed">{a.payload.description}</p>
                        )}
                        {a.payload?.draft && (
                          <pre className="mt-1.5 bg-white rounded border px-2 py-1.5 whitespace-pre-wrap text-xs text-gray-600 font-mono leading-relaxed">
                            {a.payload.draft}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON toggle */}
              <div>
                <button
                  onClick={() => setShowRaw((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showRaw ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  原始 JSON 输出
                </button>
                {showRaw && (
                  <div className="mt-2 relative">
                    <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 border overflow-auto max-h-64 font-mono leading-relaxed whitespace-pre-wrap">
                      {result.rawOutput}
                    </pre>
                    <button
                      onClick={handleCopyRaw}
                      className="absolute top-2 right-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 bg-white border rounded px-2 py-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
