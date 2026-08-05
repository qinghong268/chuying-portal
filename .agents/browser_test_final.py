"""Final comprehensive browser test for 雏英计划 /me (recommendations + 学习画像).

Handles the NotificationModal overlay that appears with a variable delay after
login (dismisses it), captures raw API responses, and prints results as it goes.
"""
import json
import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = r"D:\仓库\FunnyProjects\雏英官网\.agents"

captured: dict[str, str] = {}
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
            captured[url.split("5173")[-1]] = resp.text()
        except Exception:
            pass


def dismiss_overlay(page, label: str) -> str:
    """If an overlay is present, dump it and click top-left to dismiss. Returns description."""
    found = page.evaluate(
        "[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).position==='fixed' && d.getBoundingClientRect().width>500 && d.getBoundingClientRect().height>500).map(d=>d.className)"
    )
    dialogs = page.evaluate("[...document.querySelectorAll('[role=dialog]')].length")
    if found:
        print(f"[INFO] {label}: fixed full-screen overlay present: {found} dialogs={dialogs}")
        page.mouse.click(25, 25)
        page.wait_for_timeout(600)
        still = page.evaluate(
            "[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).position==='fixed' && d.getBoundingClientRect().width>500 && d.getBoundingClientRect().height>500).length"
        )
        print(f"[INFO] {label}: after overlay click, overlays remaining: {still}")
        return str(found)
    return ""


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(25000)
        page.on("response", on_response)
        page.on("console", lambda m: console_errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        # ---- 1. login ----
        page.goto(f"{BASE}/login", wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        page.locator("button", has_text=re.compile("雏英")).first.click()
        page.wait_for_url(re.compile(r"/me($|\?)"), timeout=20000)
        page.wait_for_load_state("networkidle")

        # ---- notification overlay appears with variable delay: poll & dismiss ----
        for _ in range(20):
            dismiss_overlay(page, "poll")
            t = page.evaluate("[...document.querySelectorAll('[role=dialog]')].length")
            if t == 0:
                break
            page.wait_for_timeout(1000)
        modal_text = page.evaluate("[...document.querySelectorAll('[role=dialog]')].map(e=>e.innerText.slice(0,150))")
        if modal_text:
            report("notification modal appears over /me", True, f"content: {modal_text}")

        # ---- 2. 学习推荐 section ----
        rec_heading = page.get_by_role("heading", name=re.compile("学习推荐"))
        rec_heading.wait_for(state="visible", timeout=20000)
        sec = page.locator("section").filter(has=rec_heading)
        cards = sec.locator("article")
        n = cards.count()
        report("🎯 学习推荐 section renders", sec.count() == 1)
        report("recommendation cards present", n > 0, f"count={n}")
        if n == 0:
            report("empty-state message shown", False, sec.first.inner_text().replace("\n", " | ")[:160])

        # ---- 3. card contents (if any) ----
        rec_badges: list[str] = []
        if n > 0:
            for i in range(min(n, 6)):
                card = cards.nth(i)
                badge = card.locator("span").first.inner_text().strip()
                rec_badges.append(badge)
                reason = card.locator("p").first.inner_text().strip()
                link = card.locator("a", has_text="去看看").first
                href = link.get_attribute("href") or ""
                title_els = card.locator("strong, h3, h4").count()
                ok = badge in ("活动", "课程") and bool(reason) and bool(re.match(r"^/(activities|courses)/\d+$", href))
                report(f"card {i}: badge/title/reason/link", ok, f"badge={badge!r} reason={reason[:44]!r} href={href!r} titleEls={title_els}")

        # ---- 4. click recommendation -> detail ----
        if n > 0:
            cards.first.locator("a", has_text="去看看").first.click()
            try:
                page.wait_for_url(re.compile(r"/(activities|courses)/\d+"), timeout=15000)
                report("去看看 navigates to detail page", True, page.url)
            except Exception as e:
                report("去看看 navigates to detail page", False, f"url={page.url} {e}")
            page.wait_for_load_state("networkidle")
            h1 = page.locator("h1")
            body = page.inner_text("body")
            errs = [m for m in ["活动不存在或未发布", "课程不存在或未发布", "加载失败"] if m in body]
            report("detail page renders title", h1.count() >= 1 and not errs, f"h1={h1.first.inner_text()[:40] if h1.count() else 'NONE'} errors={errs}")
            page.screenshot(path=f"{OUT}/shot-11-detail.png", full_page=True)
        else:
            # supplementary: verify a target detail page renders (e.g. activity 39, an available one)
            page.goto(f"{BASE}/activities/39", wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            h1 = page.locator("h1")
            body = page.inner_text("body")
            errs = [m for m in ["活动不存在或未发布", "加载失败"] if m in body]
            report("(supplementary) activity detail page renders for eligible item 39", h1.count() >= 1 and not errs, f"h1={h1.first.inner_text()[:40] if h1.count() else 'NONE'} errors={errs}")
            page.goto(f"{BASE}/me", wait_until="domcontentloaded")

        # ---- 5/6. tabs ----
        rec_heading.wait_for(state="visible", timeout=20000)
        dismiss_overlay(page, "before-tab-click")
        tabs = page.get_by_role("tab")
        tab_names = [t.inner_text().strip() for t in tabs.all()] if tabs.count() else []
        report("tabs render", tabs.count() >= 2, f"tabs={tab_names}")
        profile_tab = page.get_by_role("tab", name=re.compile("学习画像"))
        report("学习画像 tab exists", profile_tab.count() == 1)
        try:
            profile_tab.first.click(timeout=10000)
            report("学习画像 tab clickable", True)
        except Exception as e:
            report("学习画像 tab clickable", False, f"blocked: {str(e)[:100]}")

        # ---- 7/8. radar ----
        svg = page.locator('svg[aria-label="学习维度雷达图"]')
        try:
            svg.first.wait_for(state="visible", timeout=20000)
            report("radar SVG renders on profile tab", True)
        except Exception as e:
            report("radar SVG renders on profile tab", False, str(e)[:120])
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{OUT}/shot-12-profile.png", full_page=True)

        if svg.count():
            svg.first.screenshot(path=f"{OUT}/shot-13-radar.png")
            html = svg.first.inner_html()
            lines = html.count("<line")
            ring_polys = len(re.findall(r'<polygon[^>]*fill="none"', html))
            filled = len(re.findall(r'<polygon[^>]*fill="var\(--color-primary\)"', html))
            dashes = html.count("stroke-dasharray")
            circles = html.count("<circle")
            texts = re.findall(r"<text[^>]*>([^<]*)</text>", html)
            labels = [t.strip() for t in texts if not re.fullmatch(r"\d+%", t.strip())]
            values = [t.strip() for t in texts if re.fullmatch(r"\d+%", t.strip())]
            report("axes == dimension count", lines == len(labels), f"axes(lines)={lines} dims={len(labels)}")
            report("grid rings at 25/50/75/100", ring_polys == 4, f"rings={ring_polys}")
            report("rings: 3 dashed + 1 solid", dashes == 3, f"dasharray={dashes}")
            report("data polygon present", filled == 1, f"filled={filled}")
            report("vertex circles == dims", circles == len(labels), f"circles={circles}")
            report("labels rendered", len(labels) >= 1, f"labels={labels}")
            report("value % labels rendered", len(values) == len(labels), f"values={values}")

        # ---- 9. milestones ----
        growth = page.locator("section").filter(has=page.get_by_role("heading", name=re.compile("成长足迹")))
        report("成长足迹 section renders", growth.count() == 1, f"count={growth.count()}")
        if growth.count():
            items = growth.first.locator("li")
            report("milestone events present", items.count() > 0, f"count={items.count()}")
            for i in range(min(items.count(), 8)):
                spans = [s.strip() for s in items.nth(i).locator("span").all_inner_texts()]
                has_date = any(re.search(r"\d{4}年\d{1,2}月\d{1,2}日", s) for s in spans)
                report(f"milestone {i}: event + date", has_date, f"spans={spans}")

        # ---- 10. stat cards ----
        for label in ["总积分", "报名活动", "课程学习", "申请次数"]:
            el = page.get_by_text(label, exact=True)
            if el.count():
                val_el = el.first.locator("xpath=following-sibling::span")
                val = val_el.first.inner_text().strip() if val_el.count() else ""
                report(f"stat card '{label}'", bool(re.fullmatch(r"-?\d+", val)), f"value={val!r}")
            else:
                report(f"stat card '{label}'", False, "label not found")

        # ---- 11. switch back to 概览 ----
        dismiss_overlay(page, "before-back-to-overview")
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
        page.screenshot(path=f"{OUT}/shot-14-back-overview.png", full_page=True)

        # round-trip again
        dismiss_overlay(page, "before-round2")
        try:
            page.get_by_role("tab", name=re.compile("学习画像")).first.click(timeout=10000)
            svg.first.wait_for(state="visible", timeout=15000)
            page.get_by_role("tab", name=re.compile("概览")).first.click(timeout=10000)
            rec_heading.wait_for(state="visible", timeout=15000)
            report("round-trip 画像->概览 stable", True)
        except Exception as e:
            report("round-trip 画像->概览 stable", False, str(e)[:120])

        # ---- summary ----
        print("=" * 70)
        print("RAW API RESPONSES:")
        for k, v in captured.items():
            print(f"--- {k} ---")
            print(v[:1500])
        print("PAGE ERRORS:", page_errors if page_errors else "(none)")
        print("CONSOLE ERRORS:", console_errors if console_errors else "(none)")
        print("=" * 70)
        print(f"TOTAL ISSUES: {len(issues)}")
        for it in issues:
            print("  -", it)
        browser.close()
except Exception as e:
    print("FATAL:", e)
    raise
