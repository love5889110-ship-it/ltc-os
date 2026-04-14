# LTC-OS — AI 原生销售经营系统

> **云艺化 · LTC 全流程自动化平台**
> 以 AI Agent 为核心，驱动从线索发现到合同回款的全链路销售经营自动化。

---

## 项目背景

LTC（Lead to Cash）是企业销售的核心价值链。传统 CRM 只是数据记录工具，而 LTC-OS 的定位是让 AI 真正"接管"销售流程中的中间层工作——让销售人员只需处理关键判断和重要对话，其余一切由 AI Agent 自动执行、协作、学习和进化。

**核心理念：**
- 人只干预关键环节（审批、纠偏、战略判断）
- AI 自动完成所有中间层工作（方案起草、任务管理、进度跟踪、风险预警）
- 系统持续从人的干预行为中学习，规则不断进化

---

## 技术架构

```
前端:   Next.js 16 (App Router) + TypeScript + Tailwind CSS
数据库: PostgreSQL (Neon 云数据库) + Drizzle ORM
AI:     MiniMax API (MiniMax-Text-01 模型)
部署:   Vercel (前端 + API Routes + Cron Jobs)
```

### 目录结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── inbox/              # AI 信号收件箱
│   ├── workspace/          # 商机作战台
│   ├── assets/             # 资产库
│   ├── evolution/          # 能力进化（纠偏工作台）
│   ├── dashboard/          # 经营快照
│   ├── intervention/       # 人工干预台（审批）
│   ├── pipeline/           # 销售流水线
│   ├── tasks/              # 任务中心
│   ├── drafts/             # 草稿中心
│   └── api/                # API Routes
├── lib/
│   ├── agent-runtime.ts    # Agent 运行时（规则+资产注入）
│   ├── executor.ts         # 动作执行引擎
│   ├── stage-engine.ts     # 阶段驱动引擎
│   ├── orchestrator.ts     # 定时巡检 + 规则建议生成
│   ├── signal-processor.ts # 信号标准化
│   ├── minimax.ts          # MiniMax API 客户端
│   └── approval-policy.ts  # 审批策略引擎
├── db/
│   └── schema.ts           # 完整数据库 Schema（25张表）
└── components/
    └── ui/                 # 共用 UI 组件（Sidebar, Breadcrumb 等）
```

---

## AI Agent 系统

系统内置 7 个专职 Agent，覆盖 LTC 全流程：

| Agent | 职责 | 触发时机 |
|-------|------|---------|
| `signal_classifier` | 信号分类与归属识别 | 新信号进入 |
| `presales_assistant` | 售前方案与竞品分析 | 商机进入售前阶段 |
| `tender_assistant` | 标书解析与投标文件生成 | 商机进入投标阶段 |
| `contract_assistant` | 合同风险审查 | 合同上传 |
| `delivery_assistant` | 交付计划与风险监控 | 项目交付阶段 |
| `collection_assistant` | 回款催收与账期管理 | 回款阶段 |
| `coordinator` | 跨 Agent 协调与风险上报 | 风险升级时 |

### Agent 运行机制

```
信号 → signal_classifier → 归属商机 → 阶段 Agent 自动触发
↓
Agent 生成动作(Actions) → 审批策略判断
↓                              ↓
auto_approve              需要人工审批 → 干预台
↓                              ↓
执行(executor)            人工修改/驳回 → FeedbackSample
↓                              ↓
execution_callback        规则建议自动生成 → 纠偏工作台
↓
下游 Agent 触发（跨 Agent 协作）
```

---

## 核心功能模块

### 1. 信号感知（Inbox）
- 手动录入信号（文字、音频转写）
- 连接器接入：钉钉群消息、企业微信（开发中）
- AI 自动分类信号类型、识别归属商机

### 2. 商机作战台（Workspace）
- 商机全生命周期管理（7 个阶段）
- 实时 Agent 状态面板
- 成果物展示（方案 PPT、标书、合同）
- 结构化风险台账
- 阶段推进触发 Agent 自动工作

### 3. 资产库（Assets）
- 6 类资产：产品手册 / 解决方案 / 客户案例 / 模板 / 话术 / 知识库
- Agent 运行时自动注入相关资产到上下文

### 4. 能力进化（Evolution）
纠偏工作台，实现 AI 持续学习：
- **纠偏样本**：人工修改/驳回的动作自动成为训练样本
- **规则建议**：Orchestrator 每日扫描样本，自动提炼规则候选
- **规则库**：人工确认后写入 `agent_rules`，对 Agent 永久生效
- **效果追踪**：规则效果量化统计

### 5. 审批干预台（Intervention）
- 待审批动作列表（按优先级排序）
- 支持：直接批准 / 修改后批准 / 驳回
- 修改意见自动写入 FeedbackSample 回流进化系统

### 6. 经营快照（Dashboard）
- 全局漏斗（线索→商机→签约→回款）
- Agent 活跃度与动作统计
- 关键指标趋势

---

## 数据库 Schema（核心表）

| 表名 | 说明 |
|------|------|
| `customers` | 客户 |
| `opportunities` | 商机（含阶段、金额、概率） |
| `workspaces` | 作战台（与商机 1:1） |
| `signals` | 信号（原始输入） |
| `agent_threads` | Agent 会话线程 |
| `agent_runs` | Agent 执行记录 |
| `agent_actions` | Agent 产生的动作（带审批状态） |
| `agent_rules` | 治理规则（注入 Agent system prompt） |
| `agent_memory` | Agent 跨会话记忆 |
| `agent_action_policies` | 审批策略（auto/approval_required/dual_approval） |
| `feedback_samples` | 纠偏样本（modified/rejected） |
| `rule_suggestions` | AI 自动生成的规则候选 |
| `assets` | 资产库 |
| `asset_usages` | 资产引用记录 |
| `drafts` | AI 起草的文档 |
| `tasks` | AI 创建的任务 |
| `deliverables` | 成果物（PPT / 文档 / 渲染图） |
| `risk_events` | 结构化风险台账 |
| `connectors` | 数据连接器配置 |

---

## 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 数据库（推荐 [Neon](https://neon.tech) 云托管）
- MiniMax API Key（[申请地址](https://api.minimax.chat)）

### 1. 克隆并安装依赖

```bash
git clone https://github.com/love5889110-ship-it/ltc-os.git
cd ltc-os
npm install
```

### 2. 配置环境变量

复制并编辑 `.env.local`：

```bash
cp .env.example .env.local
```

必填项：

```env
# 数据库（Neon 连接串格式）
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# MiniMax API
MINIMAX_API_KEY=your_minimax_api_key

