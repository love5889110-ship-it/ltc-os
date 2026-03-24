'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquarePlus, X, Send, Mic } from 'lucide-react'

const TEMPLATES = [
  { label: '渠道反馈', text: '[渠道名] 反馈：[客户名] ' },
  { label: '客户需求', text: '[客户名] 提到：' },
  { label: '竞品信息', text: '[竞品名] 在 [客户名] 处：' },
  { label: '风险预警', text: '[客户名] 存在风险：' },
]

// Pages that already have their own signal input — hide the FAB there
const HIDE_ON_PATHS = ['/inbox']

export function QuickSignalButton() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (HIDE_ON_PATHS.some((p) => pathname.startsWith(p))) return null

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    await fetch('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'manual',
        rawContent: content.trim(),
      }),
    })
    setSubmitting(false)
    setSubmitted(true)
    setContent('')
    setTimeout(() => {
      setSubmitted(false)
      setOpen(false)
    }, 1500)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center transition-transform hover:scale-105"
        title="快速记录信号"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold">快速记录信号</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {/* Template shortcuts */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setContent(t.text)}
                    className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 border border-blue-200"
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
                }}
                placeholder="记录一条信号，例如：华北渠道 反馈：XX煤矿 倾向于低价方案，竞品幻威已报价..."
                rows={4}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
              />

              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-400">⌘+Enter 快速提交 · AI 将自动提炼并归类</p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !content.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitted ? (
                    '✓ 已录入'
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      {submitting ? '提交中...' : '提交'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
