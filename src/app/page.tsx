'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, ArrowRight, RefreshCw } from 'lucide-react'
import type { UserRole } from '@/hooks/useRole'

const ROLE_DEFAULTS: Record<NonNullable<UserRole>, string> = {
  sales: '/inbox',
  solution: '/intervention',
  manager: '/dashboard',
}

const ROLE_CARDS: Array<{
  role: NonNullable<UserRole>
  label: string
  subtitle: string
  color: string
  border: string
  badge: string
  daily: string[]
  aiDid: string[]
}> = [
  {
    role: 'sales',
    label: '销售 / 商务',
    subtitle: '客户跟进、报价谈判、合同',
    color: 'text-blue-600',
    border: 'border-blue-200 hover:border-blue-400',
    badge: 'bg-blue-50 text-blue-600',
    daily: ['确认 AI 感知的客户信号归属', '审批 AI 建议的跟进动作', '执行拜访/沟通/推进任务'],
    aiDid: ['信号标准化与归属建议', '邮件/方案草稿自动生成', '风险预警与阶段推进建议'],
  },
  {
    role: 'solution',
    label: '方案经理',
    subtitle: '方案设计、技术支持',
    color: 'text-purple-600',
    border: 'border-purple-200 hover:border-purple-400',
    badge: 'bg-purple-50 text-purple-600',
    daily: ['审批技术类动作与方案草稿', '核查标书内容与技术评估', '处理标书任务与交付文档'],
    aiDid: ['方案研判与竞品分析', '招标文件智能解析', '跨数字员工协同分析'],
  },
  {
    role: 'manager',
    label: '管理层',
    subtitle: '全局看板、规则治理',
    color: 'text-green-600',
    border: 'border-green-200 hover:border-green-400',
    badge: 'bg-green-50 text-green-600',
    daily: ['查看高风险商机状态', '治理 AI 判断规则', '看系统运行数据'],
    aiDid: ['全局商机健康评分', '动作积压自动分析', '进化效果跟踪与规则沉淀'],
  },
]

export default function HomePage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [selecting, setSelecting] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('ltc_role') as UserRole
    if (stored && ['sales', 'solution', 'manager'].includes(stored)) {
      router.replace(ROLE_DEFAULTS[stored as NonNullable<UserRole>])
    } else {
      setChecking(false)
    }
  }, [router])

  const handleSelect = (role: NonNullable<UserRole>) => {
    setSelecting(true)
    localStorage.setItem('ltc_role', role)
    router.push(ROLE_DEFAULTS[role])
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 flex flex-col items-center justify-center px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Bot className="w-8 h-8 text-blue-500" />
          <span className="text-xl font-bold text-gray-800">云艺化 AI 原生 LTC</span>
        </div>
        <p className="text-gray-500 text-sm">你是谁？选择角色后进入默认工作台</p>
        <p className="text-gray-400 text-xs mt-1">AI 已替你完成大量分析工作，你只需做关键判断</p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl mb-8">
        {ROLE_CARDS.map((card) => (
          <button
            key={card.role}
            onClick={() => handleSelect(card.role)}
            disabled={selecting}
            className={`bg-white rounded-2xl border-2 ${card.border} p-5 text-left transition-all hover:shadow-md disabled:opacity-60 group`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${card.badge}`}>
                  {card.label}
                </span>
                <p className="text-[11px] text-gray-400 mt-1">{card.subtitle}</p>
              </div>
              <ArrowRight className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${card.color}`} />
            </div>

            <div className="mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">每天你来做什么</p>
              <ul className="space-y-1">
                {card.daily.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className={`text-[10px] font-bold mt-0.5 flex-shrink-0 ${card.color}`}>{i + 1}</span>
                    <span className="text-xs text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">AI 已替你做了什么</p>
              <ul className="space-y-1">
                {card.aiDid.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-[10px] text-blue-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-xs text-gray-500">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400">选择后将记住你的角色，下次直接进入工作台</p>
    </div>
  )
}
