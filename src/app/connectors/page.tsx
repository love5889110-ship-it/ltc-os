'use client'

import { useState, useEffect } from 'react'
import { Plug, CheckCircle, XCircle, AlertCircle, RefreshCw, Settings, Play, Bot, Eye, EyeOff, Zap } from 'lucide-react'
import { PageGuide } from '@/components/ui/page-guide'

interface Connector {
  id: string
  connectorType: string
  connectorName: string
  authStatus: string
  healthStatus: string
  enabled: boolean
  lastSyncAt: string | null
}

interface SyncResult {
  synced: number
  skipped: number
  errors: number
}

const CONNECTOR_META: Record<string, { label: string; description: string }> = {
  get_note: { label: 'Get 笔记', description: '自动同步录音转写笔记为信号' },
  recording: { label: '录音转写', description: '接入录音文件的转写结果' },
  dingtalk: { label: '钉钉', description: '钉钉消息与任务同步' },
  file_ocr: { label: '文件/OCR', description: '上传文件并 OCR 识别' },
  wechat_proxy: { label: '微信（替代方案）', description: '通过中间件接入微信内容' },
  manual: { label: '手动录入', description: '通过界面手动录入信号' },
}

const STUB_CONNECTORS = new Set(['recording', 'dingtalk', 'file_ocr', 'wechat_proxy'])

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [configuring, setConfiguring] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<Record<string, SyncResult>>({})

  // LLM config state
  const [llmProvider, setLlmProvider] = useState<'minimax' | 'openai_compatible'>('minimax')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [llmSaving, setLlmSaving] = useState(false)
  const [llmSaved, setLlmSaved] = useState(false)
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{ ok?: boolean; error?: string; latencyMs?: number; model?: string } | null>(null)

  const load = () => {
    fetch('/api/connectors')
      .then((r) => r.json())
      .then((d) => { setConnectors(d.connectors ?? []); setLoading(false) })
  }

  useEffect(() => {
    load()
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
      setSyncResult((prev) => ({ ...prev, get_note: { synced: data.synced, skipped: data.skipped, errors: data.errors } }))
      setConfiguring(null)
      setApiKey('')
      setClientId('')
      load()
    }
  }

  const handleSync = async (connectorType: string) => {
    setSyncing(connectorType)
    setSyncResult((prev) => ({ ...prev, [connectorType]: undefined as any }))
    const res = await fetch('/api/connectors/get-note/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    setSyncing(null)
    if (data.success) {
      setSyncResult((prev) => ({ ...prev, [connectorType]: { synced: data.synced, skipped: data.skipped, errors: data.errors } }))
      load()
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
    <div className="p-6">
      <PageGuide
        role="管理员"
        what="连接外部数据源（Get笔记、录音、钉钉等），配置大模型 API，让销售沟通内容自动流入 AI 收件箱"
        firstStep="找到「Get 笔记」连接器完成授权；再配置「大模型 API」确保 AI 数字员工可以运行"
        storageKey="connectors"
      />
      <div className="flex items-center gap-3 mb-6">
        <Plug className="w-5 h-5 text-blue-600" />
        <h1 className="text-lg font-semibold">连接器中心</h1>
        <span className="text-sm text-gray-500">
          {connectors.filter((c) => c.enabled && c.healthStatus === 'healthy').length} 个正常运行
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {connectors.map((connector) => {
            const meta = CONNECTOR_META[connector.connectorType]
            const result = syncResult[connector.connectorType]
            const isSyncing = syncing === connector.connectorType
            const isGetNote = connector.connectorType === 'get_note'
            const isStub = STUB_CONNECTORS.has(connector.connectorType)

            return (
              <div key={connector.id} className={`bg-white rounded-xl border p-5 relative ${!connector.enabled ? 'opacity-60' : ''}`}>
                {isStub && (
                  <span className="absolute top-3 right-3 text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                    即将上线
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-sm">{connector.connectorName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{meta?.description}</p>
                  </div>
                  <HealthIcon status={connector.healthStatus} />
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <AuthBadge status={connector.authStatus} />
                  {!connector.enabled && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">已停用</span>
                  )}
                </div>

                {connector.lastSyncAt && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                    <RefreshCw className="w-3 h-3" />
                    上次同步: {new Date(connector.lastSyncAt).toLocaleString('zh-CN')}
                  </p>
                )}

                {result && (
                  <div className="text-xs text-gray-600 bg-green-50 border border-green-200 rounded px-2.5 py-2 mb-2">
                    新增信号 <span className="font-bold text-green-700">{result.synced}</span> 条
                    {result.skipped > 0 && `，跳过 ${result.skipped} 条`}
                    {result.errors > 0 && <span className="text-red-500">，失败 {result.errors} 条</span>}
                  </div>
                )}

                {isGetNote && configuring === 'get_note' && (
                  <div className="mb-3 space-y-2">
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="API Key (gk_live_...)"
                      className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Client ID (cli_...)"
                      className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveGetNote}
                        disabled={saving || !apiKey.trim() || !clientId.trim()}
                        className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? '保存并同步中...' : '保存并立即同步'}
                      </button>
                      <button
                        onClick={() => setConfiguring(null)}
                        className="px-3 py-1.5 border rounded text-xs text-gray-600"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t flex gap-2">
                  {isStub ? (
                    <p className="text-xs text-gray-400 italic w-full text-center py-1">集成功能开发中，敬请期待</p>
                  ) : (
                    <>
                  {isGetNote && connector.authStatus === 'authorized' && (
                    <button
                      onClick={() => handleSync('get_note')}
                      disabled={isSyncing}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSyncing
                        ? <><RefreshCw className="w-3 h-3 animate-spin" />同步中...</>
                        : <><Play className="w-3 h-3" />立即同步</>}
                    </button>
                  )}
                  <button
                    onClick={() => setConfiguring(configuring === connector.connectorType ? null : connector.connectorType)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 border rounded text-xs text-gray-600 hover:bg-gray-50"
                  >
                    <Settings className="w-3 h-3" />
                    {connector.authStatus === 'authorized' ? '重新配置' : '配置'}
                  </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 大模型 API 配置 */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-500" />
          大模型 API 配置
          <span className="text-xs text-gray-400 font-normal">数字员工的 AI 能力来源</span>
        </h2>
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
      </div>
    </div>
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
