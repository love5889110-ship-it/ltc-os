'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'

interface PageGuideProps {
  role: string        // e.g. "销售" | "管理层" | "全员"
  what: string        // one-line description of this page
  firstStep: string   // what to do first
  storageKey: string  // unique key for localStorage collapse state
}

export function PageGuide({ role, what, firstStep, storageKey }: PageGuideProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(`guide_${storageKey}`)
    if (stored === 'collapsed') setCollapsed(true)
  }, [storageKey])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(`guide_${storageKey}`, next ? 'collapsed' : 'open')
  }

  return (
    <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-blue-100/50 transition-colors"
      >
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-xs font-medium text-blue-700 flex-1">
          <span className="bg-blue-200 text-blue-800 rounded px-1.5 py-0.5 mr-2 text-[11px]">{role}</span>
          {what}
        </span>
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
          : <ChevronUp className="w-3.5 h-3.5 text-blue-400" />}
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-[11px] text-blue-500 font-medium whitespace-nowrap">第一步</span>
          <span className="text-xs text-blue-700 leading-relaxed">{firstStep}</span>
        </div>
      )}
    </div>
  )
}
