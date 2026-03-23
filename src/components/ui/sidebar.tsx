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

type NavItem = {
  href: string
  label: string
  hint?: string
  icon: React.ElementType
  primaryFor: UserRole[]
}

type NavGroup = {
  groupLabel?: string
  items: NavItem[]
}

// 导航分组结构，让用户清楚各菜单职责
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/inbox', label: 'AI 收件箱', icon: Inbox, primaryFor: ['sales'] },
      { href: '/workspace', label: '商机作战台', icon: Swords, primaryFor: ['sales', 'solution'] },
      { href: '/pipeline', label: '销售流水线', icon: GitBranch, primaryFor: ['manager', 'sales'] },
      { href: '/assets', label: '资产库', icon: BookOpen, primaryFor: ['solution'] },
    ],
  },
  {
    groupLabel: 'AI 协作处理',
    items: [
      { href: '/intervention', label: '人工干预台', hint: '待我决策', icon: UserCheck, primaryFor: ['sales', 'solution'] },
      { href: '/tasks', label: '任务中心', hint: '我的任务', icon: ClipboardList, primaryFor: ['sales', 'solution', 'manager'] },
      { href: '/drafts', label: '草稿中心', hint: '待发内容', icon: FileEdit, primaryFor: ['sales'] },
      { href: '/execution', label: '执行记录', hint: '执行历史', icon: Zap, primaryFor: ['sales', 'solution', 'manager'] },
    ],
  },
  {
    groupLabel: '运营管理',
    items: [
      { href: '/dashboard', label: '运行驾驶舱', icon: LayoutDashboard, primaryFor: ['manager'] },
      { href: '/connectors', label: '连接器中心', icon: Plug, primaryFor: ['manager'] },
      { href: '/evolution', label: '进化中心', icon: TrendingUp, primaryFor: ['manager'] },
      { href: '/sandbox', label: '沙盘测试', icon: FlaskConical, primaryFor: ['manager'] },
      { href: '/flow', label: '系统运转图', icon: RefreshCw, primaryFor: ['manager'] },
    ],
  },
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
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-3">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter(({ primaryFor }) => {
            if (!role) return true
            return primaryFor.includes(role)
          })
          if (visibleItems.length === 0) return null
          return (
            <div key={gi}>
              {group.groupLabel && (
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-3 mb-1">
                  {group.groupLabel}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(({ href, label, hint, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 leading-tight">{label}</span>
                      {hint && !active && (
                        <span className="text-[10px] text-gray-500 leading-tight">{hint}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
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
