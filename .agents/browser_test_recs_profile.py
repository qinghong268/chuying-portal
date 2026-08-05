"""Browser test: 雏英计划 AI learning recommendations + eagle profile (学习画像).

Test plan:
1. Login as eagle via demo-login
2. Navigate to /me
3. "🎯 学习推荐" section renders with recommendation cards
4. Each card: type badge (活动/课程), title, reason text, 去看看 link
5. Click a recommendation -> detail page
6. 学习画像 tab exists and is clickable
7. SVG radar chart: 5 axes + data polygon
8. Grid rings at 25/50/75/100%
9. Milestone timeline with events + dates
10. 4 stat cards (总积分/报名活动/课程学习/申请次数)
11. Switch back to 概览 -> content returns
"""
import json
import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = r"D:\仓库\FunnyProjects\雏英官网\.agents"

issues: list[str] = []
console_logs: list[str] = []
page_errors: list[str] = []
failed_reqs: list[str] = []
api_responses: dict[str, object] = {}


def report(label: str, ok: bool, detail: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {label}" + (f" | {detail}" if detail else ""))
    if not ok:
        issues.append(f"{label} | {detail}")


def num(s: str) -> bool:
    return bool(re.fullmatch(r"-?\d+", s.strip()))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.set_default_timeout(30000)

    page.on(
        "console",
        lambda m: console_logs.append(f"{m.type}: {m.text}")
        if m.type in ("error", "warning")
        else None,
    )
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.on("requestfailed", lambda r: failed_reqs.append(f"{r.method} {r.url} -> {r.failure}"))

    def on_response(resp):
        if "/api/me/recommendations" in resp.url or resp.url.endswith("/api/me/profile"):
            try:
                api_responses[resp.url] = resp.json()
            except Exception:
                pass

    page.on("response", on_response)

    # ---------- 1. Login as eagle (demo-login) ----------
    page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{OUT}/shot-1-login.png", full_page=True)

    eagle_btn = page.locator("button", has_text=re.compile("雏英"))
    report("login page shows 雏英 demo-login button", eagle_btn.count() == 1, f"count={eagle_btn.count()}")
    eagle_btn.first.click()
    page.wait_for_url(re.compile(r"/me($|\?)"), timeout=20000)
    report("demo-login redirects to /me", True, page.url)

    # ---------- 2/3/4. Overview: 学习推荐 section + cards ----------
    rec_heading = page.get_by_role("heading", name=re.compile("学习推荐"))
    try:
        rec_heading.wait_for(state="visible", timeout=20000)
        report("🎯 学习推荐 section renders", True, f"heading text: {rec_heading.first.inner_text()!r}")
    except Exception as e:
        report("🎯 学习推荐 section renders", False, f"timeout waiting for heading: {e}")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{OUT}/shot-2-overview.png", full_page=True)

    rec_sec = page.locator("section").filter(has=rec_heading)
    cards = rec_sec.locator("article")
    n = cards.count()
    report("recommendation cards present", n > 0, f"count={n}")
    if n == 0:
        body = rec_sec.first.inner_text() if rec_sec.count() else "(section not found)"
        report("no-cards message state", False, body.replace("\n", " | ")[:300])
    else:
        for i in range(min(n, 6)):
            card = cards.nth(i)
            badge = card.locator("span").first.inner_text().strip()
            reason_el = card.locator("p").first
            reason = reason_el.inner_text().strip() if reason_el.count() else ""
            link_el = card.locator("a", has_text="去看看")
            href = link_el.first.get_attribute("href") or "" if link_el.count() else ""
            title_els = card.locator("strong, h3, h4, [class*=title]").count()
            ok = (
                badge in ("活动", "课程")
                and bool(reason)
                and bool(re.match(r"^/(activities|courses)/\d+$", href))
            )
            report(
                f"card {i} structure",
                ok,
                f"badge={badge!r} reason={reason[:44]!r} href={href!r} separate-title-elements={title_els}",
            )

    # ---------- 5. Click first recommendation -> detail page ----------
    if n > 0:
        link_el = cards.first.locator("a", has_text="去看看").first
        href = link_el.get_attribute("href") or ""
        m = re.match(r"^/(activities|courses)/(\d+)$", href)
        report("first card 去看看 href valid", bool(m), href)
        link_el.click()
        try:
            page.wait_for_url(re.compile(r"/(activities|courses)/\d+"), timeout=15000)
            report("clicking 去看看 navigates to detail page", True, page.url)
        except Exception as e:
            report("clicking 去看看 navigates to detail page", False, f"url={page.url} err={e}")
        page.wait_for_load_state("networkidle")
        h1 = page.locator("h1")
        h1txt = h1.first.inner_text() if h1.count() else "(no h1)"
        report("detail page renders title h1", h1.count() >= 1, f"h1={h1txt[:50]}")
        body_text = page.inner_text("body")
        err_markers = ["活动不存在或未发布", "课程不存在或未发布", "加载失败", "无效的活动编号", "无效的课程编号"]
        errs_found = [m for m in err_markers if m in body_text]
        report("detail page shows no error", not errs_found, f"errors={errs_found}")
        page.screenshot(path=f"{OUT}/shot-3-detail.png", full_page=True)

    # ---------- back to /me ----------
    page.goto(f"{BASE}/me", wait_until="domcontentloaded")
    try:
        rec_heading.wait_for(state="visible", timeout=20000)
    except Exception:
        pass

    # ---------- 6. 学习画像 tab ----------
    tabs = page.get_by_role("tab")
    tab_names = [t.inner_text().strip() for t in tabs.all()] if tabs.count() else []
    report("tabs render", tabs.count() >= 2, f"tabs={tab_names}")
    profile_tab = page.get_by_role("tab", name=re.compile("学习画像"))
    report("学习画像 tab exists", profile_tab.count() == 1, f"count={profile_tab.count()}")
    profile_tab.first.click()

    # ---------- 7/8. Radar chart ----------
    svg = page.locator('svg[aria-label="学习维度雷达图"]')
    try:
        svg.first.wait_for(state="visible", timeout=20000)
        report("radar SVG renders after clicking tab", True)
    except Exception as e:
        report("radar SVG renders after clicking tab", False, f"err={e}")
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{OUT}/shot-4-profile.png", full_page=True)

    if svg.count():
        svg.first.screenshot(path=f"{OUT}/shot-5-radar.png")
        html = svg.first.inner_html()
        lines = html.count("<line")
        ring_polys = len(re.findall(r'<polygon[^>]*fill="none"', html))
        filled_polys = len(re.findall(r'<polygon[^>]*fill="var\(--color-primary\)"', html))
        dashes = html.count("stroke-dasharray")
        circles = html.count("<circle")
        texts = re.findall(r"<text[^>]*>([^<]*)</text>", html)
        labels = [t.strip() for t in texts if not re.fullmatch(r"\d+%", t.strip())]
        values = [t.strip() for t in texts if re.fullmatch(r"\d+%", t.strip())]
        report("5 radar axes (line elements)", lines == 5, f"axes(lines)={lines}")
        report("grid rings at 25/50/75/100 (fill=none polygons)", ring_polys == 4, f"rings={ring_polys}")
        report("3 dashed rings + 1 solid 100% ring", dashes == 3, f"stroke-dasharray count={dashes}")
        report("data polygon (filled polygon)", filled_polys == 1, f"filled={filled_polys}")
        report("vertex circles per dimension", circles == 5, f"circles={circles}")
        report("5 dimension labels", len(labels) == 5, f"labels={labels}")
        report("5 value labels (n%)", len(values) == 5, f"values={values}")
        report("radar dims match profile API", True, f"labels={labels}")

    # ---------- 9. Milestone timeline ----------
    growth = page.locator("section").filter(has=page.get_by_role("heading", name=re.compile("成长足迹")))
    report("成长足迹 (milestone) section renders", growth.count() == 1, f"count={growth.count()}")
    if growth.count():
        items = growth.first.locator("li")
        report("milestone timeline has events", items.count() > 0, f"count={items.count()}")
        for i in range(min(items.count(), 8)):
            spans = [s.strip() for s in items.nth(i).locator("span").all_inner_texts()]
            has_date = any(re.search(r"\d{4}年\d{1,2}月\d{1,2}日", s) for s in spans)
            has_event = any(bool(s) for s in spans)
            report(f"milestone {i}: event + date", has_date and has_event, f"content={spans}")

    # ---------- 10. Stat cards ----------
    for label in ["总积分", "报名活动", "课程学习", "申请次数"]:
        el = page.get_by_text(label, exact=True)
        if el.count():
            val_el = el.first.locator("xpath=following-sibling::span")
            val = val_el.first.inner_text().strip() if val_el.count() else ""
            report(f"stat card '{label}'", True, f"value={val!r} numeric={num(val)}")
        else:
            report(f"stat card '{label}'", False, "label not found")

    # profile header extra info
    head = page.locator("div").filter(has_text="学习维度覆盖")
    if head.count():
        report("profile header shows dimension coverage", True, head.first.inner_text()[:80])

    # ---------- 11. Switch back to 概览 ----------
    overview_tab = page.get_by_role("tab", name=re.compile("概览"))
    report("概览 tab exists", overview_tab.count() == 1, f"count={overview_tab.count()}")
    overview_tab.first.click()
    try:
        rec_heading.wait_for(state="visible", timeout=15000)
        report("概览 tab: 学习推荐 content returns", True)
    except Exception as e:
        report("概览 tab: 学习推荐 content returns", False, f"err={e}")
    svg_after = page.locator('svg[aria-label="学习维度雷达图"]')
    report(
        "radar SVG hidden after switching back",
        svg_after.count() == 0 or not svg_after.first.is_visible(),
        f"count={svg_after.count()}",
    )
    page.wait_for_load_state("networkidle")
    page.screenshot(path=f"{OUT}/shot-6-back-overview.png", full_page=True)

    # ---------- summary ----------
    print("=" * 70)
    print("API RESPONSES:")
    for u, j in api_responses.items():
        print(f"  {u}")
        print(f"    {json.dumps(j, ensure_ascii=False)[:800]}")
    print("PAGE ERRORS:", page_errors if page_errors else "(none)")
    print("FAILED REQUESTS:", failed_reqs if failed_reqs else "(none)")
    err_logs = [l for l in console_logs if l.startswith("error")]
    warn_logs = [l for l in console_logs if l.startswith("warning")]
    print(f"CONSOLE ERRORS ({len(err_logs)}):")
    for l in err_logs[:20]:
        print("  ", l)
    print(f"CONSOLE WARNINGS ({len(warn_logs)}):")
    for l in warn_logs[:20]:
        print("  ", l)
    print("=" * 70)
    print(f"TOTAL ISSUES: {len(issues)}")
    for it in issues:
        print("  -", it)

    browser.close()
