"""Diagnostic: identify the overlay that blocks clicks on /me, capture raw API bodies."""
import json
import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = r"D:\仓库\FunnyProjects\雏英官网\.agents"
captured: dict[str, str] = {}

summary: list[str] = []


def on_response(resp):
    url = resp.url
    if any(k in url for k in ("/api/me/recommendations", "/api/me/notifications", "/api/me/profile")):
        try:
            captured[url.split("5173")[-1]] = resp.text()
        except Exception:
            pass


def js(page, expr):
    return page.evaluate(expr)


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(30000)
        page.on("response", on_response)

        page.goto(f"{BASE}/login", wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        page.locator("button", has_text=re.compile("雏英")).first.click()
        page.wait_for_url(re.compile(r"/me($|\?)"), timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)

        summary.append("=== AFTER LOGIN ===")
        summary.append("overlays: " + str(js(page, "[...document.querySelectorAll('[class*=overlay]')].map(e=>e.className)")))
        summary.append("dialogs: " + str(js(page, "[...document.querySelectorAll('[role=dialog]')].map(e=>e.outerHTML.slice(0,200))")))

        # click profile tab
        tab = page.get_by_role("tab", name=re.compile("学习画像"))
        summary.append("profile tab count: " + str(tab.count()))
        tab.first.click()
        svg = page.locator('svg[aria-label="学习维度雷达图"]')
        svg.first.wait_for(state="visible", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)

        summary.append("=== AFTER PROFILE TAB ===")
        summary.append("overlays: " + str(js(page, "[...document.querySelectorAll('[class*=overlay]')].map(e=>({cls:e.className, html:e.outerHTML.slice(0,400)}))")))
        summary.append("dialogs: " + str(js(page, "[...document.querySelectorAll('[role=dialog]')].map(e=>e.outerHTML.slice(0,600))")))
        page.screenshot(path=f"{OUT}/shot-10-overlay.png", full_page=True)

        # try clicking overview tab via keyboard-independent dispatch to see if overlay is really modal-blocking
        try:
            page.get_by_role("tab", name=re.compile("概览")).first.click(timeout=8000)
            summary.append("overview tab click: SUCCESS")
        except Exception as e:
            summary.append(f"overview tab click: BLOCKED ({str(e)[:120]})")

        print("\n".join(summary))
        print("=" * 70)
        print("RAW API RESPONSES:")
        for k, v in captured.items():
            print(f"--- {k} ---")
            print(v[:1200])
finally:
    print("done")
