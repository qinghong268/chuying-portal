"""Final: verify weekly report per-user AI summary content."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1900})
    page.goto("http://localhost:5173/login", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(800)
    inputs = page.locator("input")
    inputs.nth(0).fill("super@demo")
    inputs.nth(1).fill("Demo1234!")
    page.locator("button[type='submit'], form button").first.click()
    page.wait_for_timeout(2500)
    page.goto("http://localhost:5173/admin/weekly-reports", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)
    body = page.locator("body").inner_text()
    print("--- page head ---")
    print(body[:800])
    # expand first week
    btn = page.locator("button:text-is('查看详情')").first
    if btn.count():
        btn.click()
        page.wait_for_timeout(800)
    body = page.locator("body").inner_text()
    print("--- expanded body (weekly section) ---")
    idx = body.find("已生成的周报")
    print(body[idx:idx+2500] if idx >= 0 else body[800:3300])
    browser.close()
