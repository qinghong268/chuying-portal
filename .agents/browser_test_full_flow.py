"""Full-flow browser test: create eligible activity as admin, then run eagle /me checklist.

Phase 0: demo-login as 管理员, POST /api/admin/activities (published, future, not enrolled)
Phase 1: demo-login as 雏英, walk the /me checklist:
  - 学习推荐 cards (badge/reason/link), click -> detail page
  - 学习画像 tab: radar SVG (axes/rings/data polygon), milestones, stat cards
  - switch back to 概览
"""
import json
import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = r"D:\仓库\FunnyProjects\雏英官网\.agents"

issues: list[str] = []
page_errors: list[str] = []
console_errors: list[str] = []
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
    if overlay_count(page) > 0:
        page.mouse.click(25, 25)
        page.wait_for_timeout(500)


def on_response(resp):
    url = resp.url
    if any(k in url for k in ("/api/me/recommendations", "/api/me/notifications", "/api/me/profile")):
        try:
            captured[url.split("5173")[-1]] = resp.text()
        except Exception:
            pass


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.set_default_timeout(25000)
    page.on("response", on_response)
    page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    # ---------- Phase 0: admin creates an eligible published activity ----------
    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.locator("button", has_text=re.compile("管理员")).first.click()
    page.wait_for_url(re.compile(r"/admin"), timeout=20000)
    page.wait_for_load_state("networkidle")

    now = __import__("time").time() * 1000
    activity_id = None
    try:
        result = page.evaluate(
            """async (payload) => {
                const res = await fetch('/api/admin/activities', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload),
                });
                const body = await res.json();
                return { status: res.status, body };
            }""",
            {
                "title": f"BT-推荐测试活动-{int(now)}",
                "description": "Browser test activity for AI recommendation flow.",
                "mode": "online",
                "startAt": int(now + 2 * 86400_000),
                "endAt": int(now + 9 * 86400_000),
                "pointApplyDeadline": int(now + 8 * 86400_000),
                "targetPoints": 10,
                "status": "published",
            },
        )
        report("admin creates published future activity", result["status"] == 201, f"status={result['status']} body={json.dumps(result['body'], ensure_ascii=False)[:200]}")
        if result["status"] == 201:
            activity_id = result["body"]["activity"]["id"]
    except Exception as e:
        report("admin creates published future activity", False, str(e)[:150])

    # ---------- Phase 1: eagle flow ----------
    ctx.clear_cookies()
    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    eagle_btn = page.locator("button", has_text=re.compile("雏英"))
    report("login page shows 雏英 demo-login", eagle_btn.count() == 1)
    eagle_btn.first.click()
    page.wait_for_url(re.compile(r"/me($|\?)"), timeout=20000)
    report("demo-login redirects to /me", True, page.url)
    page.wait_for_load_state("networkidle")

    # notification modal may appear late: poll-dismiss
    for _ in range(25):
        dismiss_overlay(page)
        if page.get_by_role("tab").count() >= 2 and overlay_count(page) == 0:
            break
        page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/shot-21-login-me.png", full_page=True)

    # ---------- 学习推荐 ----------
    rec_heading = page.get_by_role("heading", name=re.compile("学习推荐"))
    rec_heading.wait_for(state="visible", timeout=25000)
    sec = page.locator("section").filter(has=rec_heading)
    cards = sec.locator("article")
    n = cards.count()
    report("recommendation cards render", n > 0, f"count={n}")
    if n == 0:
        report("empty-state message", False, sec.first.inner_text().replace("\n", " | ")[:160])

    # cards content
    for i in range(min(n, 6)):
        card = cards.nth(i)
        badge = card.locator("span").first.inner_text().strip()
        reason = card.locator("p").first.inner_text().strip()
        link = card.locator("a", has_text="去看看").first
        href = link.get_attribute("href") or ""
        title_els = card.locator("strong, h3, h4").count()
        ok = badge in ("活动", "课程") and bool(reason) and bool(re.match(r"^/(activities|courses)/\d+$", href))
        report(f"card {i}: badge/title/reason/去看看", ok, f"badge={badge!r} reason={reason[:44]!r} href={href!r} titleEls={title_els}")

    # click first -> detail
    if n > 0:
        first_href = cards.first.locator("a", has_text="去看看").first.get_attribute("href") or ""
        m = re.match(r"^/(activities|courses)/(\d+)$", first_href)
        report("去看看 href valid", bool(m), first_href)
        cards.first.locator("a", has_text="去看看").first.click()
        try:
            page.wait_for_url(re.compile(r"/(activities|courses)/\d+"), timeout=15000)
            report("click 去看看 navigates to detail page", True, page.url)
        except Exception as e:
            report("click 去看看 navigates to detail page", False, f"url={page.url} {str(e)[:100]}")
        page.wait_for_load_state("networkidle")
        h1 = page.locator("h1")
        body = page.inner_text("body")
        errs = [m for m in ["活动不存在或未发布", "课程不存在或未发布", "加载失败", "无效的活动编号", "无效的课程编号"] if m in body]
        report("detail page renders", h1.count() >= 1 and not errs, f"h1={h1.first.inner_text()[:40] if h1.count() else 'NONE'} errors={errs}")
        page.screenshot(path=f"{OUT}/shot-22-detail.png", full_page=True)

    # back to /me
    page.goto(f"{BASE}/me", wait_until="domcontentloaded")
    rec_heading.wait_for(state="visible", timeout=25000)
    for _ in range(25):
        dismiss_overlay(page)
        if overlay_count(page) == 0:
            break
        page.wait_for_timeout(500)

    # ---------- tabs ----------
    tabs = page.get_by_role("tab")
    tab_names = [t.inner_text().strip() for t in tabs.all()] if tabs.count() else []
    report("tabs render", tabs.count() >= 2, f"tabs={tab_names}")
    profile_tab = page.get_by_role("tab", name=re.compile("学习画像"))
    report("学习画像 tab exists", profile_tab.count() == 1)
    profile_tab.first.click()

    # ---------- radar ----------
    svg = page.locator('svg[aria-label="学习维度雷达图"]')
    try:
        svg.first.wait_for(state="visible", timeout=20000)
        report("radar SVG renders", True)
    except Exception as e:
        report("radar SVG renders", False, str(e)[:120])
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{OUT}/shot-23-profile.png", full_page=True)
    if svg.count():
        svg.first.screenshot(path=f"{OUT}/shot-24-radar.png")
        html = svg.first.inner_html()
        lines = html.count("<line")
        ring_polys = len(re.findall(r'<polygon[^>]*fill="none"', html))
        filled = len(re.findall(r'<polygon[^>]*fill="var\(--color-primary\)"', html))
        dashes = html.count("stroke-dasharray")
        circles = html.count("<circle")
        texts = re.findall(r"<text[^>]*>([^<]*)</text>", html)
        labels = [t.strip() for t in texts if not re.fullmatch(r"\d+%", t.strip())]
        values = [t.strip() for t in texts if re.fullmatch(r"\d+%", t.strip())]
        report("axes == dimension count", lines == len(labels), f"axes={lines} dims={len(labels)} labels={labels}")
        report("grid rings at 25/50/75/100", ring_polys == 4, f"rings={ring_polys}")
        report("rings 3 dashed + 1 solid", dashes == 3, f"dasharray={dashes}")
        report("data polygon present", filled == 1, f"filled={filled}")
        report("vertex circles == dims", circles == len(labels), f"circles={circles}")
        report("value % labels == dims", len(values) == len(labels), f"values={values}")

    # ---------- milestones ----------
    growth = page.locator("section").filter(has=page.get_by_role("heading", name=re.compile("成长足迹")))
    report("成长足迹 section renders", growth.count() == 1, f"count={growth.count()}")
    if growth.count():
        items = growth.first.locator("li")
        report("milestone events with dates", items.count() > 0, f"count={items.count()}")
        ok_all = True
        for i in range(min(items.count(), 8)):
            spans = [s.strip() for s in items.nth(i).locator("span").all_inner_texts()]
            has_date = any(re.search(r"\d{4}年\d{1,2}月\d{1,2}日", s) for s in spans)
            if not has_date:
                ok_all = False
            report(f"milestone {i}: event+date", has_date, f"spans={spans}")
        report("all milestones have dates", ok_all)

    # ---------- stat cards ----------
    for label in ["总积分", "报名活动", "课程学习", "申请次数"]:
        el = page.get_by_text(label, exact=True)
        if el.count():
            val_el = el.first.locator("xpath=following-sibling::span")
            val = val_el.first.inner_text().strip() if val_el.count() else ""
            report(f"stat card '{label}'", bool(re.fullmatch(r"-?\d+", val)), f"value={val!r}")
        else:
            report(f"stat card '{label}'", False, "label not found")

    # ---------- switch back ----------
    dismiss_overlay(page)
    overview_tab = page.get_by_role("tab", name=re.compile("概览"))
    try:
        overview_tab.first.click(timeout=10000)
        report("概览 tab clickable", True)
    except Exception as e:
        report("概览 tab clickable", False, f"blocked: {str(e)[:100]}")
    try:
        rec_heading.wait_for(state="visible", timeout=15000)
        report("概览 tab: 学习推荐 content returns", True)
    except Exception as e:
        report("概览 tab: 学习推荐 content returns", False, str(e)[:100])
    svg2 = page.locator('svg[aria-label="学习维度雷达图"]')
    report("radar hidden after switch back", svg2.count() == 0 or not svg2.first.is_visible(), f"count={svg2.count()}")
    page.screenshot(path=f"{OUT}/shot-25-back-overview.png", full_page=True)

    # round trip
    dismiss_overlay(page)
    try:
        page.get_by_role("tab", name=re.compile("学习画像")).first.click(timeout=10000)
        svg.first.wait_for(state="visible", timeout=15000)
        page.get_by_role("tab", name=re.compile("概览")).first.click(timeout=10000)
        rec_heading.wait_for(state="visible", timeout=15000)
        report("round-trip 画像->概览 stable", True)
    except Exception as e:
        report("round-trip 画像->概览 stable", False, str(e)[:120])

    # ---------- summary ----------
    print("=" * 70)
    if activity_id:
        print(f"Created test activity id={activity_id} (left in DB for inspection; title BT-推荐测试活动-*)")
    print("RAW API RESPONSES:")
    for k, v in captured.items():
        print(f"--- {k} ---")
        print(v[:1200])
    print("PAGE ERRORS:", page_errors if page_errors else "(none)")
    print("CONSOLE ERRORS:", console_errors if console_errors else "(none)")
    print("=" * 70)
    print(f"TOTAL ISSUES: {len(issues)}")
    for it in issues:
        print("  -", it)

    browser.close()
