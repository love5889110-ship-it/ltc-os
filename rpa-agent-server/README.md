# RPA Agent Server

LTC-OS 的专用 RPA 文件生产服务。提供 HTTP API，可生成真实的 `.pptx` / `.docx` / `.xlsx` 文件，并支持浏览器自动化查询。

## 架构

```
LTC-OS (tool-registry.ts)
    │
    │  POST /api/execute  { taskType, taskParams, callbackUrl }
    ▼
RPA Agent Server (Python FastAPI)
    │
    ├── create_pptx  → python-pptx → .pptx → /files/xxx.pptx
    ├── create_docx  → python-docx → .docx → /files/xxx.docx
    ├── create_xlsx  → openpyxl    → .xlsx → /files/xxx.xlsx
    └── browse_login → Playwright  → 提取结果 + 截图
    │
    │  POST callbackUrl  { taskExecutionId, deliverableId, fileUrl, status }
    ▼
LTC-OS /api/rpa-callback (写回 deliverables.fileUrl)
```

## 快速开始

### 1. 安装依赖

```bash
# 在专用机器上（或 Docker 容器中）
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 安装 Playwright 浏览器（仅 browse_login 需要）
playwright install chromium
```

### 2. 启动服务

```bash
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8000
```

服务启动后访问 http://localhost:8000/docs 查看完整 API 文档。

### 3. 配置 LTC-OS

在 LTC-OS 的 `.env.local` 中设置：

```
# 替换为 RPA 机器的实际 IP 或域名
RPA_SERVER_URL=http://192.168.1.100:8000
```

## API 说明

### POST /api/execute

发起任务（异步，立即返回 `taskExecutionId`）。

```json
{
  "taskType": "create_pptx",
  "taskParams": {
    "deliverableId": "uuid-from-ltc-os",
    "title": "智慧工厂 VR 安全培训方案",
    "companyName": "云艺化科技",
    "slides": [
      { "title": "项目背景", "content": "• 工厂安全事故频发\n• 传统培训效果有限" },
      { "title": "解决方案", "content": "• VR 沉浸式培训\n• 多场景模拟演练" }
    ]
  },
  "callbackUrl": "https://your-ltcos.vercel.app/api/rpa-callback"
}
```

#### taskParams 规格

**create_pptx**
| 字段 | 类型 | 说明 |
|------|------|------|
| deliverableId | string | LTC-OS deliverables 主键 |
| title | string | 方案标题 |
| companyName | string? | 公司名（封面副标题）|
| slides | array | `[{ title, content, notes? }]` content 支持换行 |

**create_docx**
| 字段 | 类型 | 说明 |
|------|------|------|
| deliverableId | string | — |
| title | string | 文档标题 |
| documentType | string? | `tender`/`contract`/`handover`/`proposal` |
| companyName | string? | — |
| sections | array | `[{ heading, body, level? }]` body 支持 Markdown |

**create_xlsx**
| 字段 | 类型 | 说明 |
|------|------|------|
| deliverableId | string | — |
| title | string | 报价单标题 |
| customerName | string | 客户名称 |
| rows | array | `[{ product, qty, unit, unitPrice, total, note? }]` |
| subtotal | number | 税前小计 |
| discountRate | number | 折扣率（0~1）|
| finalPrice | number | 最终成交价 |
| validDays | number? | 有效期（天）|
| paymentTerms | string? | 付款方式 |

**browse_login**
| 字段 | 类型 | 说明 |
|------|------|------|
| deliverableId | string | — |
| url | string | 目标 URL |
| loginSteps | array | 登录步骤，见下 |
| querySteps | array | 查询/提取步骤，见下 |
| headless | bool? | 无头模式（默认 true）|

步骤 type：`fill` / `click` / `select` / `navigate` / `wait` / `waitForSelector` / `extract`

### GET /api/tasks/{taskExecutionId}

轮询任务状态：`pending` → `running` → `completed` / `failed`

### GET /files/{filename}

直接下载生成的文件（静态文件服务）。

## 文件存储

生成的文件保存在 `./storage/` 目录，通过 `/files/` 路径对外提供 HTTP 下载。

生产部署建议：
- 将 `storage/` 挂载到对象存储（OSS/S3），用预签名 URL 替代本地静态服务
- 或用 Nginx 替代 FastAPI StaticFiles 提供文件下载

## 部署建议

```
# 使用 systemd 管理服务
[Unit]
Description=RPA Agent Server for LTC-OS
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/rpa-agent-server
ExecStart=/path/to/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 常见问题

**Q: python-pptx 和 python-docx 是否需要安装 Office/WPS？**
不需要！python-pptx 和 python-docx 是纯 Python 库，在 Linux/Mac/Windows 上均无需安装 Office 即可生成格式正确的文件。

**Q: 生成的文件能在 WPS/Office 中正常打开吗？**
是的，生成的文件是标准 OOXML 格式（.pptx/.docx/.xlsx），可直接在 WPS/Office 2010+ 中打开。

**Q: browse_login 支持哪些网站？**
理论上支持任何 Web 界面，需根据目标网站的 HTML 选择器编写 steps。默认提供通用框架，具体步骤需根据目标网站调试。
