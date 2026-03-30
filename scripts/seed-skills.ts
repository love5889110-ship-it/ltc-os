/**
 * 预置技能库种子数据
 * 覆盖商机全过程（需求挖掘→方案设计→招投标→商务谈判→合同签订→交付→售后）
 *
 * 运行方式：
 * DATABASE_URL=... npx tsx scripts/seed-skills.ts
 *
 * 注意：重复运行会跳过已存在的 id，不会报错
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { db } from '../src/db'
import { skillTemplates, agentSkills } from '../src/db/schema'
import { eq } from 'drizzle-orm'

// 内部 API 基础 URL（仅用于记录 executionConfig，不在 seed 时真实调用）
const INTERNAL_BASE = '/api/internal'

interface SkillPreset {
  id: string
  name: string
  description: string
  category: string
  toolSource: 'builtin' | 'http'
  skillSpecJson: Record<string, unknown>
  executionConfigJson: Record<string, unknown>
  agentBindings: Array<{ agentType: string; id: string }>
}

const PRESET_SKILLS: SkillPreset[] = [
  // ─── 阶段一：需求挖掘（sales / coordinator） ──────────────────────────────

  {
    id: 'preset-001',
    name: '企业工商信息查询',
    description: '通过天眼查公开页面查询目标企业基本工商信息（注册资本、法人、成立年份、经营状态）',
    category: 'data',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'query_company_info',
      displayName: '企业工商信息查询',
      description: '查询目标企业工商注册信息',
      inputSchema: {
        type: 'object',
        properties: {
          companyName: { type: 'string', description: '企业全称或关键词', example: '大同煤矿集团' },
          instruction: { type: 'string', description: '需要重点提取的信息', example: '注册资本和法人代表' },
        },
        required: ['companyName'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'web.browse',
      urlTemplate: 'https://www.tianyancha.com/cloud-app/search?key={companyName}',
      instructionTemplate: '提取：注册资本、法人代表、成立时间、经营状态、主要产品或业务。{instruction}',
    },
    agentBindings: [
      { agentType: 'sales', id: 'preset-as-001' },
      { agentType: 'coordinator', id: 'preset-as-002' },
    ],
  },

  {
    id: 'preset-002',
    name: '客户官网内容浏览',
    description: '自动访问客户官网，提取公司简介、主营业务、最新新闻和联系方式',
    category: 'browse',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'browse_customer_website',
      displayName: '客户官网内容浏览',
      description: '浏览并提取客户官网关键信息',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '客户官网地址', example: 'https://www.datongcoal.com' },
          instruction: { type: 'string', description: '重点关注的信息', example: '公司最新业务动向和采购计划' },
        },
        required: ['url'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'web.browse',
      instructionTemplate: '提取：公司主营业务、最新动态、技术需求方向、联系方式。{instruction}',
    },
    agentBindings: [
      { agentType: 'sales', id: 'preset-as-003' },
    ],
  },

  {
    id: 'preset-003',
    name: '竞品官网卖点与价格浏览',
    description: '自动访问竞争对手官网，提取产品卖点、技术参数和定价策略',
    category: 'browse',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'browse_competitor_website',
      displayName: '竞品官网卖点与价格浏览',
      description: '浏览竞品官网，收集竞争情报',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '竞品官网地址', example: 'https://www.competitor.com/products' },
          instruction: { type: 'string', description: '重点关注哪些竞争维度', example: '价格区间和客户案例' },
        },
        required: ['url'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'web.browse',
      instructionTemplate: '提取：产品/服务核心卖点、价格区间、客户案例、技术优势。{instruction}',
    },
    agentBindings: [
      { agentType: 'sales', id: 'preset-as-004' },
      { agentType: 'presales_assistant', id: 'preset-as-005' },
    ],
  },

  {
    id: 'preset-004',
    name: '招标公告搜索',
    description: '在中国招标投标公共服务平台搜索目标行业/企业的最新招标公告',
    category: 'browse',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'search_tender_announcements',
      displayName: '招标公告搜索',
      description: '搜索目标行业或企业的最新招标公告',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词（公司名/行业/项目类型）', example: 'VR安全培训 煤矿' },
          instruction: { type: 'string', description: '额外说明', example: '重点关注预算金额和截止日期' },
        },
        required: ['keyword'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'web.browse',
      urlTemplate: 'https://search.ccgp.gov.cn/bxsearch?searchtype=1&bidSort=0&pinMu=0&bidType=0&dbselect=bidx&kw={keyword}',
      instructionTemplate: '列出最新的招标公告，提取：项目名称、招标单位、预算金额、截止日期。{instruction}',
    },
    agentBindings: [
      { agentType: 'sales', id: 'preset-as-006' },
      { agentType: 'tender_assistant', id: 'preset-as-007' },
    ],
  },

  // ─── 阶段二：方案设计（presales_assistant） ───────────────────────────────

  {
    id: 'preset-005',
    name: '生成方案 PPT 大纲',
    description: '根据商机背景自动生成客户定制化方案 PPT 大纲，含结构建议和关键卖点',
    category: 'document',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'generate_proposal_ppt',
      displayName: '生成方案 PPT 大纲',
      description: '生成定制化解决方案 PPT 大纲',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'PPT 标题', example: 'VR安全培训解决方案' },
          topic: { type: 'string', description: '核心内容/需求背景', example: '煤矿安全培训降低事故率' },
          workspaceId: { type: 'string', description: '商机工作区 ID（自动填入）' },
        },
        required: ['title', 'topic'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'document.create_ppt',
    },
    agentBindings: [
      { agentType: 'presales_assistant', id: 'preset-as-008' },
      { agentType: 'sales', id: 'preset-as-009' },
    ],
  },

  {
    id: 'preset-006',
    name: '行业标准与合规要求查询',
    description: '查询目标行业的安全标准、资质要求、合规规范（GB/行标/部门规章）',
    category: 'browse',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'query_industry_standards',
      displayName: '行业标准与合规要求查询',
      description: '查询行业安全标准和合规要求',
      inputSchema: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: '行业名称', example: '煤矿/电力/化工' },
          standardType: { type: 'string', description: '标准类型', example: '安全培训/VR设备/资质要求' },
        },
        required: ['industry'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'web.browse',
      urlTemplate: 'https://r.jina.ai/https://www.nrsis.org.cn/search?kw={industry}+{standardType}+标准',
      instructionTemplate: '提取相关安全标准编号、主要要求、执行日期。',
    },
    agentBindings: [
      { agentType: 'presales_assistant', id: 'preset-as-010' },
      { agentType: 'tender_assistant', id: 'preset-as-011' },
    ],
  },

  {
    id: 'preset-007',
    name: '生成竞争对比分析报告',
    description: '基于商机背景，AI 生成我方产品与主要竞争对手的对比分析文档',
    category: 'document',
    toolSource: 'http',
    skillSpecJson: {
      name: 'generate_competitive_analysis',
      displayName: '生成竞争对比分析报告',
      description: '生成与竞品的详细对比分析',
      inputSchema: {
        type: 'object',
        properties: {
          competitors: { type: 'string', description: '主要竞争对手（逗号分隔）', example: '海康威视,大华股份' },
          dimensions: { type: 'string', description: '对比维度', example: '价格/功能/服务/案例' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['competitors'],
      },
    },
    executionConfigJson: {
      type: 'http',
      apiUrl: `${INTERNAL_BASE}/generate-doc`,
      httpMethod: 'POST',
      bodyTemplate: {
        prompt: '生成竞争对比分析报告。竞争对手：{competitors}。对比维度：{dimensions}。请用表格+文字结合的方式，突出我方优势。',
        workspaceId: '{workspaceId}',
        outputType: 'draft',
        draftType: 'proposal_section',
        title: '竞品对比分析',
      },
    },
    agentBindings: [
      { agentType: 'presales_assistant', id: 'preset-as-012' },
    ],
  },

  {
    id: 'preset-008',
    name: '生成个性化方案摘要',
    description: '结合客户行业特点和商机阶段，生成 200-400 字的个性化解决方案摘要',
    category: 'document',
    toolSource: 'http',
    skillSpecJson: {
      name: 'generate_proposal_summary',
      displayName: '生成个性化方案摘要',
      description: '生成针对客户的方案核心价值摘要',
      inputSchema: {
        type: 'object',
        properties: {
          customerPainPoint: { type: 'string', description: '客户核心痛点', example: '工人安全培训效率低、事故率高' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['customerPainPoint'],
      },
    },
    executionConfigJson: {
      type: 'http',
      apiUrl: `${INTERNAL_BASE}/generate-doc`,
      httpMethod: 'POST',
      bodyTemplate: {
        prompt: '为客户生成个性化解决方案摘要。客户核心痛点：{customerPainPoint}。要求：突出痛点->方案->价值的逻辑，200-400字。',
        workspaceId: '{workspaceId}',
        outputType: 'text',
      },
    },
    agentBindings: [
      { agentType: 'presales_assistant', id: 'preset-as-013' },
      { agentType: 'sales', id: 'preset-as-014' },
    ],
  },

  // ─── 阶段三：招投标（tender_assistant） ─────────────────────────────────

  {
    id: 'preset-009',
    name: '招标文件关键信息提取',
    description: '从招标文件文本中自动提取：项目要求、资质条件、评分标准、截止日期',
    category: 'data',
    toolSource: 'http',
    skillSpecJson: {
      name: 'extract_tender_info',
      displayName: '招标文件关键信息提取',
      description: '提取招标文件中的关键信息',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '招标文件内容（粘贴文本）' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['content'],
      },
    },
    executionConfigJson: {
      type: 'http',
      apiUrl: `${INTERNAL_BASE}/analyze-doc`,
      httpMethod: 'POST',
      bodyTemplate: {
        content: '{content}',
        extractFields: ['项目名称', '采购单位', '预算金额', '资质要求', '技术要求', '评分标准', '截止日期', '联系方式'],
        workspaceId: '{workspaceId}',
      },
    },
    agentBindings: [
      { agentType: 'tender_assistant', id: 'preset-as-015' },
    ],
  },

  {
    id: 'preset-010',
    name: '供应商资质公开信息核查',
    description: '在企业信用信息公示系统查询竞争对手的资质证书、违规记录',
    category: 'data',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'check_vendor_qualification',
      displayName: '供应商资质核查',
      description: '查询供应商/竞争对手资质证书和信用记录',
      inputSchema: {
        type: 'object',
        properties: {
          companyName: { type: 'string', description: '企业名称', example: '某某科技有限公司' },
        },
        required: ['companyName'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'web.browse',
      urlTemplate: 'https://www.gsxt.gov.cn/corp-query-search-hit.html?keyword={companyName}',
      instructionTemplate: '提取：企业信用状态、行政处罚记录、资质证书、经营异常情况。',
    },
    agentBindings: [
      { agentType: 'tender_assistant', id: 'preset-as-016' },
      { agentType: 'coordinator', id: 'preset-as-017' },
    ],
  },

  {
    id: 'preset-011',
    name: '生成投标响应文件大纲',
    description: '根据招标要求生成标准化投标响应文件框架，含技术方案和商务响应',
    category: 'document',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'generate_bid_response',
      displayName: '生成投标响应文件大纲',
      description: '生成投标响应文件框架和关键内容',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '投标项目名称', example: '2025年VR安全培训系统采购投标书' },
          topic: { type: 'string', description: '招标核心要求', example: '煤矿安全VR培训，预算50万，需煤安证' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['title', 'topic'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'document.create_ppt',
    },
    agentBindings: [
      { agentType: 'tender_assistant', id: 'preset-as-018' },
    ],
  },

  // ─── 阶段四：商务谈判（sales） ──────────────────────────────────────────

  {
    id: 'preset-012',
    name: '竞品近期动态监控',
    description: '搜索竞争对手近期新闻、融资动态、新产品发布、客户案例',
    category: 'browse',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'monitor_competitor_news',
      displayName: '竞品近期动态监控',
      description: '监控竞争对手最新动态和市场信息',
      inputSchema: {
        type: 'object',
        properties: {
          competitor: { type: 'string', description: '竞争对手名称', example: '海康威视' },
          instruction: { type: 'string', description: '重点关注哪类信息', example: '最新融资和大客户案例' },
        },
        required: ['competitor'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'web.browse',
      urlTemplate: 'https://r.jina.ai/https://www.baidu.com/s?rn=20&wd={competitor}+最新+2025',
      instructionTemplate: '提取最近3个月内的新闻：融资动态、新产品、大客户合同、价格调整。{instruction}',
    },
    agentBindings: [
      { agentType: 'sales', id: 'preset-as-019' },
    ],
  },

  {
    id: 'preset-013',
    name: '生成谈判策略备忘录',
    description: '基于商机现状和竞争格局，AI 生成谈判关键策略和应对建议',
    category: 'document',
    toolSource: 'http',
    skillSpecJson: {
      name: 'generate_negotiation_memo',
      displayName: '生成谈判策略备忘录',
      description: '生成商务谈判策略和关键应对点',
      inputSchema: {
        type: 'object',
        properties: {
          situation: { type: 'string', description: '当前谈判态势（对方诉求/压价情况/竞品威胁）', example: '客户要求降价15%，竞品海康报价低于我方20%' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['situation'],
      },
    },
    executionConfigJson: {
      type: 'http',
      apiUrl: `${INTERNAL_BASE}/generate-doc`,
      httpMethod: 'POST',
      bodyTemplate: {
        prompt: '基于以下谈判态势，生成商务谈判策略备忘录：{situation}。包含：核心策略、价格底线分析、竞品应对话术、让步边界建议。',
        workspaceId: '{workspaceId}',
        outputType: 'draft',
        draftType: 'report',
        title: '谈判策略备忘',
      },
    },
    agentBindings: [
      { agentType: 'sales', id: 'preset-as-020' },
    ],
  },

  {
    id: 'preset-014',
    name: '发送微信跟进通知',
    description: '向客户联系人或内部同事发送企业微信消息（需配置企业微信连接器）',
    category: 'communicate',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'send_wecom_followup',
      displayName: '发送微信跟进通知',
      description: '通过企业微信发送跟进消息',
      inputSchema: {
        type: 'object',
        properties: {
          touser: { type: 'string', description: '接收人 userid', example: 'zhangsan' },
          content: { type: 'string', description: '消息内容', example: '您好，关于合作项目...' },
        },
        required: ['touser', 'content'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'wecom.send_message',
    },
    agentBindings: [
      { agentType: 'sales', id: 'preset-as-021' },
    ],
  },

  // ─── 阶段五：合同签订（sales / handover） ────────────────────────────────

  {
    id: 'preset-015',
    name: '合同关键条款提取',
    description: '从合同文本中提取：付款条款、交付周期、违约责任、验收标准',
    category: 'data',
    toolSource: 'http',
    skillSpecJson: {
      name: 'extract_contract_terms',
      displayName: '合同关键条款提取',
      description: '提取合同中的关键商务和法律条款',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '合同文本内容（粘贴）' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['content'],
      },
    },
    executionConfigJson: {
      type: 'http',
      apiUrl: `${INTERNAL_BASE}/analyze-doc`,
      httpMethod: 'POST',
      bodyTemplate: {
        content: '{content}',
        extractFields: ['合同金额', '付款方式', '交付周期', '验收标准', '违约责任', '保密条款', '争议解决方式'],
        workspaceId: '{workspaceId}',
      },
    },
    agentBindings: [
      { agentType: 'sales', id: 'preset-as-022' },
      { agentType: 'handover', id: 'preset-as-023' },
    ],
  },

  {
    id: 'preset-016',
    name: '发送钉钉签约通知',
    description: '向内部项目群发送合同签订通知（需配置钉钉连接器）',
    category: 'communicate',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'send_dingtalk_contract_notice',
      displayName: '发送钉钉签约通知',
      description: '通过钉钉群通知合同签订进度',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '通知内容', example: '【合同签订】大同煤矿VR项目合同已签订，合同金额XX万元...' },
        },
        required: ['content'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'dingtalk.send_message',
    },
    agentBindings: [
      { agentType: 'handover', id: 'preset-as-024' },
      { agentType: 'sales', id: 'preset-as-025' },
    ],
  },

  // ─── 阶段六：交付（handover） ────────────────────────────────────────────

  {
    id: 'preset-017',
    name: '生成交付验收报告',
    description: '基于项目交付情况生成标准验收报告草稿，含交付清单、测试结果、遗留问题',
    category: 'document',
    toolSource: 'http',
    skillSpecJson: {
      name: 'generate_delivery_report',
      displayName: '生成交付验收报告',
      description: '生成项目交付验收报告',
      inputSchema: {
        type: 'object',
        properties: {
          deliveryItems: { type: 'string', description: '已交付内容（逗号分隔）', example: 'VR设备10套,培训系统部署,人员培训' },
          issues: { type: 'string', description: '遗留问题（可选）', example: '部分场景内容待优化' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['deliveryItems'],
      },
    },
    executionConfigJson: {
      type: 'http',
      apiUrl: `${INTERNAL_BASE}/generate-doc`,
      httpMethod: 'POST',
      bodyTemplate: {
        prompt: '生成项目交付验收报告。已交付内容：{deliveryItems}。遗留问题：{issues}。包含：交付物清单、验收结论、遗留问题处理计划。',
        workspaceId: '{workspaceId}',
        outputType: 'draft',
        draftType: 'report',
        title: '交付验收报告',
      },
    },
    agentBindings: [
      { agentType: 'handover', id: 'preset-as-026' },
    ],
  },

  // ─── 阶段七：售后（service_triage） ─────────────────────────────────────

  {
    id: 'preset-018',
    name: '生成客户回访话术',
    description: '基于客户使用情况和满意度，生成个性化回访话术和问题清单',
    category: 'document',
    toolSource: 'http',
    skillSpecJson: {
      name: 'generate_followup_script',
      displayName: '生成客户回访话术',
      description: '生成售后回访话术和满意度调研问题',
      inputSchema: {
        type: 'object',
        properties: {
          usageDuration: { type: 'string', description: '客户使用时长', example: '3个月' },
          knownIssues: { type: 'string', description: '已知问题点', example: '部分VR场景加载慢' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['usageDuration'],
      },
    },
    executionConfigJson: {
      type: 'http',
      apiUrl: `${INTERNAL_BASE}/generate-doc`,
      httpMethod: 'POST',
      bodyTemplate: {
        prompt: '生成客户售后回访话术。客户使用时长：{usageDuration}。已知问题：{knownIssues}。包含：开场白、使用情况了解、问题收集、续约/增购探测、结束语。',
        workspaceId: '{workspaceId}',
        outputType: 'text',
      },
    },
    agentBindings: [
      { agentType: 'service_triage', id: 'preset-as-027' },
    ],
  },

  {
    id: 'preset-019',
    name: '竞品续约风险监控',
    description: '搜索竞争对手在目标客户行业的最新动态，识别可能影响续约的威胁信号',
    category: 'browse',
    toolSource: 'builtin',
    skillSpecJson: {
      name: 'monitor_renewal_risk',
      displayName: '竞品续约风险监控',
      description: '监控竞品动态，识别续约威胁',
      inputSchema: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: '客户行业', example: '煤矿安全' },
          competitor: { type: 'string', description: '主要竞争对手', example: '海康威视' },
        },
        required: ['industry'],
      },
    },
    executionConfigJson: {
      type: 'builtin',
      toolId: 'web.browse',
      urlTemplate: 'https://r.jina.ai/https://www.baidu.com/s?wd={competitor}+{industry}+合作+2025',
      instructionTemplate: '提取竞争对手在该行业的最新合作案例、价格策略、市场推广动态。',
    },
    agentBindings: [
      { agentType: 'service_triage', id: 'preset-as-028' },
    ],
  },

  {
    id: 'preset-020',
    name: '生成商机阶段总结报告',
    description: '基于商机全程数据，生成阶段性总结报告（适合汇报和复盘）',
    category: 'document',
    toolSource: 'http',
    skillSpecJson: {
      name: 'generate_stage_summary',
      displayName: '生成商机阶段总结报告',
      description: '生成商机推进阶段性总结',
      inputSchema: {
        type: 'object',
        properties: {
          stage: { type: 'string', description: '当前阶段', example: '方案设计' },
          keyProgress: { type: 'string', description: '本阶段关键进展', example: '完成需求调研，提交方案初稿' },
          nextSteps: { type: 'string', description: '下阶段计划', example: '方案评审，竞争对手分析' },
          workspaceId: { type: 'string', description: '商机工作区 ID' },
        },
        required: ['stage', 'keyProgress'],
      },
    },
    executionConfigJson: {
      type: 'http',
      apiUrl: `${INTERNAL_BASE}/generate-doc`,
      httpMethod: 'POST',
      bodyTemplate: {
        prompt: '生成商机{stage}阶段总结报告。关键进展：{keyProgress}。下阶段计划：{nextSteps}。包含：阶段成果、风险点、下阶段行动计划。',
        workspaceId: '{workspaceId}',
        outputType: 'draft',
        draftType: 'report',
        title: '{stage}阶段总结',
      },
    },
    agentBindings: [
      { agentType: 'coordinator', id: 'preset-as-029' },
      { agentType: 'sales', id: 'preset-as-030' },
    ],
  },
]

async function seedSkills() {
  console.log('🎯 开始写入预置技能库（商机全过程）...\n')

  let templateCount = 0
  let skillCount = 0
  let skippedCount = 0

  for (const preset of PRESET_SKILLS) {
    // 检查是否已存在
    const existing = await db.query.skillTemplates.findFirst({
      where: eq(skillTemplates.id, preset.id),
    })

    if (existing) {
      console.log(`  ⏭  跳过（已存在）：${preset.name}`)
      skippedCount++
    } else {
      await db.insert(skillTemplates).values({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        category: preset.category,
        toolSource: preset.toolSource,
        skillSpecJson: preset.skillSpecJson as any,
        executionConfigJson: preset.executionConfigJson as any,
        sourceSandboxId: null,
        enabled: true,
      })
      templateCount++
      console.log(`  ✅ 写入技能：${preset.name}`)
    }

    // 写入 agentSkills（绑定到对应 Agent）
    for (const binding of preset.agentBindings) {
      const existingSkill = await db.query.agentSkills.findFirst({
        where: eq(agentSkills.id, binding.id),
      })

      if (!existingSkill) {
        await db.insert(agentSkills).values({
          id: binding.id,
          agentType: binding.agentType as any,
          toolId: preset.id,
          skillTemplateId: preset.id,
          enabled: true,
          config: null,
          defaultParamsJson: null,
        })
        skillCount++
      }
    }
  }

  console.log(`\n✅ 预置技能库写入完成！`)
  console.log(`   技能模板：${templateCount} 条新增，${skippedCount} 条已存在`)
  console.log(`   Agent 绑定：${skillCount} 条新增`)
  console.log(`\n阶段覆盖：需求挖掘 → 方案设计 → 招投标 → 商务谈判 → 合同签订 → 交付 → 售后`)
}

seedSkills()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ 写入失败：', e)
    process.exit(1)
  })
