'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, BookOpen, Package, FileText, Briefcase, MessageSquare, Lightbulb, X, Star, TrendingUp } from 'lucide-react'
import { PageGuide } from '@/components/ui/page-guide'

type AssetType = 'product' | 'solution' | 'case' | 'template' | 'script' | 'knowledge'

interface Asset {
  id: string
  assetType: AssetType
  title: string
  summary: string | null
  fullContent: string | null
  tags: string[]
  industries: string[]
  stages: string[]
  usageCount: number
  qualityScore: number
  status: string
  createdAt: string
}

const TYPE_CONFIG: Record<AssetType, { label: string; icon: React.ReactNode; color: string }> = {
  product: { label: '产品', icon: <Package className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  solution: { label: '方案', icon: <Briefcase className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700' },
  case: { label: '案例', icon: <Star className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  template: { label: '模板', icon: <FileText className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  script: { label: '话术', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-pink-100 text-pink-700' },
  knowledge: { label: '知识', icon: <Lightbulb className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-700' },
}

const STAGES = ['需求挖掘', '方案设计', '招投标', '商务谈判', '合同签订', '交付', '售后']

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<AssetType | ''>('')
  const [keyword, setKeyword] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newAsset, setNewAsset] = useState({
    assetType: 'product' as AssetType,
    title: '',
    summary: '',
    fullContent: '',
    tags: '',
    industries: '',
    stages: [] as string[],
  })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedType) params.set('type', selectedType)
    if (keyword) params.set('keyword', keyword)
    const res = await fetch(`/api/assets?${params}`)
    if (res.ok) {
      const data = await res.json()
      setAssets(data.assets ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedType])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  const handleCreate = async () => {
    if (!newAsset.title) return
    setSaving(true)
    await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newAsset,
        tags: newAsset.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean),
        industries: newAsset.industries.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      }),
    })
    setSaving(false)
    setShowCreate(false)
    setNewAsset({ assetType: 'product', title: '', summary: '', fullContent: '', tags: '', industries: '', stages: [] })
    load()
  }

  const handleArchive = async (id: string) => {
    await fetch(`/api/assets/${id}`, {
      method: 'DELETE',
    })
    setSelectedAsset(null)
    load()
  }

  const handleRate = async (id: string, current: number, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qualityScore: Math.min(current + 0.1, 1.0) }),
    })
    load()
  }

  const typeStats = Object.keys(TYPE_CONFIG).map((type) => ({
    type: type as AssetType,
    count: assets.filter((a) => a.assetType === type).length,
  }))

  return (
    <div className="h-full flex">
      {/* Left sidebar */}
      <div className="w-48 flex-shrink-0 bg-white border-r flex flex-col">
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm">资产库</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">数字员工的素材记忆</p>
        </div>

        <nav className="py-2 flex-1">
          <button
            onClick={() => setSelectedType('')}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm ${
              selectedType === '' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>全部资产</span>
            <span className="text-xs text-gray-400">{assets.length}</span>
          </button>
          {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
            <button
              key={type}
              onClick={() => setSelectedType(type as AssetType)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm ${
                selectedType === type ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {cfg.icon}
                <span>{cfg.label}</span>
              </div>
              <span className="text-xs text-gray-400">
                {typeStats.find(s => s.type === type)?.count ?? 0}
              </span>
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            新增资产
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="bg-white border-b px-6 py-3">
          <form onSubmit={handleSearch} className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索资产标题或摘要..."
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
              搜索
            </button>
          </form>
        </div>

        {/* Asset list */}
        <div className="flex-1 overflow-auto p-6">
          <PageGuide
            role="解方经理 / 全员"
            what="AI 数字员工的「记忆库」：产品资料、成功案例、竞品话术、方案模板、招投标资质清单"
            firstStep="左侧选择「竞品话术」或「成功案例」，找到和当前商机行业匹配的内容，查看后可反馈质量"
            storageKey="assets"
          />
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">加载中...</div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <BookOpen className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">暂无资产</p>
              <p className="text-xs mt-1">点击左下角"新增资产"开始建立资产库</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {assets.map((asset) => {
                const cfg = TYPE_CONFIG[asset.assetType]
                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset)}
                    className="bg-white rounded-xl border hover:border-blue-300 hover:shadow-sm cursor-pointer p-4 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${cfg.color}`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <TrendingUp className="w-3 h-3" />
                            <span>用了 {asset.usageCount} 次</span>
                          </div>
                        </div>
                        <h3 className="text-sm font-medium text-gray-800 line-clamp-1">{asset.title}</h3>
                        {asset.summary && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{asset.summary}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(asset.stages as string[]).slice(0, 3).map((s) => (
                            <span key={s} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {s}
                            </span>
                          ))}
                          {(asset.tags as string[]).slice(0, 2).map((t) => (
                            <span key={t} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">质量分 {(asset.qualityScore * 100).toFixed(0)}</span>
                          <button
                            onClick={(e) => handleRate(asset.id, asset.qualityScore, e)}
                            className="text-xs text-green-600 bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded flex items-center gap-1"
                          >
                            👍 有用
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Asset detail drawer */}
      {selectedAsset && (
        <div className="w-96 flex-shrink-0 bg-white border-l flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_CONFIG[selectedAsset.assetType].color}`}>
                {TYPE_CONFIG[selectedAsset.assetType].label}
              </span>
              <span className="text-sm font-medium truncate max-w-[200px]">{selectedAsset.title}</span>
            </div>
            <button onClick={() => setSelectedAsset(null)}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
            {selectedAsset.summary && (
              <div>
                <p className="text-xs text-gray-400 mb-1">摘要</p>
                <p className="text-sm text-gray-700">{selectedAsset.summary}</p>
              </div>
            )}
            {selectedAsset.fullContent ? (
              <div>
                <p className="text-xs text-gray-400 mb-1">完整内容</p>
                <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                  {selectedAsset.fullContent}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic">暂无完整内容</div>
            )}
            {(selectedAsset.stages as string[]).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">适用阶段</p>
                <div className="flex flex-wrap gap-1">
                  {(selectedAsset.stages as string[]).map((s) => (
                    <span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {(selectedAsset.industries as string[]).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">适用行业</p>
                <div className="flex flex-wrap gap-1">
                  {(selectedAsset.industries as string[]).map((s) => (
                    <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {(selectedAsset.tags as string[]).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">标签</p>
                <div className="flex flex-wrap gap-1">
                  {(selectedAsset.tags as string[]).map((t) => (
                    <span key={t} className="text-xs border border-gray-200 text-gray-600 px-2 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-gray-400">
              使用次数：{selectedAsset.usageCount} &nbsp;·&nbsp;
              质量分：{(selectedAsset.qualityScore * 100).toFixed(0)}
            </div>
          </div>
          <div className="px-4 py-3 border-t flex gap-2">
            <button
              onClick={() => handleArchive(selectedAsset.id)}
              className="flex-1 py-2 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
            >
              归档
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[560px] max-h-[80vh] overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base">新增资产</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">资产类型</label>
                <select
                  value={newAsset.assetType}
                  onChange={(e) => setNewAsset((v) => ({ ...v, assetType: e.target.value as AssetType }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                    <option key={type} value={type}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">标题 *</label>
                <input
                  value={newAsset.title}
                  onChange={(e) => setNewAsset((v) => ({ ...v, title: e.target.value }))}
                  placeholder="资产名称"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">摘要</label>
                <input
                  value={newAsset.summary}
                  onChange={(e) => setNewAsset((v) => ({ ...v, summary: e.target.value }))}
                  placeholder="一句话描述"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">完整内容（Markdown）</label>
                <textarea
                  value={newAsset.fullContent}
                  onChange={(e) => setNewAsset((v) => ({ ...v, fullContent: e.target.value }))}
                  placeholder="产品详情、方案内容、话术脚本等..."
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">适用阶段</label>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((s) => (
                    <label key={s} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAsset.stages.includes(s)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewAsset((v) => ({ ...v, stages: [...v.stages, s] }))
                          } else {
                            setNewAsset((v) => ({ ...v, stages: v.stages.filter((x) => x !== s) }))
                          }
                        }}
                        className="w-3 h-3"
                      />
                      <span className="text-xs text-gray-600">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">行业（逗号分隔）</label>
                <input
                  value={newAsset.industries}
                  onChange={(e) => setNewAsset((v) => ({ ...v, industries: e.target.value }))}
                  placeholder="金融, 制造, 零售"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">标签（逗号分隔）</label>
                <input
                  value={newAsset.tags}
                  onChange={(e) => setNewAsset((v) => ({ ...v, tags: e.target.value }))}
                  placeholder="云服务, SaaS, 定制化"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newAsset.title || saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存资产'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
