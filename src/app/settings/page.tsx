'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Settings, Plug, Bot, CheckCircle, XCircle, AlertCircle, RefreshCw, Eye, EyeOff, Zap, Copy, ChevronDown, ChevronUp, Wrench, Play, ToggleLeft, ToggleRight, Send, Upload, Package, Plus, Star, FlaskConical } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { AGENT_LABELS } from '@/lib/utils'

interface SkillTemplate {
  id: string
  name: string
  description: string
  category: string
  toolSource: string
  enabled: boolean
  createdAt: string
  skillSpecJson: Record<string, unknown>
}

interface SandboxMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SandboxState {
  sandboxId: string | null
  messages: SandboxMessage[]
  skillSpec: Record<string, unknown> | null
  executionConfig: Record<string, unknown> | null
  readyToTest: boolean
  suggestions: string[]
  testResult: { success: boolean; message: string; data?: unknown } | null
  testParams: string
  publishing: boolean
  publishName: string
  publishDesc: string
  publishCategory: string
  showPublishModal: boolean
  importText: string
  showImportModal: boolean
}

interface Connector {
  id: string
  connectorType: string
  connectorName: string
  authStatus: string
  healthStatus: string
  enabled: boolean
  lastSyncAt: string | null
}

const CONNECTOR_META: Record<string, { label: string; description: string }> = {
  get_note: { label: 'Get 笔记', description: '自动同步录音转写笔记为信号' },
  dingtalk: { label: '钉钉', description: '监听指定钉钉群消息，自动转化为销售信号' },
  wecom: { label: '企业微信', description: '接收企业微信应用消息或群机器人推送' },
  recording: { label: '录音转写', description: '上传录音文件，AI 自动转写为信号' },
  file_ocr: { label: '文件/OCR', description: '上传文件并 OCR 识别' },
  wechat_proxy: { label: '个人微信（中间件）', description: '通过本地 hook 工具接入个人微信群' },
  manual: { label: '手动录入', description: '通过界面手动录入信号' },
}

type Tab = 'connectors' | 'llm' | 'skills'

