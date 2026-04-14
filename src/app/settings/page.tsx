'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Settings, Plug, Bot, CheckCircle, XCircle, AlertCircle, RefreshCw, Eye, EyeOff, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'


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
  dingtalk: { label: '钉钉', description: '监听指定钉钉群消息，自动转化为销售信号' },
  wecom: { label: '企业微信', description: '接收企业微信应用消息或群机器人推送' },
  recording: { label: '录音转写', description: '上传录音文件，AI 自动转写为信号' },
  file_ocr: { label: '文件/OCR', description: '上传文件并 OCR 识别' },
  wechat_proxy: { label: '个人微信（中间件）', description: '通过本地 hook 工具接入个人微信群' },
  manual: { label: '手动录入', description: '通过界面手动录入信号' },
}

type Tab = 'connectors' | 'llm'

function SettingsPageInner() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>((tabParam as Tab) ?? 'connectors')

  // Connector state
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)

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


  useEffect(() => {
    loadConnectors()
    loadDingTalkConfig()
    loadWeComConfig()
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
      </div>

      {/* Connectors Tab */}
      {tab === 'connectors' && (
        <>
          <p className="text-sm text-gray-500 mb-5">配置数据接入管道，连接后内容自动流入信号台</p>

          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
          ) : (
            <>
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
