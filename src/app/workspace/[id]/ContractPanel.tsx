'use client'

import { useState, useEffect } from 'react'
import { FileSignature, DollarSign, Plus, ChevronDown, ChevronUp, Check, AlertCircle, Clock, RefreshCw } from 'lucide-react'

interface Contract {
  id: string
  contractNo: string | null
  title: string
  status: 'draft' | 'reviewing' | 'signed' | 'executing' | 'completed' | 'terminated'
  totalAmount: number | null
  currency: string
  signedAt: string | null
  paymentTerms: string | null
}

interface Payment {
  id: string
  milestone: string
  amount: number
  percentage: number | null
  dueDate: string | null
  status: 'scheduled' | 'overdue' | 'received' | 'waived'
  receivedAmount: number | null
  receivedAt: string | null
}

const CONTRACT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:      { label: '草稿',   color: 'bg-gray-100 text-gray-600' },
  reviewing:  { label: '审核中', color: 'bg-blue-100 text-blue-700' },
  signed:     { label: '已签署', color: 'bg-green-100 text-green-700' },
  executing:  { label: '执行中', color: 'bg-indigo-100 text-indigo-700' },
  completed:  { label: '已完成', color: 'bg-emerald-100 text-emerald-700' },
  terminated: { label: '已终止', color: 'bg-red-100 text-red-700' },
}

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  scheduled: { label: '待收款', color: 'text-gray-500',  icon: Clock },
  overdue:   { label: '逾期',   color: 'text-red-600',   icon: AlertCircle },
  received:  { label: '已到账', color: 'text-green-600', icon: Check },
  waived:    { label: '已豁免', color: 'text-gray-400',  icon: Check },
}