function SettingsPageInner() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>((tabParam as Tab) ?? 'connectors')

  // Connector state
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [configuring, setConfiguring] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [saving, setSaving] = useState(false)

  // DingTalk config state
  const [dtAppKey, setDtAppKey] = useState('')
  const [dtAppSecret, setDtAppSecret] = useState('')
  const [dtGroupIds, setDtGroupIds] = useState('')
  const [dtGroupNames, setDtGroupNames] = useState('')
  const [dtConfig, setDtConfig] = useState<{ configured: boolean; hasAppKey: boolean; groupIds: string[]; groupNames: string[]; webhookUrl: string } | null>(null)
  const [dtSaving, setDtSaving] = useState(false)
  const [dtSaved, setDtSaved] = useState(false)
  const [dtExpanded, setDtExpanded] = useState(false)

  // WeCom config state
  const [wcCorpId, setWcCorpId] = useState('')
  const [wcToken, setWcToken] = useState('')
  const [wcAESKey, setWcAESKey] = useState('')
  const [wcChatIds, setWcChatIds] = useState('')
  const [wcChatNames, setWcChatNames] = useState('')
  const [wcConfig, setWcConfig] = useState<{ configured: boolean; hasCorpId: boolean; chatIds: string[]; chatNames: string[]; webhookUrl: string } | null>(null)
  const [wcSaving, setWcSaving] = useState(false)
  const [wcSaved, setWcSaved] = useState(false)
  const [dtRobotWebhook, setDtRobotWebhook] = useState('')
  const [wcRobotWebhook, setWcRobotWebhook] = useState('')
  const [wcExpanded, setWcExpanded] = useState(false)

  // LLM state
  const [llmProvider, setLlmProvider] = useState<'minimax' | 'openai_compatible'>('minimax')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [llmSaving, setLlmSaving] = useState(false)
  const [llmSaved, setLlmSaved] = useState(false)
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{ ok?: boolean; error?: string; latencyMs?: number; model?: string } | null>(null)

  // Skills state
  const [allTools, setAllTools] = useState<Array<{ id: string; name: string; category: string; description: string; requiresConnector: string | null; testable: boolean }>>([])
  const [enabledSkills, setEnabledSkills] = useState<Array<{ id: string; agentType: string; toolId: string; enabled: boolean }>>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [testingToolId, setTestingToolId] = useState<string | null>(null)
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testModalTool, setTestModalTool] = useState<string | null>(null)

  // Skills sub-tabs
  const [skillsSubTab, setSkillsSubTab] = useState<'tools' | 'sandbox' | 'library'>('tools')

  // Skill library state
  const [skillTemplates, setSkillTemplates] = useState<SkillTemplate[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [assigningTemplate, setAssigningTemplate] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState<string>('')

  // Sandbox state
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [sandboxMessages, setSandboxMessages] = useState<SandboxMessage[]>([])
  const [sandboxSkillSpec, setSandboxSkillSpec] = useState<Record<string, unknown> | null>(null)
  const [sandboxExecConfig, setSandboxExecConfig] = useState<Record<string, unknown> | null>(null)
  const [sandboxReadyToTest, setSandboxReadyToTest] = useState(false)
  const [sandboxSuggestions, setSandboxSuggestions] = useState<string[]>([])
  const [sandboxChatInput, setSandboxChatInput] = useState('')
  const [sandboxChatting, setSandboxChatting] = useState(false)
  const [sandboxTestParams, setSandboxTestParams] = useState('{}')
  const [sandboxTestResult, setSandboxTestResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null)
  const [sandboxTesting, setSandboxTesting] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [publishName, setPublishName] = useState('')
  const [publishDesc, setPublishDesc] = useState('')
  const [publishCategory, setPublishCategory] = useState('data')
  const [publishing, setPublishing] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [sandboxList, setSandboxList] = useState<Array<{ id: string; name: string | null; status: string; updatedAt: string }>>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadConnectors = () => {
    fetch('/api/connectors')
      .then((r) => r.json())
      .then((d) => { setConnectors(d.connectors ?? []); setLoading(false) })
  }

  const loadDingTalkConfig = () => {
    fetch('/api/connectors/dingtalk/config')
      .then((r) => r.json())
      .then((d) => {
        setDtConfig(d)
        if (d.groupIds?.length) setDtGroupIds(d.groupIds.join(','))
        if (d.groupNames?.length) setDtGroupNames(d.groupNames.join(','))
        if (d.robotWebhook) setDtRobotWebhook(d.robotWebhook)
      })
      .catch(() => {})
  }

  const loadWeComConfig = () => {
    fetch('/api/connectors/wecom/config')
      .then((r) => r.json())
      .then((d) => {
        setWcConfig(d)
        if (d.chatIds?.length) setWcChatIds(d.chatIds.join(','))
        if (d.chatNames?.length) setWcChatNames(d.chatNames.join(','))
        if (d.robotWebhook) setWcRobotWebhook(d.robotWebhook)
      })
      .catch(() => {})
  }

  const loadSkills = async () => {
    setSkillsLoading(true)
    try {
      const res = await fetch('/api/skills')
      const data = await res.json()
      setAllTools(data.tools ?? [])
      setEnabledSkills(data.skills ?? [])
    } catch { /* ignore */ } finally {
      setSkillsLoading(false)
    }
  }

  const loadSkillLibrary = async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/skill-templates')
      const data = await res.json()
      setSkillTemplates(data.templates ?? [])
    } catch { /* ignore */ } finally {
      setLibraryLoading(false)
    }
  }

  const loadSandboxList = async () => {
    try {
      const res = await fetch('/api/skill-sandbox')
      const data = await res.json()
      setSandboxList(data.sandboxes ?? [])
    } catch { /* ignore */ }
  }

  const handleSandboxChat = async () => {
    if (!sandboxChatInput.trim() || sandboxChatting) return
    const userMsg = sandboxChatInput.trim()
    setSandboxChatInput('')
    setSandboxMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setSandboxChatting(true)
    try {
      const res = await fetch('/api/skill-sandbox?action=chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandboxId, userMessage: userMsg }),
      })
      const data = await res.json()
      if (data.sandboxId) setSandboxId(data.sandboxId)
      setSandboxMessages(prev => [...prev, { role: 'assistant', content: data.message ?? '...' }])
      if (data.skillSpec) setSandboxSkillSpec(data.skillSpec)
      if (data.executionConfig) setSandboxExecConfig(data.executionConfig)
      setSandboxReadyToTest(data.readyToTest ?? false)
      setSandboxSuggestions(data.suggestions ?? [])
      if (data.isNew) loadSandboxList()
      // Auto-populate test params from inputSchema
      if (data.skillSpec?.inputSchema) {
        const schema = data.skillSpec.inputSchema as Record<string, unknown>
        const props = (schema.properties ?? {}) as Record<string, unknown>
        const sample: Record<string, string> = {}
        Object.keys(props).forEach(k => { sample[k] = '' })
        setSandboxTestParams(JSON.stringify(sample, null, 2))
      }
    } catch (e) {
      setSandboxMessages(prev => [...prev, { role: 'assistant', content: `错误：${String(e)}` }])
    } finally {
      setSandboxChatting(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const handleSandboxTest = async () => {
    if (!sandboxId || sandboxTesting) return
    setSandboxTesting(true)
    setSandboxTestResult(null)
    try {
      let params = {}
      try { params = JSON.parse(sandboxTestParams) } catch { /* use empty */ }
      const res = await fetch('/api/skill-sandbox?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandboxId, testParams: params }),
      })
      const data = await res.json()
      setSandboxTestResult({ success: data.success, message: data.message, data: data.data })
    } catch (e) {
      setSandboxTestResult({ success: false, message: String(e) })
    } finally {
      setSandboxTesting(false)
    }
  }

  const handlePublish = async () => {
    if (!sandboxId || !publishName.trim() || !publishDesc.trim()) return
    setPublishing(true)
    try {
      const res = await fetch('/api/skill-sandbox?action=publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandboxId, name: publishName, description: publishDesc, category: publishCategory }),
      })
      const data = await res.json()
      if (data.skillTemplateId) {
        setShowPublishModal(false)
        setPublishName('')
        setPublishDesc('')
        alert(`技能「${data.name}」已上架！可在技能库中查看。`)
        loadSkillLibrary()
        loadSandboxList()
      }
    } catch (e) {
      alert(`上架失败：${String(e)}`)
    } finally {
      setPublishing(false)
    }
  }

  const handleImport = async () => {
    if (!importText.trim()) return
    setImporting(true)
    try {
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(importText) } catch { alert('JSON 格式错误，请检查'); setImporting(false); return }
      const res = await fetch('/api/skill-sandbox?action=import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillJson: parsed }),
      })
      const data = await res.json()
      if (data.sandboxId) {
        setSandboxId(data.sandboxId)
        setSandboxSkillSpec(data.skillSpec)
        setSandboxMessages([{ role: 'assistant', content: data.message }])
        setSandboxExecConfig(null)
        setSandboxReadyToTest(false)
        setSandboxSuggestions([])
        setShowImportModal(false)
        setImportText('')
        setSkillsSubTab('sandbox')
        loadSandboxList()
      }
    } catch (e) {
      alert(`导入失败：${String(e)}`)
    } finally {
      setImporting(false)
    }
  }

  const resetSandbox = () => {
    setSandboxId(null)
    setSandboxMessages([])
    setSandboxSkillSpec(null)
    setSandboxExecConfig(null)
    setSandboxReadyToTest(false)
    setSandboxSuggestions([])
    setSandboxChatInput('')
    setSandboxTestParams('{}')
    setSandboxTestResult(null)
  }

  useEffect(() => {
    loadConnectors()
    loadDingTalkConfig()
    loadWeComConfig()
    loadSkills()
    loadSkillLibrary()
    loadSandboxList()
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.llmProvider) setLlmProvider(d.llmProvider)
        if (d.llmApiKey) setLlmApiKey(d.llmApiKey)
        if (d.llmBaseUrl) setLlmBaseUrl(d.llmBaseUrl)
        if (d.llmModel) setLlmModel(d.llmModel)
      })
      .catch(() => {})
  }, [])

  const handleSaveDingTalk = async () => {
    setDtSaving(true)
    setDtSaved(false)
    const groupIds = dtGroupIds.split(',').map(s => s.trim()).filter(Boolean)
    const groupNames = dtGroupNames.split(',').map(s => s.trim()).filter(Boolean)
    await fetch('/api/connectors/dingtalk/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(dtAppKey ? { appKey: dtAppKey } : {}),
        ...(dtAppSecret ? { appSecret: dtAppSecret } : {}),
        ...(dtRobotWebhook ? { robotWebhook: dtRobotWebhook } : {}),
        groupIds,
        groupNames,
      }),
    })
    setDtSaving(false)
    setDtSaved(true)
    setDtAppKey('')
    setDtAppSecret('')
    loadDingTalkConfig()
    loadConnectors()
    setTimeout(() => setDtSaved(false), 3000)
  }

  const handleSaveWeCom = async () => {
    setWcSaving(true)
    setWcSaved(false)
    const chatIds = wcChatIds.split(',').map(s => s.trim()).filter(Boolean)
    const chatNames = wcChatNames.split(',').map(s => s.trim()).filter(Boolean)
    await fetch('/api/connectors/wecom/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(wcCorpId ? { corpId: wcCorpId } : {}),
        ...(wcToken ? { token: wcToken } : {}),
        ...(wcAESKey ? { encodingAESKey: wcAESKey } : {}),
        ...(wcRobotWebhook ? { robotWebhook: wcRobotWebhook } : {}),
        chatIds,
        chatNames,
      }),
    })
    setWcSaving(false)
    setWcSaved(true)
    setWcCorpId('')
    setWcToken('')
    setWcAESKey('')
    loadWeComConfig()
    loadConnectors()
    setTimeout(() => setWcSaved(false), 3000)
  }

  const handleSaveGetNote = async () => {
    if (!apiKey.trim() || !clientId.trim()) return
    setSaving(true)
    const res = await fetch('/api/connectors/get-note/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim(), clientId: clientId.trim() }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setConfiguring(null)
      setApiKey('')
      setClientId('')
      loadConnectors()
    }
  }

  const handleSaveLlm = async () => {
    setLlmSaving(true)
    setLlmSaved(false)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        llmProvider,
        llmApiKey: llmApiKey.trim() || undefined,
        llmBaseUrl: llmBaseUrl.trim() || undefined,
        llmModel: llmModel.trim() || undefined,
      }),
    })
    setLlmSaving(false)
    setLlmSaved(true)
    setTimeout(() => setLlmSaved(false), 3000)
  }

  const handleTestLlm = async () => {
    setLlmTesting(true)
    setLlmTestResult(null)
    const res = await fetch('/api/settings/test-llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: llmApiKey.trim() || undefined,
        baseUrl: llmBaseUrl.trim() || undefined,
        model: llmModel.trim() || undefined,
      }),
    })
    const data = await res.json()
    setLlmTesting(false)
    setLlmTestResult(data)
  }

  return (
    <div className="p-6 max-w-4xl">
      <Breadcrumb items={[{ label: '治理配置' }, { label: '连接器与模型' }]} />
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-5 h-5 text-gray-600" />
        <h1 className="text-lg font-semibold">连接器与模型</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('connectors')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'connectors' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Plug className="w-4 h-4" />
          数据连接器
          <span className="text-xs text-gray-400 font-normal">
            {connectors.filter((c) => c.enabled && c.healthStatus === 'healthy').length} 个运行中
          </span>
        </button>
        <button
          onClick={() => setTab('llm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'llm' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bot className="w-4 h-4" />
          大模型 API
        </button>
        <button
          onClick={() => setTab('skills')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'skills' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wrench className="w-4 h-4" />
          行动技能
          <span className="text-xs text-gray-400 font-normal">
            {enabledSkills.filter(s => s.enabled).length} 个已装载
          </span>
        </button>
      </div>

      {/* Connectors Tab */}
      {tab === 'connectors' && (
        <>
          <p className="text-sm text-gray-500 mb-5">配置数据接入管道，连接后内容自动流入信号台</p>

          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : (
            <>
              {/* 已接入 */}
              {connectors.filter(c => c.connectorType === 'get_note').length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">已接入</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {connectors.filter(c => c.connectorType === 'get_note').map((connector) => {
                      const isGetNote = connector.connectorType === 'get_note'
                      return (
                        <div key={connector.id} className="bg-white rounded-xl border p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium text-sm">{CONNECTOR_META[connector.connectorType]?.label ?? connector.connectorName}</p>
                              {connector.connectorName && connector.connectorName !== CONNECTOR_META[connector.connectorType]?.label && (
                                <p className="text-xs text-gray-400 mt-0.5">{connector.connectorName}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-0.5">{CONNECTOR_META[connector.connectorType]?.description}</p>
                            </div>
                            <HealthIcon status={connector.healthStatus} />
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <AuthBadge status={connector.authStatus} />
                          </div>

                          {connector.lastSyncAt && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
                              <RefreshCw className="w-3 h-3" />
                              上次同步: {new Date(connector.lastSyncAt).toLocaleString('zh-CN')}
                            </p>
                          )}

                          {/* Get笔记：重新配置 + 自动同步 */}
                          {isGetNote && (
                            <>
                              {configuring === 'get_note' && (
                                <div className="mb-3 space-y-2">
                                  <input
                                    type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="API Key (gk_live_...)"
                                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                  />
                                  <input
                                    type="text" value={clientId} onChange={(e) => setClientId(e.target.value)}
                                    placeholder="Client ID (cli_...)"
                                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                  />
                                  <div className="flex gap-2">
                                    <button onClick={handleSaveGetNote} disabled={saving || !apiKey.trim() || !clientId.trim()}
                                      className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                                      {saving ? '保存中...' : '保存'}
                                    </button>
                                    <button onClick={() => setConfiguring(null)} className="px-3 py-1.5 border rounded text-xs text-gray-600">取消</button>
                                  </div>
                                </div>
                              )}

                              <div className="pt-3 border-t space-y-3">
                                <button
                                  onClick={() => setConfiguring(configuring === 'get_note' ? null : 'get_note')}
                                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  <Settings className="w-3 h-3" />
                                  {connector.authStatus === 'authorized' ? '重新配置密钥' : '配置密钥'}
                                </button>

                                {connector.authStatus === 'authorized' && (
                                  <p className="text-[11px] text-gray-400">
                                    定时自动同步设置在 <span className="text-blue-500">信号台 → 同步笔记</span> 中配置
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 即将上线 */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">即将上线</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { type: 'recording', label: '录音转写', desc: '上传录音文件，AI 自动转写为信号' },
                    { type: 'wechat_proxy', label: '个人微信（中间件）', desc: '通过 WeChatFerry / gewechat 接入' },
                  ].map(({ type, label, desc }) => (
                    <div key={type} className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-4 opacity-60">
                      <p className="font-medium text-sm text-gray-600">{label}</p>
                      <p className="text-xs text-gray-400 mt-1">{desc}</p>
                      <span className="inline-block mt-2 text-[10px] bg-orange-100 text-orange-500 px-2 py-0.5 rounded-full">开发中</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 钉钉配置 */}
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">钉钉群消息</p>
                    <p className="text-xs text-gray-400 mt-0.5">监听指定钉钉群，自动将群消息转化为销售信号</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dtConfig?.configured && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">已配置</span>
                    )}
                    <button onClick={() => setDtExpanded(v => !v)} className="text-gray-400 hover:text-gray-600">
                      {dtExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {dtExpanded && (
                  <div className="mt-4 space-y-4">
                    {/* Webhook URL */}
                    {dtConfig?.webhookUrl && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-blue-700 mb-1">Webhook 接收地址</p>
                        <p className="text-[11px] text-blue-600 font-mono break-all">{dtConfig.webhookUrl}</p>
                        <p className="text-[11px] text-blue-500 mt-1">填入钉钉应用「消息接收 URL」中</p>
                      </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-700 mb-1">本地开发（无公网IP）</p>
                      <p className="text-[11px] text-amber-600">使用 Stream 长连接模式，无需 Webhook URL：</p>
                      <code className="text-[11px] text-amber-700 font-mono block mt-1 bg-amber-100 px-2 py-1 rounded">
                        DINGTALK_APP_KEY=xxx DINGTALK_APP_SECRET=xxx npx tsx scripts/dingtalk-stream.ts
                      </code>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">应用凭证（AppKey / AppSecret）</p>
                      <input type="text" value={dtAppKey} onChange={e => setDtAppKey(e.target.value)}
                        placeholder="AppKey（留空则不更新）"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                      <input type="password" value={dtAppSecret} onChange={e => setDtAppSecret(e.target.value)}
                        placeholder="AppSecret（留空则不更新）"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">通知机器人 Webhook</p>
                      <p className="text-[11px] text-gray-400">AI 分析完成、待审批动作产生时，推送消息到此群机器人</p>
                      <p className="text-[11px] text-gray-400">在钉钉群 → 智能群助手 → 添加机器人 → 自定义机器人，复制 Webhook 地址</p>
                      <input type="text" value={dtRobotWebhook} onChange={e => setDtRobotWebhook(e.target.value)}
                        placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">监听群 ID 白名单</p>
                      <p className="text-[11px] text-gray-400">多个群 ID 用英文逗号分隔，留空则接收所有群消息</p>
                      <input type="text" value={dtGroupIds} onChange={e => setDtGroupIds(e.target.value)}
                        placeholder="如：cid_abc123,cid_def456"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input type="text" value={dtGroupNames} onChange={e => setDtGroupNames(e.target.value)}
                        placeholder="群名称备注（对应顺序，用于信号来源标注）"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {dtConfig?.groupIds?.length ? (
                      <div className="text-[11px] text-gray-500">
                        已配置 {dtConfig.groupIds.length} 个监听群：{dtConfig.groupNames?.join('、') || dtConfig.groupIds.join('、')}
                      </div>
                    ) : null}

                    <button onClick={handleSaveDingTalk} disabled={dtSaving}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                      {dtSaving ? '保存中...' : dtSaved ? '✓ 已保存' : '保存配置'}
                    </button>
                  </div>
                )}
              </div>

              {/* 企业微信配置 */}
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">企业微信</p>
                    <p className="text-xs text-gray-400 mt-0.5">接收企业微信应用消息或群机器人推送</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {wcConfig?.configured && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">已配置</span>
                    )}
                    <button onClick={() => setWcExpanded(v => !v)} className="text-gray-400 hover:text-gray-600">
                      {wcExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {wcExpanded && (
                  <div className="mt-4 space-y-4">
                    {wcConfig?.webhookUrl && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-blue-700 mb-1">Webhook / 消息接收 URL</p>
                        <p className="text-[11px] text-blue-600 font-mono break-all">{wcConfig.webhookUrl}</p>
                        <p className="text-[11px] text-blue-500 mt-1">填入企业微信自建应用「消息接收 URL」中</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">通知机器人 Webhook</p>
                      <p className="text-[11px] text-gray-400">AI 分析完成、待审批动作产生时，推送消息到企业微信群</p>
                      <p className="text-[11px] text-gray-400">企业微信群 → 群机器人 → 添加机器人，复制 Webhook 地址</p>
                      <input type="text" value={wcRobotWebhook} onChange={e => setWcRobotWebhook(e.target.value)}
                        placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">企业凭证</p>
                      <input type="text" value={wcCorpId} onChange={e => setWcCorpId(e.target.value)}
                        placeholder="CorpID（企业ID，留空则不更新）"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                      <input type="password" value={wcToken} onChange={e => setWcToken(e.target.value)}
                        placeholder="Token（消息验证 Token）"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                      <input type="password" value={wcAESKey} onChange={e => setWcAESKey(e.target.value)}
                        placeholder="EncodingAESKey（消息加解密密钥）"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700">监听群/会话 ID 白名单</p>
                      <p className="text-[11px] text-gray-400">多个 ChatID 逗号分隔，留空则接收所有消息</p>
                      <input type="text" value={wcChatIds} onChange={e => setWcChatIds(e.target.value)}
                        placeholder="如：gh_abc123,gh_def456"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <input type="text" value={wcChatNames} onChange={e => setWcChatNames(e.target.value)}
                        placeholder="群名称备注（对应顺序）"
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    <button onClick={handleSaveWeCom} disabled={wcSaving}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                      {wcSaving ? '保存中...' : wcSaved ? '✓ 已保存' : '保存配置'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Skills Tab */}
      {tab === 'skills' && (
        <>
          {/* Skills sub-tabs */}
          <div className="flex gap-1 mb-5 border-b">
            {([
              { key: 'tools', label: '工具装载', icon: <Wrench className="w-3.5 h-3.5" /> },
              { key: 'sandbox', label: '沙盘训练', icon: <FlaskConical className="w-3.5 h-3.5" /> },
              { key: 'library', label: '技能库', icon: <Package className="w-3.5 h-3.5" /> },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => { setSkillsSubTab(key); if (key === 'library') loadSkillLibrary() }}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  skillsSubTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* ── Sub-Tab A: 工具装载 ── */}
          {skillsSubTab === 'tools' && (
            <>
              <p className="text-sm text-gray-500 mb-5">为每个数字员工装载可真实执行的行动技能，装载后 Agent 可在合适场景自动调用</p>
              {skillsLoading ? (
                <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(AGENT_LABELS).map(([agentType, agentLabel]) => {
                    const CATEGORY_LABELS: Record<string, string> = {
                      communicate: '通信', browse: '浏览', document: '文档', data: '数据',
                    }
                    const CATEGORY_COLORS: Record<string, string> = {
                      communicate: 'bg-blue-100 text-blue-600',
                      browse: 'bg-purple-100 text-purple-600',
                      document: 'bg-orange-100 text-orange-600',
                      data: 'bg-green-100 text-green-600',
                    }
                    return (
                      <div key={agentType} className="bg-white rounded-xl border">
                        <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl">
                          <p className="text-sm font-medium text-gray-700">{agentLabel}</p>
                        </div>
                        <div className="divide-y">
                          {allTools.map((tool) => {
                            const skill = enabledSkills.find(s => s.agentType === agentType && s.toolId === tool.id)
                            const isEnabled = skill?.enabled ?? false
                            const connectorOk = !tool.requiresConnector ||
                              connectors.some(c => c.connectorType === tool.requiresConnector && c.enabled && c.healthStatus === 'healthy')
                            const toggleSkill = async () => {
                              if (skill) {
                                await fetch('/api/skills', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ skillId: skill.id, enabled: !isEnabled }),
                                })
                              } else {
                                await fetch('/api/skills', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ agentType, toolId: tool.id }),
                                })
                              }
                              loadSkills()
                            }
                            return (
                              <div key={tool.id} className="px-5 py-3.5 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-gray-800">{tool.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[tool.category] ?? 'bg-gray-100 text-gray-500'}`}>
                                      {CATEGORY_LABELS[tool.category] ?? tool.category}
                                    </span>
                                    {tool.requiresConnector && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${connectorOk ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                        {connectorOk ? `${tool.requiresConnector} 已授权` : `需 ${tool.requiresConnector} 授权`}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 truncate">{tool.description}</p>
                                </div>
                                {tool.testable && (
                                  <button
                                    onClick={() => { setTestModalTool(tool.id); setTestInput('{}'); setTestResult(null) }}
                                    className="flex items-center gap-1 px-2.5 py-1 border rounded text-xs text-gray-500 hover:bg-gray-50 shrink-0"
                                  >
                                    <Play className="w-3 h-3" />测试
                                  </button>
                                )}
                                <button onClick={toggleSkill} className={`shrink-0 transition-colors ${isEnabled ? 'text-blue-500 hover:text-blue-600' : 'text-gray-300 hover:text-gray-400'}`}>
                                  {isEnabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                                </button>
                              </div>
                            )
                          })}
                          {allTools.length === 0 && (
                            <div className="px-5 py-4 text-xs text-gray-400">暂无可用工具</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Sub-Tab B: 沙盘训练 ── */}
          {skillsSubTab === 'sandbox' && (
            <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[500px]">
              {/* Left panel */}
              <div className="w-64 shrink-0 flex flex-col gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={resetSandbox}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" />新建技能
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center justify-center gap-1 px-3 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                    title="导入 OpenAI FC 格式"
                  >
                    <Upload className="w-3.5 h-3.5" />导入
                  </button>
                </div>

                {/* Current skill spec preview */}
                {sandboxSkillSpec && Object.keys(sandboxSkillSpec).length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-2">当前技能规格</p>
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {(sandboxSkillSpec.displayName as string) || (sandboxSkillSpec.name as string) || '未命名'}
                    </p>
                    {!!sandboxSkillSpec.description && (
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{String(sandboxSkillSpec.description)}</p>
                    )}
                    {!!sandboxSkillSpec.inputSchema && (
                      <p className="text-[10px] text-blue-400 mt-1.5">
                        参数：{Object.keys(((sandboxSkillSpec.inputSchema as Record<string, unknown>)?.properties as Record<string, unknown>) ?? {}).join(', ') || '无'}
                      </p>
                    )}
                    {sandboxExecConfig && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        执行：{(sandboxExecConfig.type as string) ?? '待配置'}
                        {sandboxExecConfig.apiUrl ? ` · ${String(sandboxExecConfig.apiUrl).slice(0, 30)}...` : ''}
                      </p>
                    )}
                  </div>
                )}

                {/* Sandbox history list */}
                {sandboxList.length > 0 && (
                  <div className="flex-1 overflow-y-auto">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">历史沙盘</p>
                    <div className="space-y-1">
                      {sandboxList.map(sb => (
                        <button
                          key={sb.id}
                          onClick={async () => {
                            const res = await fetch(`/api/skill-sandbox?id=${sb.id}`)
                            const data = await res.json()
                            setSandboxId(sb.id)
                            setSandboxMessages((data.chatHistoryJson as SandboxMessage[]) ?? [])
                            setSandboxSkillSpec((data.skillSpecJson as Record<string, unknown>) ?? null)
                            setSandboxExecConfig((data.executionConfigJson as Record<string, unknown>) ?? null)
                            setSandboxReadyToTest(false)
                            setSandboxSuggestions([])
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                            sandboxId === sb.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
                          }`}
                        >
                          <p className="font-medium truncate">{sb.name ?? '未命名技能'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {sb.status === 'published' ? '✓ 已上架' : '草稿'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right panel: chat + test */}
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                {/* Chat area */}
                <div className="flex-1 bg-white border rounded-xl flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {sandboxMessages.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">描述你想创建的技能，AI 帮你构建规格</p>
                        <p className="text-xs mt-1 text-gray-300">例：「调用和风天气 API，输入城市名返回今日天气」</p>
                      </div>
                    )}
                    {sandboxMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {sandboxChatting && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-xl px-3.5 py-2.5 text-sm text-gray-400">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin inline mr-1" />AI 思考中...
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggestions */}
                  {sandboxSuggestions.length > 0 && (
                    <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                      {sandboxSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setSandboxChatInput(s) }}
                          className="text-[11px] px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <div className="p-3 border-t flex gap-2">
                    <input
                      type="text"
                      value={sandboxChatInput}
                      onChange={e => setSandboxChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSandboxChat() } }}
                      placeholder="描述技能需求，或问 AI 如何配置..."
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={sandboxChatting}
                    />
                    <button
                      onClick={handleSandboxChat}
                      disabled={sandboxChatting || !sandboxChatInput.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 shrink-0"
                    >
                      发送
                    </button>
                  </div>
                </div>

                {/* Test area */}
                <div className="bg-white border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <Play className="w-4 h-4 text-gray-400" />测试运行
                    </p>
                    {sandboxReadyToTest && (
                      <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-600 rounded-full">已就绪</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <textarea
                        value={sandboxTestParams}
                        onChange={e => setSandboxTestParams(e.target.value)}
                        rows={3}
                        placeholder='{"location": "北京"}'
                        className="w-full border rounded-lg px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleSandboxTest}
                        disabled={sandboxTesting || !sandboxId}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg text-xs hover:bg-gray-900 disabled:opacity-40 whitespace-nowrap"
                      >
                        {sandboxTesting ? <><RefreshCw className="w-3 h-3 animate-spin inline mr-1" />运行中</> : '运行测试'}
                      </button>
                      {sandboxTestResult?.success && (
                        <button
                          onClick={() => setShowPublishModal(true)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 whitespace-nowrap flex items-center gap-1"
                        >
                          <Star className="w-3 h-3" />封装上架
                        </button>
                      )}
                    </div>
                  </div>
                  {sandboxTestResult && (
                    <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${sandboxTestResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                      <span className="font-medium">{sandboxTestResult.success ? '✓ 成功' : '✗ 失败'}</span>
                      <span className="ml-2">{sandboxTestResult.message}</span>
                      {!!sandboxTestResult.data && (
                        <pre className="mt-1 text-[10px] text-gray-600 overflow-auto max-h-24">{JSON.stringify(sandboxTestResult.data, null, 2) as string}</pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Sub-Tab C: 技能库 ── */}
          {skillsSubTab === 'library' && (
            <>
              <p className="text-sm text-gray-500 mb-5">已封装上架的技能，可分配给任意数字员工装载执行</p>
              {libraryLoading ? (
                <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
              ) : skillTemplates.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">技能库为空</p>
                  <p className="text-xs mt-1 text-gray-300">在「沙盘训练」中构建并封装技能后会出现在这里</p>
                  <button
                    onClick={() => setSkillsSubTab('sandbox')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    去训练技能
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {skillTemplates.map(tmpl => {
                    const SOURCE_LABELS: Record<string, string> = { http: 'HTTP', builtin: '内置', stub: '存根' }
                    const SOURCE_COLORS: Record<string, string> = {
                      http: 'bg-blue-100 text-blue-600',
                      builtin: 'bg-purple-100 text-purple-600',
                      stub: 'bg-gray-100 text-gray-500',
                    }
                    const CAT_LABELS: Record<string, string> = { data: '数据', communicate: '通信', document: '文档', browse: '浏览' }
                    return (
                      <div key={tmpl.id} className={`bg-white border rounded-xl p-4 ${!tmpl.enabled ? 'opacity-50' : ''}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium text-gray-800 truncate">{tmpl.name}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${SOURCE_COLORS[tmpl.toolSource] ?? 'bg-gray-100 text-gray-500'}`}>
                                {SOURCE_LABELS[tmpl.toolSource] ?? tmpl.toolSource}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-2">{tmpl.description}</p>
                          </div>
                          <button
                            onClick={async () => {
                              await fetch('/api/skill-templates', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: tmpl.id, enabled: !tmpl.enabled }),
                              })
                              loadSkillLibrary()
                            }}
                            className={`shrink-0 ml-2 transition-colors ${tmpl.enabled ? 'text-blue-500 hover:text-blue-600' : 'text-gray-300 hover:text-gray-400'}`}
                          >
                            {tmpl.enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                            {CAT_LABELS[tmpl.category] ?? tmpl.category}
                          </span>
                          <span className="text-[10px] text-gray-300">
                            {new Date(tmpl.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>

                        {/* Assign to agent */}
                        <div className="flex gap-2">
                          <select
                            value={assigningTemplate === tmpl.id ? assignTarget : ''}
                            onChange={e => { setAssigningTemplate(tmpl.id); setAssignTarget(e.target.value) }}
                            className="flex-1 border rounded text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">分配给数字员工...</option>
                            {Object.entries(AGENT_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>{label}</option>
                            ))}
                          </select>
                          <button
                            onClick={async () => {
                              if (!assignTarget) return
                              await fetch('/api/skills', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ agentType: assignTarget, skillTemplateId: tmpl.id }),
                              })
                              setAssigningTemplate(null)
                              setAssignTarget('')
                              loadSkills()
                            }}
                            disabled={!assignTarget || assigningTemplate !== tmpl.id}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-40"
                          >
                            装载
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Test Modal (工具装载 tab) */}
          {testModalTool && (() => {
            const tool = allTools.find(t => t.id === testModalTool)
            if (!tool) return null
            return (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setTestModalTool(null)}>
                <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-sm">{tool.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tool.description}</p>
                    </div>
                    <button onClick={() => setTestModalTool(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">测试参数（JSON）</label>
                    <textarea
                      value={testInput}
                      onChange={e => setTestInput(e.target.value)}
                      rows={5}
                      className="w-full border rounded px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder='{"url": "https://example.com"}'
                    />
                  </div>
                  {testResult && (
                    <div className={`mb-4 text-xs rounded-lg px-3 py-2.5 ${testResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                      <p className="font-medium mb-0.5">{testResult.success ? '✓ 执行成功' : '✗ 执行失败'}</p>
                      <p>{testResult.message}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setTestingToolId(tool.id)
                        setTestResult(null)
                        try {
                          let parsed = {}
                          try { parsed = JSON.parse(testInput) } catch { /* use empty */ }
                          const res = await fetch('/api/skills/test', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ toolId: tool.id, toolInput: parsed }),
                          })
                          const data = await res.json()
                          setTestResult({ success: data.success, message: data.message ?? (data.success ? '执行成功' : '执行失败') })
                        } catch (e) {
                          setTestResult({ success: false, message: String(e) })
                        } finally {
                          setTestingToolId(null)
                        }
                      }}
                      disabled={testingToolId === tool.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      {testingToolId === tool.id
                        ? <><RefreshCw className="w-3 h-3 animate-spin" />执行中...</>
                        : <><Play className="w-3 h-3" />立即执行</>}
                    </button>
                    <button onClick={() => setTestModalTool(null)} className="px-4 py-2 border rounded text-xs text-gray-600 hover:bg-gray-50">关闭</button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Publish Modal */}
          {showPublishModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowPublishModal(false)}>
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                <p className="font-semibold text-sm mb-4">封装上架技能</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">技能名称</label>
                    <input type="text" value={publishName} onChange={e => setPublishName(e.target.value)}
                      placeholder="如：查询天气"
                      className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">描述</label>
                    <textarea value={publishDesc} onChange={e => setPublishDesc(e.target.value)}
                      rows={2} placeholder="简述技能用途"
                      className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">分类</label>
                    <select value={publishCategory} onChange={e => setPublishCategory(e.target.value)}
                      className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="data">数据</option>
                      <option value="communicate">通信</option>
                      <option value="document">文档</option>
                      <option value="browse">浏览</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={handlePublish} disabled={publishing || !publishName.trim() || !publishDesc.trim()}
                    className="flex-1 py-2 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                    {publishing ? '上架中...' : '确认上架'}
                  </button>
                  <button onClick={() => setShowPublishModal(false)} className="px-4 py-2 border rounded text-xs text-gray-600 hover:bg-gray-50">取消</button>
                </div>
              </div>
            </div>
          )}

          {/* Import Modal */}
          {showImportModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowImportModal(false)}>
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
                <p className="font-semibold text-sm mb-1">导入 Skill JSON</p>
                <p className="text-xs text-gray-400 mb-4">兼容 OpenAI Function Calling 格式（name / description / parameters）</p>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  rows={10}
                  placeholder={'{\n  "name": "get_weather",\n  "description": "查询天气",\n  "parameters": {\n    "type": "object",\n    "properties": {\n      "location": { "type": "string", "description": "城市名" }\n    },\n    "required": ["location"]\n  }\n}'}
                  className="w-full border rounded px-2.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="flex gap-2 mt-4">
                  <button onClick={handleImport} disabled={importing || !importText.trim()}
                    className="flex-1 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                    {importing ? '导入中...' : '导入并进入沙盘'}
                  </button>
                  <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded text-xs text-gray-600 hover:bg-gray-50">取消</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* LLM Tab */}
      {tab === 'llm' && (
        <>
          <p className="text-sm text-gray-500 mb-4">配置 AI 数字员工使用的大模型 API</p>
          <div className="bg-white rounded-xl border p-5 max-w-lg">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">模型提供商</label>
                <div className="flex gap-2">
                  {[
                    { value: 'minimax', label: 'MiniMax', desc: '推荐，国内访问快' },
                    { value: 'openai_compatible', label: '自定义 OpenAI 兼容', desc: 'OpenAI / 本地模型' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLlmProvider(opt.value as typeof llmProvider)}
                      className={`flex-1 text-left px-3 py-2 rounded-lg border-2 text-xs transition-all ${
                        llmProvider === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium">{opt.label}</p>
                      <p className="text-gray-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  API Key
                  <span className="text-gray-400 font-normal ml-1">（留空则使用 .env 中的 MINIMAX_API_KEY）</span>
                </label>
                <div className="relative">
                  <input
                    type={showLlmKey ? 'text' : 'password'}
                    value={llmApiKey}
                    onChange={(e) => setLlmApiKey(e.target.value)}
                    placeholder={llmProvider === 'minimax' ? 'eyJhbGciOi...' : 'sk-...'}
                    className="w-full border rounded px-2.5 py-1.5 text-xs pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    onClick={() => setShowLlmKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showLlmKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {llmProvider === 'openai_compatible' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Base URL</label>
                  <input
                    type="text"
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1/chat/completions"
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  模型名称
                  <span className="text-gray-400 font-normal ml-1">（留空使用默认 MiniMax-Text-01）</span>
                </label>
                <input
                  type="text"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder={llmProvider === 'minimax' ? 'MiniMax-Text-01' : 'gpt-4o-mini'}
                  className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {llmTestResult && (
                <div className={`text-xs rounded-lg px-3 py-2 ${llmTestResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {llmTestResult.ok
                    ? `✓ 连接成功 · ${llmTestResult.model} · 延迟 ${llmTestResult.latencyMs}ms`
                    : `✗ ${llmTestResult.error}`}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleTestLlm}
                  disabled={llmTesting}
                  className="flex items-center gap-1.5 px-3 py-1.5 border rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {llmTesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  测试连接
                </button>
                <button
                  onClick={handleSaveLlm}
                  disabled={llmSaving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {llmSaving ? '保存中...' : llmSaved ? '✓ 已保存' : '保存配置'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">加载中...</div>}>
      <SettingsPageInner />
    </Suspense>
  )
}

function HealthIcon({ status }: { status: string }) {
  if (status === 'healthy') return <CheckCircle className="w-4 h-4 text-green-500" />
  if (status === 'degraded') return <AlertCircle className="w-4 h-4 text-yellow-500" />
  return <XCircle className="w-4 h-4 text-red-500" />
}

function AuthBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    authorized: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    expired: 'bg-orange-100 text-orange-700',
    error: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    authorized: '已授权', pending: '待授权', expired: '已过期', error: '错误'
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {labels[status] ?? status}
    </span>
  )
}
