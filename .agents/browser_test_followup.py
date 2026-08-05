"""Follow-up: capture API responses, dismiss notification modal, re-test tab switching."""
import json
import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = r"D:\仓库\FunnyProjects\雏英官网\.agents"

captured: dict[str, object] = {}
issues: list[str] = []
console_errors: list[str] = []
page_errors: list[str] = []


def report(label: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {label}" + (f" | {detail}" if detail else ""))
    if not ok:
        issues.append(f"{label} | {detail}")


def on_response(resp):
    url = resp.url
    if any(k in url for k in ("/api/me/recommendations", "/api/me/notifications", "/api/me/profile", "/api/me/points")):
        try:
            captured[url.split("5173")[-1]] = resp.json()
        except Exception:
            captured[url.split("5173")[-1]] = "(non-json)"


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(30000)
        page.on("response", on_response)
        page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        page.goto(f"{BASE}/login", wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        page.locator("button", has_text=re.compile("雏英")).first.click()
        page.wait_for_url(re.compile(r"/me($|\?)"), timeout=20000)

        # Check notification modal state
        modal = page.locator('div[role="dialog"][aria-label="学习提醒"]')
        if modal.count():
            report("notification modal visible on /me", True, modal.first.inner_text()[:200].replace("\n", " | "))
            # dismiss by clicking overlay (top-left, outside modal)
            page.mouse.click(30, 30)
            page.wait_for_timeout(500)
            report("notification modal dismissed by overlay click", modal.count() == 0 or not modal.first.is_visible())
        else:
            report("notification modal visible on /me", False, "no dialog found")

        # Recommendations state
        rec_heading = page.get_by_role("heading", name=re.compile("学习推荐"))
        rec_heading.wait_for(state="visible", timeout=20000)
        sec = page.locator("section").filter(has=rec_heading)
        cards = sec.locator("article")
        n = cards.count()
        report("recommendation cards present", n > 0, f"count={n}")
        if n == 0:
            report("empty-state message", False, sec.first.inner_text().replace("\n", " | ")[:200])

        # Click first recommendation if available
        if n > 0:
            card = cards.first
            badge = card.locator("span").first.inner_text().strip()
            reason = card.locator("p").first.inner_text().strip()
            link = card.locator("a", has_text="去看看").first
            href = link.get_attribute("href") or ""
            report("first card content", True, f"badge={badge} reason={reason[:40]} href={href}")
            link.click()
            page.wait_for_url(re.compile(r"/(activities|courses)/\d+"), timeout=15000)
            page.wait_for_load_state("networkidle")
            h1 = page.locator("h1")
            body = page.inner_text("body")
            errs = [m for m in ["活动不存在或未发布", "课程不存在或未发布", "加载失败"] if m in body]
            report("detail page renders", h1.count() >= 1 and not errs, f"h1={h1.first.inner_text()[:40] if h1.count() else 'NONE'} errors={errs}")
            page.screenshot(path=f"{OUT}/shot-7-detail.png", full_page=True)
            page.goto(f"{BASE}/me", wait_until="domcontentloaded")

        # Profile tab flow
        rec_heading.wait_for(state="visible", timeout=20000)
        page.get_by_role("tab", name=re.compile("学习画像")).first.click()
        svg = page.locator('svg[aria-label="学习维度雷达图"]')
        svg.first.wait_for(state="visible", timeout=20000)
        page.wait_for_load_state("networkidle")
        report("radar svg renders", svg.count() == 1)
        svg.first.screenshot(path=f"{OUT}/shot-8-radar.png")

        # tab switching back with modal dismissed
        page.get_by_role("tab", name=re.compile("概览")).first.click()
        try:
            rec_heading.wait_for(state="visible", timeout=15000)
            report("概览 tab: content returns", True)
        except Exception as e:
            report("概览 tab: content returns", False, str(e))
        svg2 = page.locator('svg[aria-label="学习维度雷达图"]')
        report("radar hidden after switch back", svg2.count() == 0 or not svg2.first.is_visible(), f"count={svg2.count()}")
        page.screenshot(path=f"{OUT}/shot-9-back-overview.png", full_page=True)

        # switch to profile again, then back again (stability)
        page.get_by_role("tab", name=re.compile("学习画像")).first.click()
        svg.first.wait_for(state="visible", timeout=15000)
        page.get_by_role("tab", name=re.compile("概览")).first.click()
        rec_heading.wait_for(state="visible", timeout=15000)
        report("second round-trip 画像->概览 works", True)

        print("=" * 70)
        print("CAPTURED API RESPONSES:")
        for k, v in captured.items():
            print(f"  {k} -> {json.dumps(v, ensure_ascii=False)[:1000]}")
        print("PAGE ERRORS:", page_errors if page_errors else "(none)")
        print("CONSOLE ERRORS:", console_errors if console_errors else "(none)")
        print("=" * 70)
        print(f"TOTAL ISSUES: {len(issues)}")
        for it in issues:
            print("  -", it)
        browser.close()
finally:
    pass