export function ContractPanel({ workspaceId, opportunityId, customerId, currentStage }: {
  workspaceId: string
  opportunityId: string
  customerId: string
  currentStage: string | null
}) {
  const [contract, setContract] = useState<Contract | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', contractNo: '', totalAmount: '', paymentTerms: '' })
  const [submitting, setSubmitting] = useState(false)
  const [addingPayment, setAddingPayment] = useState(false)
  const [payForm, setPayForm] = useState({ milestone: '', amount: '', percentage: '', dueDate: '' })
  const [markingId, setMarkingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/contracts?workspaceId=${workspaceId}`)
    if (res.ok) {
      const data = await res.json()
      setContract(data.contract ?? null)
      setPayments(data.payments ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [workspaceId])

  const handleCreateContract = async () => {
    if (!form.title.trim()) return
    setSubmitting(true)
    await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        opportunityId,
        customerId,
        title: form.title,
        contractNo: form.contractNo || null,
        totalAmount: form.totalAmount ? parseFloat(form.totalAmount) : null,
        paymentTerms: form.paymentTerms || null,
      }),
    })
    setCreating(false)
    setForm({ title: '', contractNo: '', totalAmount: '', paymentTerms: '' })
    setSubmitting(false)
    load()
  }

  const handleAddPayment = async () => {
    if (!contract || !payForm.milestone.trim() || !payForm.amount) return
    setSubmitting(true)
    await fetch('/api/contracts/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: contract.id,
        workspaceId,
        milestone: payForm.milestone,
        amount: parseFloat(payForm.amount),
        percentage: payForm.percentage ? parseFloat(payForm.percentage) : null,
        dueDate: payForm.dueDate || null,
      }),
    })
    setAddingPayment(false)
    setPayForm({ milestone: '', amount: '', percentage: '', dueDate: '' })
    setSubmitting(false)
    load()
  }

  const handleMarkReceived = async (paymentId: string) => {
    setMarkingId(paymentId)
    await fetch('/api/contracts/payments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, action: 'mark_received' }),
    })
    setMarkingId(null)
    load()
  }

  const receivedAmount = payments.filter(p => p.status === 'received').reduce((s, p) => s + (p.receivedAmount ?? p.amount), 0)
  const totalScheduled = payments.reduce((s, p) => s + p.amount, 0)
  const progress = totalScheduled > 0 ? (receivedAmount / totalScheduled) * 100 : 0

  // 只在合同签订及之后阶段显示
  const contractStages = ['合同签订', '交付', '售后']
  if (currentStage && !contractStages.includes(currentStage)) return null

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b"
      >
        <FileSignature className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-800 flex-1">合同与回款</span>
        {contract && (
          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${CONTRACT_STATUS_LABELS[contract.status]?.color}`}>
            {CONTRACT_STATUS_LABELS[contract.status]?.label}
          </span>
        )}
        {!loading && !contract && (
          <span className="text-xs text-gray-400">未登记</span>
        )}
        {payments.length > 0 && (
          <span className="text-xs text-gray-500 ml-1">
            ¥{receivedAmount.toLocaleString()} / ¥{totalScheduled.toLocaleString()}
          </span>
        )}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-4 text-gray-400 text-xs">加载中...</div>
          ) : !contract ? (
            <>
              {!creating ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-400 mb-3">尚未登记合同</p>
                  <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-1.5 mx-auto px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5" />登记合同
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-700">登记合同</p>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="合同名称 *"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={form.contractNo}
                      onChange={e => setForm(f => ({ ...f, contractNo: e.target.value }))}
                      placeholder="合同编号"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      value={form.totalAmount}
                      onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                      placeholder="合同总额（元）"
                      type="number"
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    value={form.paymentTerms}
                    onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                    placeholder="付款条款（如：3/3/4分期）"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCreateContract} disabled={submitting || !form.title.trim()} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                      {submitting ? '提交中...' : '确认登记'}
                    </button>
                    <button onClick={() => setCreating(false)} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 合同信息 */}
              <div className="bg-indigo-50 rounded-lg px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-900">{contract.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONTRACT_STATUS_LABELS[contract.status]?.color}`}>
                    {CONTRACT_STATUS_LABELS[contract.status]?.label}
                  </span>
                </div>
                {contract.contractNo && <p className="text-xs text-indigo-600">合同号：{contract.contractNo}</p>}
                {contract.totalAmount && (
                  <p className="text-sm font-semibold text-indigo-800">¥{contract.totalAmount.toLocaleString()}</p>
                )}
                {contract.paymentTerms && <p className="text-xs text-indigo-600">付款条款：{contract.paymentTerms}</p>}
              </div>

              {/* 回款进度条 */}
              {payments.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">回款进度</span>
                    <span className="text-xs font-medium text-gray-700">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400">已到账 ¥{receivedAmount.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">合计 ¥{totalScheduled.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* 回款节点列表 */}
              {payments.length > 0 && (
                <div className="space-y-1.5">
                  {payments.map(p => {
                    const st = PAYMENT_STATUS_LABELS[p.status]
                    const Icon = st.icon
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${st.color}`} />
                        <span className="flex-1 text-gray-700">{p.milestone}</span>
                        <span className="text-gray-600 font-medium">¥{p.amount.toLocaleString()}</span>
                        {p.dueDate && (
                          <span className="text-xs text-gray-400">{new Date(p.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
                        )}
                        <span className={`text-xs ${st.color}`}>{st.label}</span>
                        {p.status === 'scheduled' && (
                          <button
                            onClick={() => handleMarkReceived(p.id)}
                            disabled={markingId === p.id}
                            className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
                          >
                            {markingId === p.id ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : '标记到账'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 添加回款节点 */}
              {!addingPayment ? (
                <button
                  onClick={() => setAddingPayment(true)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  <Plus className="w-3 h-3" />添加回款节点
                </button>
              ) : (
                <div className="border border-dashed border-indigo-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600">添加回款节点</p>
                  <input
                    value={payForm.milestone}
                    onChange={e => setPayForm(f => ({ ...f, milestone: e.target.value }))}
                    placeholder="节点名称（如：首付款30%）*"
                    className="w-full border rounded px-2.5 py-1.5 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={payForm.amount}
                      onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="金额（元）*"
                      type="number"
                      className="border rounded px-2.5 py-1.5 text-sm"
                    />
                    <input
                      value={payForm.dueDate}
                      onChange={e => setPayForm(f => ({ ...f, dueDate: e.target.value }))}
                      type="date"
                      className="border rounded px-2.5 py-1.5 text-sm text-gray-600"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddPayment} disabled={submitting || !payForm.milestone || !payForm.amount} className="flex-1 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50">
                      {submitting ? '提交中...' : '添加'}
                    </button>
                    <button onClick={() => setAddingPayment(false)} className="px-3 py-1.5 border rounded text-xs text-gray-500 hover:bg-gray-50">取消</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
