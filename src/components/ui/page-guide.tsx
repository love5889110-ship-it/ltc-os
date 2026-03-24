'use client'

import { useState, useEffect } from 'react'
import { Info, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { UserRole } from '@/hooks/useRole'

export interface RoleContent {
  roleLabel: string       // 当前角色标签
  purpose: string         // 这页是什么
  whenToUse: string       // 什么时候来这里
  aiAlreadyDid: string    // AI 来之前已完成什么
  youDecide: string       // 你只需做什么判断
  dontDo?: string         // 明确不需要做什么（可选）
  nextStepLabel: string   // 下一步标签
  nextStepHref: string    // 下一步链接
}

interface PageGuideProps {
  contents: Partial<Record<NonNullable<UserRole> | 'all', RoleContent>>
  storageKey: string
}

const ROLE_LABELS_MAP: Record<NonNullable<UserRole>, string> = {
  sales: '销售',
  solution: '方案经理',
  manager: '管理层',
}

const ROLE_ORDER: NonNullable<UserRole>[] = ['sales', 'solution', 'manager']

export function PageGuide({ contents, storageKey }: PageGuideProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [currentRole, setCurrentRole] = useState<NonNullable<UserRole> | null>(null)
  const [previewRole, setPreviewRole] = useState<NonNullable<UserRole> | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('ltc_role') as UserRole
    if (stored && ['sales', 'solution', 'manager'].includes(stored)) {
      setCurrentRole(stored as NonNullable<UserRole>)
    }
    const savedCollapse = localStorage.getItem(`guide_${storageKey}`)
    if (savedCollapse === null) {
      setCollapsed(false)
    } else {
      setCollapsed(savedCollapse === '1' || savedCollapse === 'collapsed')
    }
  }, [storageKey])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(`guide_${storageKey}`, next ? '1' : '0')
  }

  if (!mounted) return null

  const displayRole = previewRole ?? currentRole
  const content = (displayRole ? contents[displayRole] : undefined) ?? contents['all']
  if (!content) return null

  const availableRoles = ROLE_ORDER.filter(r => contents[r])

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl mb-4 overflow-hidden">
      {/* Header bar */}
      <button
        onClick={toggleCollapse}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-blue-100/50 transition-colors"
      >
        <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-xs font-medium text-blue-700 flex-1 text-left">
          {content.purpose}
        </span>
        {!collapsed && availableRoles.length > 1 && (
          <div className="flex gap-1 mr-2" onClick={e => e.stopPropagation()}>
            {availableRoles.map(r => (
              <button
                key={r}
                onClick={() => setPreviewRole(previewRole === r ? null : r)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  (previewRole ?? currentRole) === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-500 hover:bg-blue-200'
                }`}
              >
                {ROLE_LABELS_MAP[r]}
              </button>
            ))}
          </div>
        )}
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          : <ChevronUp className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        }
      </button>

      {/* Expanded content */}
      {!collapsed && (
        <div className="px-4 pb-3 pt-1 border-t border-blue-100 space-y-2">
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex gap-2">
              <span className="text-blue-400 font-medium w-14 flex-shrink-0">何时来</span>
              <span className="text-gray-600">{content.whenToUse}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400 font-medium w-14 flex-shrink-0">AI已做</span>
              <span className="text-gray-600">{content.aiAlreadyDid}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 font-semibold w-14 flex-shrink-0">你来做</span>
              <span className="text-gray-700 font-medium">{content.youDecide}</span>
            </div>
            {content.dontDo && (
              <div className="flex gap-2">
                <span className="text-gray-400 font-medium w-14 flex-shrink-0">不需要</span>
                <span className="text-gray-400">{content.dontDo}</span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-blue-100 flex items-center justify-between">
            <span className="text-[10px] text-blue-400">做完后下一步</span>
            <Link
              href={content.nextStepHref}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {content.nextStepLabel}
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
