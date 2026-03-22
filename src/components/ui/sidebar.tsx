'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Inbox,
  Swords,
  UserCheck,
  Zap,
  Plug,
  TrendingUp,
  LayoutDashboard,
  Bot,
  BookOpen,
  ClipboardList,
  FileEdit,
  GitBranch,
  RefreshCw,
  ChevronDown,
  FlaskConical,
} from 'lucide-react'
import { useRole, ROLE_LABELS, type UserRole } from '@/hooks/useRole'

// primaryFor: which roles see this nav item as primary (highlighted)
const NAV_ITEMS = [
  { href: '/flow', label: '系统运转图', icon: RefreshCw, primaryFor: ['sales', 'solution', 'manager'] },
  { href: '/inbox', label: 'AI 收件箱', icon: Inbox, primaryFor: ['sales'] },
  { href: '/workspace', label: '商机作战台', icon: Swords, primaryFor: ['sales', 'solution'] },
  { href: '/pipeline', label: '销售流水线', icon: GitBranch, primaryFor: ['manager', 'sales'] },
  { href: '/assets', label: '资产库', icon: BookOpen, primaryFor: ['solution'] },
  { href: '/intervention', label: '人工干预台', icon: UserCheck, primaryFor: ['sales', 'solution'] },
  { href: '/tasks', label: '任务中心', icon: ClipboardList, primaryFor: ['sales', 'solution', 'manager'] },
  { href: '/drafts', label: '草稿中心', icon: FileEdit, primaryFor: ['sales'] },
  { href: '/execution', label: '执行中心', icon: Zap, primaryFor: [] },
  { href: '/connectors', label: '连接器中心', icon: Plug, primaryFor: ['manager'] },
  { href: '/sandbox', label: '沙盘测试', icon: FlaskConical, primaryFor: ['manager'] },
  { href: '/evolution', label: '进化中心', icon: TrendingUp, primaryFor: ['manager'] },
  { href: '/dashboard', label: '运行驾驶舱', icon: LayoutDashboard, primaryFor: ['manager'] },
]

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'sales', label: '销售', desc: '日常跟单、录入信息' },
  { value: 'solution', label: '解方经理', desc: '方案设计、资产管理' },
  { value: 'manager', label: '管理层', desc: '全局看板、规则治理' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { role, setRole } = useRole()
  const [showRolePicker, setShowRolePicker] = useState(false)

  return (
    <aside className="w-56 flex-shrink-0 bg-gray-900 text-gray-100 flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-blue-400" />
          <span className="font-semibold text-sm leading-tight">
            云艺化AI原生LTC<br />
            <span className="text-gray-400 font-normal text-xs">人机协作系统</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, primaryFor }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          // Dim item if role is set AND this item is not primary for that role
          const isPrimary = !role || primaryFor.length === 0 || primaryFor.includes(role)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : isPrimary
                  ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                  : 'text-gray-600 hover:bg-gray-800 hover:text-gray-400'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? '' : isPrimary ? '' : 'opacity-40'}`} />
              <span className={active || isPrimary ? '' : 'opacity-50'}>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Role selector */}
      <div className="px-3 py-3 border-t border-gray-800">
        <button
          onClick={() => setShowRolePicker((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
            <span className="text-xs text-gray-300">
              {role ? `${ROLE_LABELS[role]}视角` : '选择角色视角'}
            </span>
          </div>
          <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${showRolePicker ? 'rotate-180' : ''}`} />
        </button>

        {showRolePicker && (
          <div className="mt-1 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setRole(opt.value); setShowRolePicker(false) }}
                className={`w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-gray-700 transition-colors ${
                  role === opt.value ? 'bg-blue-900/40' : ''
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${role === opt.value ? 'bg-blue-400' : 'bg-gray-600'}`} />
                <div>
                  <p className="text-xs font-medium text-gray-200">{opt.label}</p>
                  <p className="text-[11px] text-gray-500 leading-tight">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-600 mt-2 px-1">云艺化AI原生LTC v2.0</p>
      </div>
    </aside>
  )
}
