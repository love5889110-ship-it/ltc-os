"""
RPA Agent Server — FastAPI 入口
为 LTC-OS 提供文件生成和浏览器自动化能力

端口: 8000 (默认)
调用方: LTC-OS tool-registry.ts → callRpaServer()

支持的 taskType:
  - create_pptx    : 生成 .pptx 文件
  - create_docx    : 生成 .docx 文件
  - create_xlsx    : 生成 .xlsx 报价单
  - browse_login   : 浏览器自动化登录/查询
"""

import uuid
import os
import asyncio
from datetime import datetime
from typing import Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx

from tasks.create_pptx import create_pptx_task
from tasks.create_docx import create_docx_task
from tasks.create_xlsx import create_xlsx_task
from tasks.browse_login import browse_login_task

app = FastAPI(title="RPA Agent Server", version="1.0.0")

# 静态文件服务：/files/xxx.pptx 可直接下载
app.mount("/files", StaticFiles(directory="storage"), name="files")

# 内存任务状态表（生产环境可换成 Redis/SQLite）
TASKS: dict[str, dict] = {}


class ExecuteRequest(BaseModel):
    taskType: str
    taskParams: dict[str, Any]
    callbackUrl: Optional[str] = None


class ExecuteResponse(BaseModel):
    taskExecutionId: str
    status: str  # pending | running | completed | failed
    outputData: Optional[dict] = None
    fileUrl: Optional[str] = None
    error: Optional[str] = None


class TaskStatusResponse(BaseModel):
    taskExecutionId: str
    status: str
    outputFileUrl: Optional[str] = None
    outputData: Optional[dict] = None
    error: Optional[str] = None
    createdAt: str
    updatedAt: str


TASK_HANDLERS = {
    "create_pptx": create_pptx_task,
    "create_docx": create_docx_task,
    "create_xlsx": create_xlsx_task,
    "browse_login": browse_login_task,
}


async def run_task(task_id: str, task_type: str, task_params: dict, callback_url: Optional[str]):
    """后台执行任务，完成后更新状态并可选回调"""
    TASKS[task_id]["status"] = "running"
    TASKS[task_id]["updatedAt"] = datetime.now().isoformat()

    handler = TASK_HANDLERS.get(task_type)
    if not handler:
        TASKS[task_id]["status"] = "failed"
        TASKS[task_id]["error"] = f"未知任务类型: {task_type}"
        TASKS[task_id]["updatedAt"] = datetime.now().isoformat()
        return

    try:
        result = await handler(task_params)
        TASKS[task_id]["status"] = "completed"
        TASKS[task_id]["outputFileUrl"] = result.get("fileUrl")
        TASKS[task_id]["outputData"] = result.get("data")
        TASKS[task_id]["updatedAt"] = datetime.now().isoformat()

        # 主动回调 LTC-OS（如果提供了 callbackUrl）
        if callback_url:
            deliverable_id = task_params.get("deliverableId")
            # 将相对路径转换为绝对 URL，方便 LTC-OS 直接下载
            file_url = result.get("fileUrl", "")
            if file_url.startswith("/files/"):
                rpa_base_url = os.environ.get("RPA_BASE_URL", "http://localhost:8001")
                file_url = f"{rpa_base_url}{file_url}"
            payload = {
                "taskExecutionId": task_id,
                "deliverableId": deliverable_id,
                "fileUrl": file_url,
                "status": "completed",
            }
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    await client.post(callback_url, json=payload)
            except Exception as cb_err:
                print(f"[RPA] 回调失败: {cb_err}")

    except Exception as e:
        TASKS[task_id]["status"] = "failed"
        TASKS[task_id]["error"] = str(e)
        TASKS[task_id]["updatedAt"] = datetime.now().isoformat()

        if callback_url:
            try:
                deliverable_id = task_params.get("deliverableId")
                async with httpx.AsyncClient(timeout=15) as client:
                    await client.post(callback_url, json={
                        "taskExecutionId": task_id,
                        "deliverableId": deliverable_id,
                        "status": "failed",
                        "error": str(e),
                    })
            except Exception:
                pass


@app.post("/api/execute", response_model=ExecuteResponse)
async def execute_task(req: ExecuteRequest, background_tasks: BackgroundTasks):
    """
    接收 LTC-OS 的任务请求，异步执行，立即返回 taskExecutionId

    Body:
      taskType    : "create_pptx" | "create_docx" | "create_xlsx" | "browse_login"
      taskParams  : 任务参数（每种类型见下方说明）
      callbackUrl : （可选）任务完成后回调地址，e.g. https://your-app.com/api/rpa-callback

    taskParams 示例:
      create_pptx  → { deliverableId, title, slides: [{title, content, notes}] }
      create_docx  → { deliverableId, title, sections: [{heading, body}] }
      create_xlsx  → { deliverableId, title, customerName, rows: [{product,qty,unitPrice,unit,total,note}], subtotal, discountRate, finalPrice, currency, validDays }
      browse_login → { deliverableId, url, loginSteps: [{type, selector, value}], querySteps: [{type, selector}] }
    """
    if req.taskType not in TASK_HANDLERS:
        raise HTTPException(status_code=400, detail=f"不支持的任务类型: {req.taskType}")

    task_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    TASKS[task_id] = {
        "taskExecutionId": task_id,
        "taskType": req.taskType,
        "status": "pending",
        "outputFileUrl": None,
        "outputData": None,
        "error": None,
        "createdAt": now,
        "updatedAt": now,
    }

    # 后台异步执行，不阻塞响应
    background_tasks.add_task(run_task, task_id, req.taskType, req.taskParams, req.callbackUrl)

    return ExecuteResponse(
        taskExecutionId=task_id,
        status="pending",
    )


@app.get("/api/tasks/{task_execution_id}", response_model=TaskStatusResponse)
async def get_task_status(task_execution_id: str):
    """轮询任务状态"""
    task = TASKS.get(task_execution_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return TaskStatusResponse(**task)


@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.now().isoformat(), "tasks": len(TASKS)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)
