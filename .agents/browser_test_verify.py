"""Final verification run: eagle /me with proper async waiting for recommendation cards."""
import json
import re
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = r"D:\仓库\FunnyProjects\雏英官网\.agents"

issues: list[str] = []
page_errors: list[str] = []
captured: dict[str, str] = {}


def report(label: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {label}" + (f" | {detail}" if detail else ""))
    if not ok:
        issues.append(f"{label} | {detail}")


def overlay_count(page) -> int:
    return page.evaluate(
        "[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).position==='fixed' && d.getBoundingClientRect().width>500 && d.getBoundingClientRect().height>500).length"
    )


def dismiss_overlay(page) -> None:
    for _ in range(3):
        if overlay_count(page) > 0:
            page.mouse.click(25, 25)
            page.wait_for_timeout(400)


def on_response(resp):
    url = resp.url
    if any(k in url for k in ("/api/me/recommendations", "/api/me/notifications", "/api/me/profile")):
        try:
            captured[url.split("5173")[-1]] = resp.text()
        except Exception:
            pass


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(30000)
    page.on("response", on_response)
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.locator("button", has_text=re.compile("雏英")).first.click()
    page.wait_for_url(re.compile(r"/me($|\?)"), timeout=20000)
    page.wait_for_load_state("networkidle")

    rec_heading = page.get_by_role("heading", name=re.compile("学习推荐"))
    rec_heading.wait_for(state="visible", timeout=25000)
    sec = page.locator("section").filter(has=rec_heading)

    # Poll for cards up to 60s (DeepSeek call takes several seconds)
    cards = sec.locator("article")
    deadline = time.time() + 60
    state = None
    while time.time() < deadline:
        dismiss_overlay(page)
        if cards.count() > 0:
            state = "cards"
            break
        text = sec.first.inner_text()
        if "暂无推荐" in text:
            state = "empty"
            break
        if "加载失败" in text:
            state = "error"
            break
        page.wait_for_timeout(1000)
    report("recommendation cards render (within 60s)", state == "cards", f"state={state}")

    n = cards.count() if state == "cards" else 0
    for i in range(min(n, 6)):
        card = cards.nth(i)
        badge = card.locator("span").first.inner_text().strip()
        reason = card.locator("p").first.inner_text().strip()
        link = card.locator("a", has_text="去看看").first
        href = link.get_attribute("href") or ""
        title_els = card.locator("strong, h3, h4").count()
        ok = badge in ("活动", "课程") and bool(reason) and bool(re.match(r"^/(activities|courses)/\d+$", href))
        report(f"card {i}: badge/title/reason/去看看", ok, f"badge={badge!r} reason={reason[:44]!r} href={href!r} titleEls={title_els}")
    if n:
        page.screenshot(path=f"{OUT}/shot-31-recs.png", full_page=True)

    # click first -> detail
    if n > 0:
        first_href = cards.first.locator("a", has_text="去看看").first.get_attribute("href") or ""
        m = re.match(r"^/(activities|courses)/(\d+)$", first_href)
        report("去看看 href valid", bool(m), first_href)
        cards.first.locator("a", has_text="去看看").first.click()
        try:
            page.wait_for_url(re.compile(r"/(activities|courses)/\d+"), timeout=15000)
            report("click 去看看 -> detail page URL", True, page.url)
        except Exception as e:
            report("click 去看看 -> detail page URL", False, f"url={page.url} {str(e)[:80]}")
        page.wait_for_load_state("networkidle")
        h1 = page.locator("h1")
        body = page.inner_text("body")
        errs = [m for m in ["活动不存在或未发布", "课程不存在或未发布", "加载失败", "无效的活动编号", "无效的课程编号"] if m in body]
        report("detail page renders", h1.count() >= 1 and not errs, f"h1={h1.first.inner_text()[:40] if h1.count() else 'NONE'} errors={errs}")
        page.screenshot(path=f"{OUT}/shot-32-detail.png", full_page=True)

    # back to /me, profile tab
    page.goto(f"{BASE}/me", wait_until="domcontentloaded")
    rec_heading.wait_for(state="visible", timeout=25000)
    for _ in range(20):
        dismiss_overlay(page)
        if overlay_count(page) == 0:
            break
        page.wait_for_timeout(500)

    profile_tab = page.get_by_role("tab", name=re.compile("学习画像"))
    report("学习画像 tab exists", profile_tab.count() == 1)
    profile_tab.first.click()
    svg = page.locator('svg[aria-label="学习维度雷达图"]')
    try:
        svg.first.wait_for(state="visible", timeout=20000)
        report("radar SVG renders", True)
    except Exception as e:
        report("radar SVG renders", False, str(e)[:100])
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{OUT}/shot-33-profile.png", full_page=True)
    if svg.count():
        svg.first.screenshot(path=f"{OUT}/shot-34-radar.png")
        html = svg.first.inner_html()
        texts = re.findall(r"<text[^>]*>([^<]*)</text>", html)
        labels = [t.strip() for t in texts if not re.fullmatch(r"\d+%", t.strip())]
        values = [t.strip() for t in texts if re.fullmatch(r"\d+%", t.strip())]
        report("axes(lines) == dims", html.count("<line") == len(labels), f"lines={html.count('<line')} dims={len(labels)} labels={labels}")
        report("grid rings 25/50/75/100", len(re.findall(r'<polygon[^>]*fill="none"', html)) == 4)
        report("3 dashed rings + 1 solid", html.count("stroke-dasharray") == 3)
        report("data polygon present", len(re.findall(r'<polygon[^>]*fill="var\(--color-primary\)"', html)) == 1)
        report("vertex circles == dims", html.count("<circle") == len(labels), f"circles={html.count('<circle')}")
        report("value % labels", len(values) == len(labels), f"values={values}")

    growth = page.locator("section").filter(has=page.get_by_role("heading", name=re.compile("成长足迹")))
    report("成长足迹 section", growth.count() == 1)
    if growth.count():
        items = growth.first.locator("li")
        report("milestone events present", items.count() > 0, f"count={items.count()}")
        for i in range(min(items.count(), 8)):
            spans = [s.strip() for s in items.nth(i).locator("span").all_inner_texts()]
            has_date = any(re.search(r"\d{4}年\d{1,2}月\d{1,2}日", s) for s in spans)
            report(f"milestone {i}: event+date", has_date, f"spans={spans}")

    for label in ["总积分", "报名活动", "课程学习", "申请次数"]:
        el = page.get_by_text(label, exact=True)
        if el.count():
            val_el = el.first.locator("xpath=following-sibling::span")
            val = val_el.first.inner_text().strip() if val_el.count() else ""
            report(f"stat card '{label}'", bool(re.fullmatch(r"-?\d+", val)), f"value={val!r}")
        else:
            report(f"stat card '{label}'", False, "label not found")

    dismiss_overlay(page)
    overview_tab = page.get_by_role("tab", name=re.compile("概览"))
    try:
        overview_tab.first.click(timeout=10000)
        report("概览 tab clickable", True)
    except Exception as e:
        report("概览 tab clickable", False, f"blocked: {str(e)[:80]}")
    try:
        rec_heading.wait_for(state="visible", timeout=15000)
        report("概览 tab: 学习推荐 content returns", True)
    except Exception as e:
        report("概览 tab: 学习推荐 content returns", False, str(e)[:80])
    svg2 = page.locator('svg[aria-label="学习维度雷达图"]')
    report("radar hidden after switch back", svg2.count() == 0 or not svg2.first.is_visible())
    page.screenshot(path=f"{OUT}/shot-35-back.png", full_page=True)

    # round trip
    dismiss_overlay(page)
    try:
        page.get_by_role("tab", name=re.compile("学习画像")).first.click(timeout=10000)
        svg.first.wait_for(state="visible", timeout=15000)
        page.get_by_role("tab", name=re.compile("概览")).first.click(timeout=10000)
        rec_heading.wait_for(state="visible", timeout=15000)
        report("round-trip 画像->概览 stable", True)
    except Exception as e:
        report("round-trip 画像->概览 stable", False, str(e)[:100])

    print("=" * 70)
    print("RAW API RESPONSES:")
    for k, v in captured.items():
        print(f"--- {k} ---")
        print(v[:1000])
    print("PAGE ERRORS:", page_errors if page_errors else "(none)")
    print("=" * 70)
    print(f"TOTAL ISSUES: {len(issues)}")
    for it in issues:
        print("  -", it)
    browser.close()