# 应用 URL
NEXT_PUBLIC_APP_URL=http://localhost:3001

# 快速审批密钥（可随机生成）
QUICK_APPROVE_SECRET=your_random_secret
```

### 3. 初始化数据库

```bash
# 推送 Schema 到数据库
npx drizzle-kit push

# 写入演示种子数据（含示例商机、Agent、规则、资产）
DATABASE_URL=your_database_url npx tsx scripts/seed.ts
npx tsx scripts/seed-skills.ts
```

### 4. 启动开发服务器

```bash
# 注意：3000 端口可能被其他服务占用
PORT=3001 npm run dev
```

访问 [http://localhost:3001](http://localhost:3001)

---

## 外部数据连接器

### 钉钉群消息

1. 在钉钉开放平台创建企业内部应用
2. 在设置页面填写 AppKey / AppSecret
3. 将 Webhook 地址填入钉钉应用「消息接收 URL」
4. 或使用 Stream 长连接模式（无需公网 IP）：
   ```bash
   DINGTALK_APP_KEY=xxx DINGTALK_APP_SECRET=xxx npx tsx scripts/dingtalk-stream.ts
   ```

### 企业微信

在设置页面配置 CorpID / Token / EncodingAESKey，将 Webhook URL 填入企业微信自建应用。

---

## Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 导入项目，填写上述环境变量
3. 在 `vercel.json` 中已配置 Cron Job（每日 2:00 AM 巡检）

```json
{
  "crons": [{ "path": "/api/cron", "schedule": "0 2 * * *" }]
}
```

Cron 触发：
- 每日巡检（检查停滞商机）
- 失败动作重试
- 规则建议自动生成（扫描最近 7 天纠偏样本）

---

## 开发路线图

- [ ] 微信个人号接入（中间件模式）
- [ ] 录音文件自动转写（Whisper）
- [ ] 合同电子签章集成
- [ ] 回款催收自动化
- [ ] 移动端审批（钉钉小程序/企业微信）
- [ ] 多租户 SaaS 版本

---

## 贡献指南

欢迎提交 Issue 和 PR。关键扩展点：

- **新增 Agent**：在 `agent-runtime.ts` 注册，在`stage-engine.ts` 配置触发阶段
- **新增动作类型**：在 `schema.ts` 扩展 `actionTypeEnum`，在 `executor.ts` 添加执行函数
- **新增连接器**：在 `src/app/api/connectors/` 创建路由，在 `schema.ts` 扩展 `connectorTypeEnum`

---

## License

MIT
