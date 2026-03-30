'use client'

/**
 * SkillTrainingPanel — 对话驱动的技能训练面板
 *
 * 布局：左侧 AI 对话，右侧实时规格预览 + 测试
 * 面向非技术员工：用中文描述需求，AI 自动生成技能规格
 */

import { useState, useRef, useEffect } from 'react'
import {
  Send, Play, Upload, CheckCircle, XCircle, Clock,
  Loader2, Sparkles, ChevronRight, AlertCircle,
} from 'lucide-react'
import type { ActionSkill } from '../../types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface SkillSpec {
  name?: string
  displayName?: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface ExecutionConfig {
  type?: string
  apiUrl?: string
  httpMethod?: string
}

interface Props {
  onPublished: (skill: ActionSkill) => void
  onCancel: () => void
}

// 快捷示例提示词
const QUICK_PROMPTS = [
  '自动发送竞品应对邮件给客户',
  '查询客户公司信息和资质',
  '生成个性化方案介绍文档',
  '浏览竞品官网收集价格信息',
  '自动推送微信消息给客户联系人',
]

export function SkillTrainingPanel({ onPublished, onCancel }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '你好！告诉我你想要自动完成什么任务，我来帮你训练一个可以真正执行的技能。\n\n例如：\n• 当检测到竞争对手来访时，自动生成并发送应对方案\n• 查询客户公司的资质认证信息\n• 根据商机阶段自动更新周报',
    },
  ])
  const [inputText, setInputText] = useState('')
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [skillSpec, setSkillSpec] = useState<SkillSpec | null>(null)
  const [executionConfig, setExecutionConfig] = useState<ExecutionConfig | null>(null)
  const [readyToTest, setReadyToTest] = useState(false)
  const [sending, setSending] = useState(false)

  // 测试区域
  const [testInput, setTestInput] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean; message: string; data?: unknown
  } | null>(null)
  const [testDurationMs, setTestDurationMs] = useState<number>(0)

  // 发布区域
  const [publishing, setPublishing] = useState(false)
  const [publishName, setPublishName] = useState('')
  const [publishDesc, setPublishDesc] = useState('')
  const [published, setPublished] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 技能规格更新时，初始化测试输入字段
  useEffect(() => {
    if (skillSpec?.inputSchema) {
      const props = (skillSpec.inputSchema as any)?.properties ?? {}
      const initInput: Record<string, string> = {}
      Object.keys(props).forEach((k) => {
        initInput[k] = testInput[k] ?? ''
      })
      setTestInput(initInput)
    }
    if (skillSpec?.displayName) setPublishName(skillSpec.displayName)
    if (skillSpec?.description) setPublishDesc(skillSpec.description)
  }, [skillSpec])

  const sendMessage = async (text?: string) => {
    const msg = (text ?? inputText).trim()
    if (!msg || sending) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setInputText('')
    setSending(true)

    try {
      const res = await fetch('/api/skill-sandbox?action=chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandboxId: sandboxId ?? undefined,
          userMessage: msg,
        }),
      })
      const data = await res.json()
      if (data.sandboxId) setSandboxId(data.sandboxId)
      if (data.skillSpec) setSkillSpec(data.skillSpec)
      if (data.executionConfig) setExecutionConfig(data.executionConfig)
      if (data.readyToTest) setReadyToTest(true)

      setMessages([
        ...newMessages,
        { role: 'assistant', content: data.message ?? '好的，我已经更新了技能配置。' },
      ])
    } catch (e) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `出现错误：${String(e)}` },
      ])
    } finally {
      setSending(false)
    }
  }

  const runTest = async () => {
    if (!sandboxId) return
    setTesting(true)
    setTestResult(null)
    const start = Date.now()
    try {
      const res = await fetch('/api/skill-sandbox?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandboxId, testParams: testInput }),
      })
      const data = await res.json()
      setTestDurationMs(Date.now() - start)
      setTestResult({ success: data.success, message: data.message, data: data.data })
    } catch (e) {
      setTestDurationMs(Date.now() - start)
      setTestResult({ success: false, message: String(e) })
    } finally {
      setTesting(false)
    }
  }

  const handlePublish = async () => {
    if (!sandboxId || !publishName.trim()) return
    setPublishing(true)
    try {
      const res = await fetch('/api/skill-sandbox?action=publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandboxId,
          name: publishName.trim(),
          description: publishDesc.trim() || publishName.trim(),
          category: guessCategory(executionConfig),
        }),
      })
      const data = await res.json()
      if (data.skillTemplateId) {
        setPublished(true)
        // 构造 ActionSkill 通知父组件
        const skill: ActionSkill = {
          id: data.skillTemplateId,
          name: publishName,
          description: publishDesc || publishName,
          sourceType: 'internal',
          type: guessCategory(executionConfig),
          status: 'callable',
          sandboxId: sandboxId,
          toolSource: executionConfig?.type ?? 'stub',
          inputSchema: (skillSpec?.inputSchema as Record<string, unknown>) ?? {},
          outputSchema: {},
          applicableTaskTypes: [],
          requiresHumanReview: false,
          successRate: 0,
          updatedAt: new Date().toISOString(),
        }
        setTimeout(() => onPublished(skill), 1200)
      }
    } finally {
      setPublishing(false)
    }
  }

  const inputProps = skillSpec?.inputSchema
    ? Object.entries((skillSpec.inputSchema as any)?.properties ?? {})
    : []

  const hasSpec = skillSpec && (skillSpec.displayName || skillSpec.name)

  return (
    <div className="flex gap-4 h-full min-h-[500px]">
      {/* 左侧：AI 对话区 */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        {/* 对话头 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-white">AI 技能训练助手</span>
          {sandboxId && (
            <span className="text-[9px] text-slate-600 font-mono ml-auto">
              #{sandboxId.slice(-6)}
            </span>
          )}
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-800/80 text-slate-200 rounded-bl-sm'
              }`}>
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-slate-800/80 rounded-2xl rounded-bl-sm px-3 py-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 快捷提示 */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-[10px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-600/50 text-slate-400 hover:text-indigo-300 rounded-full transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* 输入框 */}
        <div className="px-3 pb-3 flex-shrink-0">
          <div className="flex gap-2 bg-slate-800/60 border border-slate-700 rounded-xl p-1.5 focus-within:border-indigo-500/60 transition-colors">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="描述你想要自动化的任务… (Enter 发送)"
              rows={2}
              disabled={sending}
              className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none min-h-[40px]"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!inputText.trim() || sending}
              className="self-end p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：规格预览 + 测试 + 发布 */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* 技能规格卡 */}
        <div className={`bg-slate-900/40 border rounded-2xl overflow-hidden transition-colors ${
          hasSpec ? 'border-indigo-800/50' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 bg-slate-900/60">
            <div className={`w-1.5 h-1.5 rounded-full ${hasSpec ? 'bg-indigo-400' : 'bg-slate-700'}`} />
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">技能规格</span>
          </div>
          {!hasSpec ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[10px] text-slate-600">与 AI 对话后，技能规格将自动生成</p>
            </div>
          ) : (
            <div className="p-3 space-y-2.5">
              <div>
                <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">技能名称</p>
                <p className="text-xs font-semibold text-white">{skillSpec.displayName || skillSpec.name}</p>
              </div>
              {skillSpec.description && (
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">功能描述</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{skillSpec.description}</p>
                </div>
              )}
              {executionConfig?.type && (
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5">执行方式</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      executionConfig.type === 'http' ? 'bg-blue-900/40 text-blue-400' :
                      executionConfig.type === 'builtin' ? 'bg-green-900/40 text-green-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {executionConfig.type === 'http' ? 'HTTP 接口' :
                       executionConfig.type === 'builtin' ? '内置工具' : '存根'}
                    </span>
                    {executionConfig.apiUrl && (
                      <span className="text-[9px] text-slate-600 truncate font-mono">
                        {executionConfig.apiUrl}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {inputProps.length > 0 && (
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">输入参数</p>
                  <div className="space-y-0.5">
                    {inputProps.map(([k, v]: [string, unknown]) => (
                      <div key={k} className="flex items-center gap-2">
                        <code className="text-[9px] text-cyan-400 font-mono">{k}</code>
                        <span className="text-[9px] text-slate-600">{(v as any)?.description || (v as any)?.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 测试区域 */}
        {hasSpec && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 bg-slate-900/60">
              <Play className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">真实测试</span>
              {!readyToTest && (
                <span className="text-[9px] text-yellow-500 ml-auto">继续对话完善配置</span>
              )}
            </div>
            <div className="p-3 space-y-2.5">
              {inputProps.length > 0 ? (
                <div className="space-y-2">
                  {inputProps.map(([k, v]: [string, unknown]) => (
                    <div key={k}>
                      <label className="text-[9px] text-slate-500 block mb-0.5">
                        {k}
                        {(skillSpec.inputSchema as any)?.required?.includes(k) && (
                          <span className="text-red-500 ml-0.5">*</span>
                        )}
                        <span className="text-slate-700 ml-1">
                          {(v as any)?.description}
                        </span>
                      </label>
                      <input
                        value={testInput[k] ?? ''}
                        onChange={(e) => setTestInput({ ...testInput, [k]: e.target.value })}
                        placeholder={(v as any)?.example ?? `输入 ${k}`}
                        className="w-full text-xs bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-600 text-center py-2">暂无输入参数</p>
              )}

              <button
                onClick={runTest}
                disabled={testing || !sandboxId}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded-xl transition-colors"
              >
                {testing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />执行中…</>
                  : <><Play className="w-3.5 h-3.5" />执行测试</>}
              </button>

              {testResult && (
                <div className={`rounded-xl border p-2.5 space-y-1.5 ${
                  testResult.success
                    ? 'bg-green-950/20 border-green-800/40'
                    : 'bg-red-950/20 border-red-800/40'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {testResult.success
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                      <span className={`text-xs font-semibold ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                        {testResult.success ? '执行成功' : '执行失败'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-600">
                      <Clock className="w-3 h-3" />
                      {testDurationMs}ms
                    </div>
                  </div>
                  {testResult.message && (
                    <p className="text-[10px] text-slate-400">{testResult.message}</p>
                  )}
                  {testResult.data != null && (
                    <pre className="text-[9px] font-mono text-slate-400 bg-slate-900/60 rounded-lg p-2 overflow-auto max-h-24 whitespace-pre-wrap">
                      {typeof testResult.data === 'string'
                        ? testResult.data
                        : JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 发布区域 */}
        {hasSpec && !published && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800 bg-slate-900/60">
              <Upload className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">发布上架</span>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <label className="text-[9px] text-slate-500 block mb-0.5">技能名称 *</label>
                <input
                  value={publishName}
                  onChange={(e) => setPublishName(e.target.value)}
                  placeholder="如：竞品应对方案生成"
                  className="w-full text-xs bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                />
              </div>
              <div>
                <label className="text-[9px] text-slate-500 block mb-0.5">功能描述</label>
                <textarea
                  value={publishDesc}
                  onChange={(e) => setPublishDesc(e.target.value)}
                  rows={2}
                  placeholder="简要说明此技能的用途"
                  className="w-full text-xs bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 resize-none placeholder-slate-600"
                />
              </div>
              <div className="flex items-start gap-1.5 bg-yellow-900/20 border border-yellow-800/30 rounded-lg px-2.5 py-2">
                <AlertCircle className="w-3 h-3 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-[9px] text-yellow-400 leading-relaxed">
                  发布后需在「绑定」中分配给对应 Agent，技能才会在实际任务中被调用
                </p>
              </div>
              <button
                onClick={handlePublish}
                disabled={publishing || !publishName.trim() || !sandboxId}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                {publishing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />发布中…</>
                  : <><ChevronRight className="w-3.5 h-3.5" />发布为可调用技能</>}
              </button>
            </div>
          </div>
        )}

        {/* 发布成功 */}
        {published && (
          <div className="bg-green-950/20 border border-green-800/40 rounded-2xl p-4 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
            <p className="text-sm font-semibold text-green-400">技能已发布！</p>
            <p className="text-[10px] text-slate-500">正在跳转到技能详情…</p>
          </div>
        )}

        {/* 取消 */}
        <button
          onClick={onCancel}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors py-1"
        >
          取消，返回技能列表
        </button>
      </div>
    </div>
  )
}

function guessCategory(config: ExecutionConfig | null): string {
  if (!config) return 'data'
  if (config.type === 'builtin') return 'communicate'
  if (config.apiUrl?.includes('mail') || config.apiUrl?.includes('email')) return 'communicate'
  return 'data'
}
