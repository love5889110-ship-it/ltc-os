'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Swords,
  LayoutDashboard,
  Bot,
  BookOpen,
  ChevronDown,
  Settings,
  Cpu,
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

const NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: '主价值流',
    items: [
      { href: '/workspace', label: '商机作战空间',   hint: '各商机 Agent 协作 · 实时推进',  icon: Swords,         primaryFor: ['sales', 'solution', 'manager'] },
    ],
  },
  {
    groupLabel: '赋能区',
    items: [
      { href: '/assets',    label: '知识资产',      hint: '注入 AI 的方案、案例与话术',  icon: BookOpen, primaryFor: ['sales', 'solution', 'manager'] },
      { href: '/evolution', label: 'Agent 能力中心', hint: '决策能力 · 行动能力',         icon: Cpu,      primaryFor: ['sales', 'solution', 'manager'] },
    ],
  },
  {
    groupLabel: '管理',
    items: [
      { href: '/dashboard', label: '经营概览', hint: '商机健康 · AI效率 · 赢单趋势', icon: LayoutDashboard, primaryFor: ['manager'] },
    ],
  },
  {
    groupLabel: '系统配置',
    items: [
      { href: '/settings', label: '连接器与模型', hint: '数据接入与大模型配置', icon: Settings, primaryFor: ['sales', 'solution', 'manager'] },
    ],
  },
]

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: null,       label: '全部',       desc: '显示所有菜单' },
  { value: 'sales',    label: '销售/商务',  desc: '客户跟进、报价谈判、合同' },
  { value: 'solution', label: '解决方案经理', desc: '方案设计、技术支持' },
  { value: 'manager',  label: '管理层',     desc: '全局看板、规则治理' },
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
            AI原生经营系统<br />
            <span className="text-gray-400 font-normal text-xs">云艺化 · LTC全流程</span>
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
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="leading-tight truncate">{label}</div>
                        {hint && !active && (
                          <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{hint}</div>
                        )}
                      </div>
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
                key={String(opt.value)}
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
