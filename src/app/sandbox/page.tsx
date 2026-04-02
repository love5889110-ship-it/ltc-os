'use client'

import { useState } from 'react'
import { FlaskConical, Bot, Play, ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle, Zap, Copy, Download, Wrench } from 'lucide-react'
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

  // RPA 工具直接测试状态
  const [rpaToolType, setRpaToolType] = useState<'create_pptx' | 'create_docx' | 'create_xlsx'>('create_pptx')
  const [rpaRunning, setRpaRunning] = useState(false)
  const [rpaResult, setRpaResult] = useState<{ fileUrl?: string; taskExecutionId?: string; error?: string } | null>(null)
  const [rpaParams, setRpaParams] = useState(JSON.stringify({
    title: '智慧工厂VR安全培训方案',
    slides: [
      { title: '项目背景', content: '工厂安全事故频发\n传统培训效果有限\n客户已发生2次事故' },
      { title: '解决方案', content: 'VR沉浸式安全培训系统\n多场景事故预演\n实时数据追踪' },
      { title: '产品演示', content: 'VR头盔+体感设备\n12个高危场景模拟\n支持200人并发培训' },
      { title: '实施计划', content: '第1-4周：设备部署\n第5-8周：内容定制\n第9-12周：培训上线' },
      { title: '投资回报', content: '培训效果提升60%\n事故率降低80%\n年节省成本约200万' },
    ],
  }, null, 2))
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

      {/* ══════════ RPA 工具直接测试 ══════════ */}
      <div className="max-w-5xl mx-auto px-6 pb-12 mt-10">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50">
            <Wrench className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-800">RPA 工具直接测试</h2>
            <span className="text-xs text-gray-400 ml-1">— 验收真实文件生成能力</span>
          </div>
          <div className="p-6 grid grid-cols-5 gap-6">
            {/* 左：配置 */}
            <div className="col-span-2 flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">选择工具</label>
                <select
                  value={rpaToolType}
                  onChange={e => {
                    const t = e.target.value as typeof rpaToolType
                    setRpaToolType(t)
                    setRpaResult(null)
                    if (t === 'create_pptx') {
                      setRpaParams(JSON.stringify({
                        title: '智慧工厂VR安全培训方案',
                        slides: [
                          { title: '项目背景', content: '工厂安全事故频发\n传统培训效果有限' },
                          { title: '解决方案', content: 'VR沉浸式安全培训\n多场景事故预演' },
                          { title: '投资回报', content: '培训效果提升60%\n事故率降低80%' },
                        ],
                      }, null, 2))
                    } else if (t === 'create_docx') {
                      setRpaParams(JSON.stringify({
                        title: '项目投标技术方案',
                        documentType: 'tender',
                        sections: [
                          { heading: '一、公司简介', body: '云艺化科技成立于2019年，专注于XR工业安全培训...' },
                          { heading: '二、技术方案', body: '## 核心架构\n采用WebXR+本地渲染双引擎...\n- 支持HTC Vive Pro\n- 支持Meta Quest 3' },
                          { heading: '三、实施计划', body: '**第一阶段（1-4周）**：需求调研与方案确认\n**第二阶段（5-8周）**：系统开发与场景制作' },
                        ],
                      }, null, 2))
                    } else {
                      setRpaParams(JSON.stringify({
                        title: 'VR安全培训系统报价单',
                        customerName: '大同煤矿集团',
                        rows: [
                          { product: 'VR安全培训主机', qty: 2, unit: '台', unitPrice: 68000, total: 136000, note: '含GPU主机+VR头盔' },
                          { product: '安全场景内容包', qty: 1, unit: '套', unitPrice: 120000, total: 120000, note: '12个高危场景' },
                          { product: '实施服务费', qty: 1, unit: '项', unitPrice: 30000, total: 30000, note: '含培训+售后1年' },
                        ],
                        subtotal: 286000,
                        discountRate: 0.9,
                        finalPrice: 257400,
                        currency: '¥',
                        validDays: 30,
                        paymentTerms: '首付30%，验收付70%',
                      }, null, 2))
                    }
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="create_pptx">生成 .pptx 方案演示</option>
                  <option value="create_docx">生成 .docx 投标文件</option>
                  <option value="create_xlsx">生成 .xlsx 报价单</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="text-xs font-medium text-gray-500 mb-1 block">参数（JSON）</label>
                <textarea
                  value={rpaParams}
                  onChange={e => setRpaParams(e.target.value)}
                  className="w-full h-52 border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                disabled={rpaRunning}
                onClick={async () => {
                  setRpaRunning(true)
                  setRpaResult(null)
                  try {
                    let params: Record<string, unknown> = {}
                    try { params = JSON.parse(rpaParams) } catch { setRpaResult({ error: 'JSON 格式错误' }); setRpaRunning(false); return }

                    // 直接调用 /api/rpa-test（需要代理到 RPA 服务）
                    const res = await fetch('/api/rpa-test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ taskType: rpaToolType, taskParams: params }),
                    })
                    const json = await res.json() as { taskExecutionId?: string; fileUrl?: string; status?: string; error?: string }
                    if (!res.ok || json.error) {
                      setRpaResult({ error: json.error ?? `HTTP ${res.status}` })
                    } else {
                      // 轮询任务状态
                      const taskId = json.taskExecutionId
                      if (!taskId) { setRpaResult({ error: '未返回 taskExecutionId' }); setRpaRunning(false); return }
                      const poll = setInterval(async () => {
                        const statusRes = await fetch(`/api/rpa-test?taskId=${taskId}`)
                        const statusJson = await statusRes.json() as { status?: string; outputFileUrl?: string; error?: string }
                        if (statusJson.status === 'completed' && statusJson.outputFileUrl) {
                          clearInterval(poll)
                          setRpaResult({ fileUrl: statusJson.outputFileUrl, taskExecutionId: taskId })
                          setRpaRunning(false)
                        } else if (statusJson.status === 'failed') {
                          clearInterval(poll)
                          setRpaResult({ error: statusJson.error ?? '任务失败' })
                          setRpaRunning(false)
                        }
                      }, 2000)
                      setTimeout(() => { clearInterval(poll); if (rpaRunning) { setRpaResult({ error: '超时（60s），请检查 RPA 服务是否启动' }); setRpaRunning(false) } }, 60000)
                    }
                  } catch (e) {
                    setRpaResult({ error: String(e) })
                    setRpaRunning(false)
                  }
                }}
                className="w-full py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {rpaRunning ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />生成中…预计 5-10 秒</>
                ) : (
                  <><Play className="w-4 h-4" />运行 RPA</>
                )}
              </button>
            </div>

            {/* 右：结果 */}
            <div className="col-span-3 flex flex-col gap-3">
              <label className="text-xs font-medium text-gray-500">执行结果</label>

              {!rpaResult && !rpaRunning && (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 h-52">
                  点击"运行 RPA"生成真实文件，然后打开验收排版质量
                </div>
              )}

              {rpaRunning && (
                <div className="flex-1 flex items-center justify-center bg-purple-50 rounded-xl border border-purple-100 h-52">
                  <div className="text-center">
                    <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-purple-700 font-medium">正在生成文件…</p>
                    <p className="text-xs text-purple-500 mt-1">python-pptx / python-docx / openpyxl 处理中</p>
                  </div>
                </div>
              )}

              {rpaResult?.error && (
                <div className="flex-1 bg-red-50 rounded-xl border border-red-200 p-5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700 mb-1">执行失败</p>
                      <p className="text-xs text-red-600 font-mono">{rpaResult.error}</p>
                      <div className="mt-3 text-xs text-red-500 space-y-1">
                        <p>排查步骤：</p>
                        <p>1. 确认 RPA 服务已启动：<code className="bg-red-100 px-1 rounded">cd rpa-agent-server && venv/bin/uvicorn main:app --port 8001</code></p>
                        <p>2. 访问 <code className="bg-red-100 px-1 rounded">http://localhost:8001/health</code> 确认在线</p>
                        <p>3. 确认 <code className="bg-red-100 px-1 rounded">.env.local</code> 中有 <code className="bg-red-100 px-1 rounded">RPA_SERVER_URL=http://localhost:8001</code></p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {rpaResult?.fileUrl && (
                <div className="flex-1 bg-green-50 rounded-xl border border-green-200 p-5">
                  <div className="flex items-start gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-700">✅ 文件生成成功！</p>
                      <p className="text-xs text-green-600 mt-0.5">任务 ID：{rpaResult.taskExecutionId}</p>
                    </div>
                  </div>
                  <a
                    href={rpaResult.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full py-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 justify-center"
                  >
                    <Download className="w-4 h-4" />
                    点击下载文件验收
                  </a>
                  <p className="text-xs text-green-600 mt-2 text-center">用 WPS / Office 打开，检查排版和内容质量</p>
                </div>
              )}

              <div className="mt-auto bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-medium mb-1">💡 如何使用这个测试区：</p>
                <ol className="space-y-1 list-decimal list-inside text-blue-600">
                  <li>先在左侧修改参数（标题、内容等）</li>
                  <li>点击"运行 RPA"，等待文件生成</li>
                  <li>下载文件，用 WPS/Office 打开验收</li>
                  <li>如果排版不满意，修改 <code className="bg-blue-100 px-1 rounded">rpa-agent-server/tasks/create_pptx.py</code> 中的样式代码</li>
                  <li>满意后，Agent 生成成果物→批准→点"生成文件"即走同一条路径</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
