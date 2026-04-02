"""
browse_login.py — 使用 Playwright 执行浏览器自动化任务

输入 taskParams:
  deliverableId : str        — 对应 LTC-OS deliverables 表的 ID
  url           : str        — 目标页面 URL（e.g. 天眼查登录页）
  loginSteps    : list[dict] — 登录步骤序列（可选，若目标无需登录可省略）
    每步：{ type, selector, value?, waitMs? }
    type 支持: "fill" | "click" | "select" | "wait" | "waitForSelector"
  querySteps    : list[dict] — 登录后的查询/提取步骤
    type 支持: "navigate" | "fill" | "click" | "extract" | "screenshot" | "wait"
    extract 步骤: { type:"extract", selector, attribute?, name }
      → 将元素 textContent（或 attribute）提取到结果 dict 中，key = name
  screenshotOnEnd : bool (可选) — 是否在最后截图（默认 true）
  headless      : bool (可选) — 是否无头模式（默认 true）

输出:
  { fileUrl: "/files/xxx.png"（截图）, data: { ...extracted fields } }

注意：
  - 浏览器自动化依赖目标网站结构，选择器需根据实际页面调整
  - 生产使用建议在 .env / 配置文件中管理登录凭据，不要硬编码
  - playwright 需额外安装浏览器: `playwright install chromium`
"""

import os
import uuid
from typing import Any

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "..", "storage")


async def browse_login_task(task_params: dict[str, Any]) -> dict[str, Any]:
    """
    使用 Playwright 执行浏览器自动化：登录 → 查询 → 提取 → 截图
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise RuntimeError("Playwright 未安装，请执行: pip install playwright && playwright install chromium")

    os.makedirs(STORAGE_DIR, exist_ok=True)

    deliverable_id  = task_params.get("deliverableId", str(uuid.uuid4()))
    url             = task_params.get("url", "")
    login_steps     = task_params.get("loginSteps", [])
    query_steps     = task_params.get("querySteps", [])
    headless        = task_params.get("headless", True)
    screenshot_end  = task_params.get("screenshotOnEnd", True)

    extracted: dict[str, Any] = {}
    screenshot_file_url: str | None = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="zh-CN",
        )
        page = await context.new_page()

        # 导航到目标页
        if url:
            await page.goto(url, wait_until="networkidle", timeout=30000)

        # 执行登录步骤
        for step in login_steps:
            await _execute_step(page, step)

        # 等待登录完成（简单等待 2s）
        if login_steps:
            await page.wait_for_timeout(2000)

        # 执行查询/提取步骤
        for step in query_steps:
            if step.get("type") == "extract":
                name     = step.get("name", f"field_{len(extracted)}")
                selector = step.get("selector", "")
                attr     = step.get("attribute")
                try:
                    element = await page.wait_for_selector(selector, timeout=8000)
                    if element:
                        if attr:
                            value = await element.get_attribute(attr)
                        else:
                            value = await element.inner_text()
                        extracted[name] = value
                except Exception as e:
                    extracted[name] = f"[提取失败: {e}]"
            else:
                await _execute_step(page, step)

        # 截图
        if screenshot_end:
            screenshot_filename = f"{deliverable_id}-screenshot.png"
            screenshot_path = os.path.join(STORAGE_DIR, screenshot_filename)
            await page.screenshot(path=screenshot_path, full_page=False)
            screenshot_file_url = f"/files/{screenshot_filename}"

        await browser.close()

    result: dict[str, Any] = {"data": extracted}
    if screenshot_file_url:
        result["fileUrl"] = screenshot_file_url

    return result


async def _execute_step(page: Any, step: dict[str, Any]):
    """执行单个浏览器操作步骤"""
    step_type = step.get("type")
    selector  = step.get("selector", "")
    value     = step.get("value", "")
    wait_ms   = step.get("waitMs", 500)

    if step_type == "fill":
        el = await page.wait_for_selector(selector, timeout=10000)
        await el.fill(value)

    elif step_type == "click":
        el = await page.wait_for_selector(selector, timeout=10000)
        await el.click()
        await page.wait_for_timeout(wait_ms)

    elif step_type == "select":
        await page.select_option(selector, value)

    elif step_type == "navigate":
        await page.goto(value, wait_until="networkidle", timeout=30000)

    elif step_type == "wait":
        await page.wait_for_timeout(int(value) if value else wait_ms)

    elif step_type == "waitForSelector":
        await page.wait_for_selector(selector, timeout=15000)

    elif step_type == "pressEnter":
        el = await page.wait_for_selector(selector, timeout=10000)
        await el.press("Enter")
        await page.wait_for_timeout(wait_ms)

    elif step_type == "screenshot":
        # 中间截图（调试用）
        import os
        debug_path = os.path.join(STORAGE_DIR, f"debug-{step.get('name', 'step')}.png")
        await page.screenshot(path=debug_path)
