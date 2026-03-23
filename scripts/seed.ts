import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { db } from '../src/db'
import {
  customers,
  contacts,
  opportunities,
  connectorInstances,
  opportunityWorkspaces,
  agentThreads,
  signalEvents,
  signalBindings,
  agentRules,
  assets,
  feedbackSamples,
} from '../src/db/schema'
import { generateId } from '../src/lib/utils'
import { eq } from 'drizzle-orm'

async function seed() {
  console.log('🌱 开始写入种子数据（工业VR安全培训行业）...')

  // ── 客户（均为工业企业，符合VR安全培训目标行业）────────────────────────
  const customerData = [
    { id: generateId(), name: '大同煤矿集团', industry: '煤炭/采矿', region: '华北' },
    { id: generateId(), name: '国家电网华中分公司', industry: '电力', region: '华中' },
    { id: generateId(), name: '中石化炼化工程', industry: '石油化工', region: '华东' },
    { id: generateId(), name: '宝武钢铁武汉基地', industry: '钢铁/制造', region: '华中' },
    { id: generateId(), name: '郑州铝业股份', industry: '有色金属/制造', region: '华中' },
  ]
  await db.insert(customers).values(customerData).onConflictDoNothing()
  console.log('✅ 客户数据写入完成')

  // ── 联系人（安全总监、生产副总等真实决策链角色）─────────────────────────
  const contactData = [
    { id: generateId(), customerId: customerData[0].id, name: '赵国强', role: '安全总监', phone: '13812340001' },
    { id: generateId(), customerId: customerData[0].id, name: '刘建军', role: '培训处处长', phone: '13812340002' },
    { id: generateId(), customerId: customerData[1].id, name: '王志远', role: '生产副总', phone: '13812340003' },
    { id: generateId(), customerId: customerData[2].id, name: '陈海涛', role: '安全环保部部长', phone: '13812340004' },
    { id: generateId(), customerId: customerData[3].id, name: '李铸铁', role: '安全生产总监', phone: '13812340005' },
  ]
  await db.insert(contacts).values(contactData).onConflictDoNothing()
  console.log('✅ 联系人数据写入完成')

  // ── 商机（真实VR安全培训场景）────────────────────────────────────────────
  const oppData = [
    {
      id: generateId(),
      customerId: customerData[0].id,
      name: '大同煤矿井下采掘VR安全培训系统',
      stage: '供应商入库',
      amount: 1280000,
      ownerUserId: 'user_001',
      status: 'active' as const,
    },
    {
      id: generateId(),
      customerId: customerData[1].id,
      name: '国家电网变电站高压作业VR培训',
      stage: '招标',
      amount: 2450000,
      ownerUserId: 'user_001',
      status: 'active' as const,
    },
    {
      id: generateId(),
      customerId: customerData[2].id,
      name: '中石化炼化装置操作VR安全培训',
      stage: '需求解决方案',
      amount: 980000,
      ownerUserId: 'user_002',
      status: 'active' as const,
    },
    {
      id: generateId(),
      customerId: customerData[3].id,
      name: '宝武钢铁高炉作业安全VR培训系统',
      stage: '真实需求分析',
      amount: 1650000,
      ownerUserId: 'user_002',
      status: 'active' as const,
    },
    {
      id: generateId(),
      customerId: customerData[4].id,
      name: '郑州铝业电解槽操作安全培训VR',
      stage: '立项及预算申请',
      amount: 760000,
      ownerUserId: 'user_001',
      status: 'active' as const,
    },
  ]
  await db.insert(opportunities).values(oppData).onConflictDoNothing()
  console.log('✅ 商机数据写入完成')

  // ── 连接器 ────────────────────────────────────────────────────────────────
  const connectorData = [
    { id: generateId(), connectorType: 'get_note' as const, connectorName: 'Get 笔记', authStatus: 'authorized' as const, healthStatus: 'healthy' as const, enabled: true },
    { id: generateId(), connectorType: 'recording' as const, connectorName: '录音转写', authStatus: 'authorized' as const, healthStatus: 'healthy' as const, enabled: true },
    { id: generateId(), connectorType: 'dingtalk' as const, connectorName: '钉钉', authStatus: 'pending' as const, healthStatus: 'down' as const, enabled: false },
    { id: generateId(), connectorType: 'file_ocr' as const, connectorName: '文件/OCR', authStatus: 'authorized' as const, healthStatus: 'healthy' as const, enabled: true },
  ]
  await db.insert(connectorInstances).values(connectorData).onConflictDoNothing()
  console.log('✅ 连接器数据写入完成')

  // ── 重新查询真实商机 ID ─────────────────────────────────────────────────
  const realOpps = await db.select().from(opportunities)

  // ── Workspace + Agent Threads ─────────────────────────────────────────────
  const AGENT_TYPES = ['sales_copilot', 'presales_assistant', 'tender_assistant', 'commercial', 'handover', 'service_triage', 'asset_governance'] as const

  const wsConfigs = [
    { keyword: '大同煤矿', health: 68, risk: 42, block: 25, stage: '供应商入库' },
    { keyword: '国家电网', health: 82, risk: 28, block: 15, stage: '招标' },
    { keyword: '中石化', health: 71, risk: 22, block: 10, stage: '需求解决方案' },
    { keyword: '宝武钢铁', health: 55, risk: 58, block: 35, stage: '真实需求分析' },
    { keyword: '郑州铝业', health: 88, risk: 12, block: 5, stage: '立项及预算申请' },
  ]

  const workspaceIds: string[] = []
  for (const cfg of wsConfigs) {
    const opp = realOpps.find((o) => o.name.includes(cfg.keyword))
    if (!opp) continue

    const existing = await db.query.opportunityWorkspaces.findFirst({
      where: eq(opportunityWorkspaces.opportunityId, opp.id),
    })
    if (existing) {
      workspaceIds.push(existing.id)
      continue
    }

    const wsId = generateId()
    await db.insert(opportunityWorkspaces).values({
      id: wsId,
      opportunityId: opp.id,
      workspaceStatus: 'active',
      currentStage: cfg.stage,
      healthScore: cfg.health,
      riskScore: cfg.risk,
      blockScore: cfg.block,
    })
    workspaceIds.push(wsId)

    for (const agentType of AGENT_TYPES) {
      await db.insert(agentThreads).values({
        id: generateId(),
        workspaceId: wsId,
        agentType,
        threadStatus: 'idle',
      }).onConflictDoNothing()
    }
  }
  console.log(`✅ 战场数据写入完成（${workspaceIds.length} 个）`)

  // ── 演示信号（真实行业场景，来自渠道/销售录音）──────────────────────────
  const datongOpp = realOpps.find((o) => o.name.includes('大同煤矿'))
  const sgccOpp = realOpps.find((o) => o.name.includes('国家电网'))
  const sinopecOpp = realOpps.find((o) => o.name.includes('中石化'))
  const baosteelOpp = realOpps.find((o) => o.name.includes('宝武钢铁'))
  const aluminumOpp = realOpps.find((o) => o.name.includes('郑州铝业'))

  const signalSeeds = [
    {
      id: generateId(),
      sourceType: 'get_note' as const,
      rawContent: `【录音标题】大同煤矿渠道拜访记录

今日与华北渠道李总拜访大同煤矿集团安全总监赵国强。赵总监反馈：他们今年发生了两起井下作业安全事故，矿业局要求年底前完成新员工安全培训体系升级。目前在比较我司方案和竞品幻威的方案，幻威已经做过现场演示，报价比我们低约18%。赵总监比较关注系统能否覆盖采掘、支护、运输三个核心场景，希望我们能提供同行业（煤矿）的成功案例。

【标签】渠道拜访、竞品对比、安全事故背景`,
      contentSummary: '大同煤矿：有安全事故背景推动力，竞品幻威已演示且报价低18%，需煤矿行业案例',
      signalType: 'risk' as const,
      priority: 5,
      status: 'pending_confirm' as const,
      confidenceScore: 0.92,
      oppId: datongOpp?.id,
      entities: { customerNames: ['大同煤矿集团'], personNames: ['赵国强', '李总'], keywords: ['幻威', '竞品', '报价', '采掘', '支护', '运输'] },
    },
    {
      id: generateId(),
      sourceType: 'recording' as const,
      rawContent: `【录音标题】国家电网招标文件解读会

国家电网华中分公司招标文件已于昨日发布，招标截止时间为本月28日（距今9天）。技术要求中有一条"投标方须具备电力行业安全生产许可证及高压作业VR培训系统验收证书"，我司目前只有前者，高压验收证书在办理中。此外，文件要求提供3个电力行业实施案例（合同金额≥50万），我司只有2个满足要求的案例。这两点风险需要立即处理。`,
      contentSummary: '国家电网招标：9天截止，缺高压验收证书+案例数量不足，存在废标风险',
      signalType: 'risk' as const,
      priority: 5,
      status: 'bound' as const,
      confidenceScore: 0.97,
      oppId: sgccOpp?.id,
      entities: { customerNames: ['国家电网华中分公司'], personNames: [], keywords: ['招标截止', '验收证书', '案例不足', '废标风险'] },
    },
    {
      id: generateId(),
      sourceType: 'get_note' as const,
      rawContent: `【录音标题】中石化需求调研会记录

与中石化炼化工程安环部陈海涛部长完成需求调研。核心需求：炼化装置操作规程培训，覆盖常减压、催化裂化、加氢精制三套装置，年培训人次约800人。他们关心的是：1）VR场景与实际装置的还原精度；2）是否支持移动端（iPad）操作，因为现场没有PC机；3）是否支持离线使用（炼化区域信号差）。目前没有其他竞品在跟，但他们预算在80-100万之间，低于我们的初步报价120万，需要我们在方案上做取舍。`,
      contentSummary: '中石化：三套炼化装置场景，需移动端+离线支持，预算80-100万低于报价120万',
      signalType: 'demand' as const,
      priority: 4,
      status: 'pending_confirm' as const,
      confidenceScore: 0.88,
      oppId: sinopecOpp?.id,
      entities: { customerNames: ['中石化炼化工程'], personNames: ['陈海涛'], keywords: ['炼化装置', '移动端', '离线', '预算缺口'] },
    },
    {
      id: generateId(),
      sourceType: 'get_note' as const,
      rawContent: `【录音标题】宝武钢铁拜访风险预警

今日宝武钢铁武汉基地拜访，发现几个严重风险信号：1）原来的内部推动人李铸铁总监刚刚调任其他部门，新接手的是副总监张雷，我们和张雷没有任何沟通；2）竞品合肥黑云智能的销售已经拜访过两次，并在上次会议中做了演示；3）客户现在关注重点转向了"政府补贴能否覆盖费用"，说明内部预算可能有压力。这个项目有失控风险，需要尽快安排高层拜访重建关系。`,
      contentSummary: '宝武钢铁：关键推动人换人，竞品黑云已演示两次，决策链断裂高风险',
      signalType: 'risk' as const,
      priority: 5,
      status: 'pending_confirm' as const,
      confidenceScore: 0.94,
      oppId: baosteelOpp?.id,
      entities: { customerNames: ['宝武钢铁武汉基地'], personNames: ['李铸铁', '张雷'], keywords: ['关键人换人', '黑云', '竞品', '决策链', '政府补贴'] },
    },
    {
      id: generateId(),
      sourceType: 'manual' as const,
      rawContent: `郑州铝业渠道王经理反馈：郑州铝业安全部已完成内部立项申请，预算76万已获批，目前正在走供应商入库流程。王经理说客户对我们印象不错，但需要我们尽快提交入库申请材料，包括营业执照、软件著作权证书、安全生产培训机构资质证书。已初步确认下周三可以签框架协议。`,
      contentSummary: '郑州铝业：预算76万已批，入库材料需尽快提交，下周三有望签框架协议',
      signalType: 'opportunity' as const,
      priority: 4,
      status: 'pending_confirm' as const,
      confidenceScore: 0.85,
      oppId: aluminumOpp?.id,
      entities: { customerNames: ['郑州铝业股份'], personNames: ['王经理'], keywords: ['立项已批', '入库申请', '框架协议', '软件著作权'] },
    },
  ]

  for (const sig of signalSeeds) {
    await db.insert(signalEvents).values({
      id: sig.id,
      sourceType: sig.sourceType,
      rawContent: sig.rawContent,
      normalizedContent: sig.rawContent,
      contentSummary: sig.contentSummary,
      eventTime: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000),
      signalType: sig.signalType,
      priority: sig.priority,
      confidenceScore: sig.confidenceScore,
      parsedEntitiesJson: sig.entities,
      status: sig.status,
    }).onConflictDoNothing()

    if (sig.oppId) {
      await db.insert(signalBindings).values({
        id: generateId(),
        signalEventId: sig.id,
        opportunityId: sig.oppId,
        bindingStatus: sig.status === 'bound' ? 'auto_bound' : 'candidate',
        bindingConfidence: sig.confidenceScore,
        bindingCandidatesJson: [{ type: 'opportunity', id: sig.oppId, confidence: sig.confidenceScore }],
      }).onConflictDoNothing()
    }
  }
  console.log('✅ 演示信号写入完成')

  // ── 演示规则（针对工业VR安全培训场景）────────────────────────────────────
  const ruleSeeds = [
    {
      id: generateId(),
      agentType: 'sales_copilot' as const,
      ruleType: 'require' as const,
      condition: '信号中出现竞品名称（幻威、万特、黑云、小七、五朵云、博晟、安邦）',
      instruction: '必须生成 risk_alert 判断，severity 不低于4，并建议针对该竞品的差异化应对策略',
      createdFrom: 'manual',
      enabled: true,
    },
    {
      id: generateId(),
      agentType: 'sales_copilot' as const,
      ruleType: 'forbid' as const,
      condition: '商机处于真实需求分析阶段',
      instruction: '禁止建议发送报价单，必须先完成需求调研（确认场景类型、培训人数、硬件部署条件）再推进方案',
      createdFrom: 'manual',
      enabled: true,
    },
    {
      id: generateId(),
      agentType: 'tender_assistant' as const,
      ruleType: 'require' as const,
      condition: '处于招标阶段时',
      instruction: '必须检查：①软件著作权证书 ②安全生产培训机构资质 ③行业案例数量是否满足要求，不满足立即发出 risk_alert（severity:5）',
      createdFrom: 'manual',
      enabled: true,
    },
    {
      id: generateId(),
      agentType: 'sales_copilot' as const,
      ruleType: 'require' as const,
      condition: '信号中提到关键决策人发生变化',
      instruction: '必须发出 risk_alert（severity:4）并建议立即安排高层拜访重建关系，同时创建任务跟进',
      createdFrom: 'manual',
      enabled: true,
    },
    {
      id: generateId(),
      agentType: 'commercial' as const,
      ruleType: 'prefer' as const,
      condition: '客户提出价格压力时',
      instruction: '优先建议增加服务价值替代降价（如增加培训场景数量、延长质保期、提供专属客户成功服务），而非直接降低报价',
      createdFrom: 'manual',
      enabled: true,
    },
    {
      id: generateId(),
      agentType: 'presales_assistant' as const,
      ruleType: 'require' as const,
      condition: '客户行业为电力时',
      instruction: '方案必须包含与幻威、万特电气的差异化对比分析，突出我方在场景深度还原和本地化服务上的优势',
      createdFrom: 'manual',
      enabled: true,
    },
  ]
  await db.insert(agentRules).values(ruleSeeds).onConflictDoNothing()
  console.log('✅ 演示规则写入完成')

  // ── 资产库（工业VR安全培训行业专属）─────────────────────────────────────
  const assetSeeds = [
    {
      id: generateId(),
      assetType: 'product' as const,
      title: 'SafeVR 工业安全培训系统 v2.5',
      summary: '面向煤矿、电力、化工、钢铁等高危行业的沉浸式VR安全培训平台，覆盖30+工业场景',
      fullContent: `## 产品概述
SafeVR 工业安全培训系统是专为高危工业行业设计的沉浸式VR安全培训解决方案，通过高精度还原真实作业场景，让员工在零风险的虚拟环境中完成高危操作培训。

## 覆盖行业与场景
- **煤矿**：井下采掘作业、支护操作、瓦斯检测、矿井提升、应急逃生
- **电力**：高压配电操作、变电站巡检、高空线路作业、触电应急处置
- **化工/石油**：炼化装置操作、危险化学品处置、动火作业安全
- **钢铁/制造**：高炉作业、行车操作、焊接安全、机械伤害预防

## 核心技术优势
- **场景还原精度**：基于激光扫描建模，设备还原精度达95%以上
- **多端支持**：VR头显（Pico/Quest）+ PC端 + iPad移动端，支持离线使用
- **考核系统**：内置操作步骤自动评分、违规行为实时识别
- **数据管理**：培训记录、合格率、薄弱点分析自动报表

## 已服务客户（部分）
山西焦煤集团、华能集团、中海油惠州炼化、马钢集团等50+工业企业`,
      tags: ['VR培训', '工业安全', '多端支持', '离线使用'],
      industries: ['煤矿', '电力', '化工', '钢铁'],
      stages: ['需求解决方案', '供应商入库', '招标', '投标'],
      status: 'active' as const,
    },
    {
      id: generateId(),
      assetType: 'case' as const,
      title: '山西焦煤集团井下安全VR培训实施案例',
      summary: '为山西焦煤旗下3座矿井实施VR安全培训系统，覆盖2000名员工，事故率下降47%',
      fullContent: `## 客户背景
山西焦煤集团是国内最大的炼焦煤生产企业之一，旗下矿井分布山西多地，每年新员工入职培训是安全管理核心工作。

## 业务挑战
1. 传统安全培训以课堂讲解+视频为主，员工缺乏实操体验，考核合格率仅68%
2. 实际下井体验培训成本高、安全隐患大，特别是新员工第一次下井事故风险极高
3. 培训记录依靠纸质档案，无法有效追踪每位员工的薄弱环节

## 解决方案
- 部署4套VR培训工作站（含采掘、支护、运输、应急4个核心场景）
- iPad移动端补充用于班前安全确认培训
- 与集团HR系统打通，自动同步培训记录

## 实施结果
- 新员工安全考核合格率从68%提升至94%
- 年内工伤事故数量同比下降47%
- 传统安全培训成本节约约60万元/年
- 项目规模：128万元，2023年6月验收

## 客户评价
"用VR让工人在下井前先'死'一次，真的管用。" —— 安全副矿长 王建国`,
      tags: ['煤矿案例', '安全培训', '事故率下降'],
      industries: ['煤矿'],
      stages: ['需求解决方案', '招标', '投标'],
      status: 'active' as const,
    },
    {
      id: generateId(),
      assetType: 'case' as const,
      title: '华能集团变电站VR培训案例',
      summary: '为华能集团5个供电局部署高压作业VR培训系统，通过电力行业资质认证，合同金额340万',
      fullContent: `## 客户背景
华能集团是国内五大发电集团之一，供电局员工高压作业安全培训是年度合规必选项目。

## 核心挑战
- 高压作业实训环境搭建成本极高（每套设备造价50万+）
- 传统培训无法模拟真实故障场景（如断路器跳闸、绝缘损坏）
- 监管部门要求培训记录可溯源、可审计

## 解决方案亮点
- 完整还原10kV/35kV/110kV三个电压等级的变电站场景
- 包含"违章操作"模拟场景，让学员体验事故后果
- 系统通过南网/国网安全认证，培训记录符合监管要求

## 项目成果
- 5个供电局统一部署，覆盖培训人员1200人
- 高压操作考核通过率从72%提升至97%
- 合同金额：340万元，分两期实施

## 与幻威/万特的差异化
- 我方场景还原精度更高（基于激光扫描）
- 支持国网/南网双标准认证（幻威仅支持南网标准）
- 本地化服务团队响应时间≤4小时（竞品平均48小时）`,
      tags: ['电力案例', '变电站', '高压作业', '竞品对比'],
      industries: ['电力'],
      stages: ['需求解决方案', '招标', '投标'],
      status: 'active' as const,
    },
    {
      id: generateId(),
      assetType: 'solution' as const,
      title: '工业VR安全培训整体方案（标准版）',
      summary: '适用于中大型工业企业的VR安全培训系统整体实施方案，含需求调研、场景定制、验收标准',
      fullContent: `## 方案适用场景
年培训人次500-5000人，需要覆盖3-10个核心作业场景的工业企业。

## 标准交付范围
### 第一阶段：需求与设计（4周）
- 作业场景现场调研与三维扫描
- 培训目标与考核标准确认
- 场景交互逻辑设计评审

### 第二阶段：开发与测试（8-12周）
- VR场景开发（每个场景约3-4周）
- 考核系统集成
- 客户内测与反馈修改

### 第三阶段：部署与培训（2周）
- 硬件设备部署与调试
- 管理员操作培训
- 员工首轮培训上线

## 验收标准
- 场景还原与实际设备误差＜5%
- 系统稳定运行无崩溃（72小时压测）
- 培训管理平台数据导出正常

## 需求调研核心清单
1. 培训人数及场景类型（采掘/配电/炼化等）
2. 硬件条件（是否有防爆要求/网络条件/场地）
3. 是否需要移动端/离线支持
4. 与HR系统对接需求
5. 监管合规要求（是否需要特定资质证书）`,
      tags: ['整体方案', '实施方案', '需求调研'],
      industries: ['煤矿', '电力', '化工', '钢铁'],
      stages: ['真实需求分析', '需求解决方案'],
      status: 'active' as const,
    },
    {
      id: generateId(),
      assetType: 'script' as const,
      title: '竞品幻威/万特应对话术',
      summary: '当客户对比幻威或万特时，突出我方差异化优势的标准话术',
      fullContent: `## 场景：客户说"幻威已经演示过，报价比你们低"

**核心策略：不打价格战，打价值战**

**话术一：场景还原精度**
"幻威的方案我们了解过，他们的VR场景是通用模型，不是基于贵公司设备实际扫描建模的。
我们会专门对贵公司的[具体设备名]做激光扫描，还原精度在95%以上。
培训的核心价值是让员工对自己要操作的真实设备有肌肉记忆——用仿真设备训练，到了真实现场还是会陌生。
这个差距在出事故的时候就会体现出来。"

**话术二：认证资质**
"关于电力行业，我们的系统同时拥有国网和南网的安全认证，
幻威目前只有南网标准认证。如果贵公司有国网监管要求，这一点需要提前确认。"

**话术三：本地化服务**
"幻威在华北的服务团队只有3人，覆盖整个华北区。我们在贵公司所在城市有驻场工程师，
承诺4小时内响应，幻威平均响应时间是2个工作日。上线后设备出故障，
培训中断1天的损失比价格差距要大得多。"

**话术四：TCO分析**
"我们帮您算一个TCO（5年总拥有成本）：幻威初始价格低15%，但每年维保费是我们的1.5倍，
加上每次内容更新需要重新付费。5年算下来，我们的总成本其实更低。我们可以做一张对比表给您。"`,
      tags: ['竞品对比', '幻威', '万特', '话术'],
      industries: ['煤矿', '电力'],
      stages: ['需求解决方案', '招标', '投标', '决策'],
      status: 'active' as const,
    },
    {
      id: generateId(),
      assetType: 'knowledge' as const,
      title: '工业VR项目投标资质清单',
      summary: '参与煤矿/电力/化工行业VR安全培训招标所需的完整资质清单及办理说明',
      fullContent: `## 通用资质（所有行业必须）
- [ ] 营业执照（经营范围含"软件开发"或"教育培训"）
- [ ] 软件著作权证书（VR培训系统相关）
- [ ] ISO 9001 质量管理体系认证
- [ ] 近3年无重大违法记录证明

## 煤矿行业专项资质
- [ ] 煤矿安全培训机构资质证书（需向省级煤矿安全监察局申请）
- [ ] 矿山安全生产标准化相关证明
- [ ] 煤炭行业信息化产品推荐目录（加分项）

## 电力行业专项资质
- [ ] 承装（修、试）电力设施许可证（视项目内容）
- [ ] 电力安全生产培训机构资质
- [ ] 国网/南网安全技术认证（建议两个都办）
- [ ] 近3年电力行业实施案例（合同额≥50万，需盖章）

## 化工行业专项资质
- [ ] 危险化学品从业单位安全生产标准化证书（适用）
- [ ] 特种设备作业培训资质（如涉及压力容器）

## 重要提示
1. 资质有效期：每年年审时提前2个月启动续期
2. 软件著作权：VR软件每次重大版本更新建议重新申请
3. 行业案例：整理3份以上，含合同、验收报告、客户盖章证明`,
      tags: ['招投标', '资质清单', '合规'],
      industries: ['煤矿', '电力', '化工'],
      stages: ['供应商入库', '招标', '投标'],
      status: 'active' as const,
    },
  ]

  await db.insert(assets).values(assetSeeds).onConflictDoNothing()
  console.log(`✅ 资产库数据写入完成（${assetSeeds.length} 条）`)

  // ── 进化反馈样本（让 few-shot 从第一天起就能工作）──────────────────────
  const firstWsId = workspaceIds[0]
  const secondWsId = workspaceIds[1]
  const feedbackSeeds = [
    {
      id: generateId(),
      sourceType: 'action_feedback',
      sourceObjectId: 'demo_001',
      agentType: 'sales_copilot' as const,
      workspaceId: firstWsId ?? null,
      originalOutputJson: {
        action: 'send_draft',
        title: '竞品应对邮件草稿',
        description: '发送一封介绍我们产品优势的通用邮件',
      },
      correctedOutputJson: {
        action: 'send_draft',
        title: '幻威竞品对比邮件 - 大同煤矿',
        description: '针对幻威报价低18%的情况，重点突出场景还原精度、4小时本地服务响应、以及5年TCO更低三点差异化',
      },
      feedbackLabel: 'modified' as const,
      feedbackReasonCode: 'too_generic',
      reusableFlag: true,
    },
    {
      id: generateId(),
      sourceType: 'action_feedback',
      sourceObjectId: 'demo_002',
      agentType: 'tender_assistant' as const,
      workspaceId: secondWsId ?? null,
      originalOutputJson: {
        action: 'create_task',
        title: '准备招标材料',
        description: '整理投标所需文件',
      },
      correctedOutputJson: null,
      feedbackLabel: 'rejected' as const,
      feedbackReasonCode: 'missing_key_info',
      reusableFlag: true,
    },
    {
      id: generateId(),
      sourceType: 'action_feedback',
      sourceObjectId: 'demo_003',
      agentType: 'sales_copilot' as const,
      workspaceId: firstWsId ?? null,
      originalOutputJson: {
        action: 'create_task',
        title: '安排高层拜访',
        description: '关键决策人变更，需立即安排高层拜访重建关系，本周内完成，优先级5',
      },
      correctedOutputJson: {
        action: 'create_task',
        title: '安排高层拜访',
        description: '关键决策人变更，需立即安排高层拜访重建关系，本周内完成，优先级5',
      },
      feedbackLabel: 'accepted' as const,
      feedbackReasonCode: null,
      reusableFlag: true,
    },
  ]
  await db.insert(feedbackSamples).values(feedbackSeeds).onConflictDoNothing()
  console.log(`✅ 进化反馈样本写入完成（${feedbackSeeds.length} 条）`)

  console.log('\n🎉 工业VR安全培训行业种子数据写入完成！')
  console.log(`  客户: ${customerData.length} 条（煤矿/电力/化工/钢铁/有色金属）`)
  console.log(`  联系人: ${contactData.length} 条（安全总监/生产副总/安环部长）`)
  console.log(`  商机: ${oppData.length} 条（各行业VR培训项目）`)
  console.log(`  战场: ${workspaceIds.length} 个`)
  console.log(`  演示信号: ${signalSeeds.length} 条（渠道反馈/录音/风险预警）`)
  console.log(`  演示规则: ${ruleSeeds.length} 条（含竞品预警/资质检查规则）`)
  console.log(`  资产库: ${assetSeeds.length} 条（含幻威对比话术/行业案例）`)
  console.log(`  反馈样本: ${feedbackSeeds.length} 条（accepted/modified/rejected 各类型）`)
}

seed().catch(console.error).finally(() => process.exit(0))
