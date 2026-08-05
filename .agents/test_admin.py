"""Full browser test: admin console, dashboard, weekly reports of 雏英计划."""
import re, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
results = []
console_errors = []
failed_requests = []

def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))

def section(name):
    print(f"\n===== {name} =====")

def login(page):
    page.goto(f"{BASE}/login", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(800)
    inputs = page.locator("input")
    inputs.nth(0).fill("super@demo")
    inputs.nth(1).fill("Demo1234!")
    page.locator("button[type='submit'], form button").first.click()
    page.wait_for_timeout(2500)

def has_shell(page):
    return (page.locator("a[href='/admin']").first.is_visible() and
            page.locator("a[href='/admin/dashboard']").first.is_visible() and
            page.locator("text=演示超级管理员").first.is_visible())

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1900})
    http_errors = []
    dash_req = {"n": 0}
    def on_response(resp):
        if resp.status >= 400:
            http_errors.append(f"{resp.status} {resp.request.method} {resp.url}")
        if "api/admin/dashboard" in resp.url and resp.status < 400:
            dash_req["n"] += 1
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("requestfailed", lambda r: failed_requests.append(f"{r.method} {r.url} {r.failure}"))
    page.on("response", on_response)
    page.on("dialog", lambda d: d.accept())  # accept all dialogs (weekly report confirm)

    # ---------- LOGIN ----------
    section("LOGIN")
    login(page)
    page.wait_for_load_state("networkidle")
    check("Login redirects to /admin", page.url.rstrip("/") == f"{BASE}/admin", page.url)

    # ---------- CONSOLE (/admin) ----------
    section("CONSOLE /admin")
    body = page.locator("body").inner_text()
    check("Console page loads", page.url.rstrip("/") == f"{BASE}/admin")
    check("Welcome message", "欢迎，演示超级管理员" in body)
    for label, href, action in [("待审加入", "/admin/join?status=pending", "去审核"),
                                 ("待审积分", "/admin/point-apps?status=pending", "去审批"),
                                 ("进行中活动", "/admin/activities", "管理活动")]:
        card = page.locator(f"div:has(span:text-is('{label}')):has(a:text-is('{action}'))").last
        ok = card.is_visible()
        val = ""
        link = None
        if ok:
            txt = card.inner_text()
            nums = re.findall(r"\d+", txt)
            val = f"label+num: {' '.join(nums[:1])}"
            links = card.locator("a")
            link = links.first.get_attribute("href") if links.count() else None
        check(f"Console stat card '{label}'", ok and link == href and val != "", f"numbers={val} link={link}")
    for q, href in [("加入审核", "/admin/join"), ("积分审批", "/admin/point-apps"),
                    ("活动管理", "/admin/activities"), ("内容运营", "/admin/content"),
                    ("数据看板", "/admin/dashboard")]:
        el = page.locator(f"a:has-text('{q}')").first
        check(f"Quick link '{q}'", el.is_visible() and el.get_attribute("href") == href, f"-> {el.get_attribute('href')}")
    check("Data summary line", "活跃雏英" in body and "近 7 日报名" in body and "积分流水" in body)
    page.screenshot(path="01_console.png", full_page=True)

    # ---------- DASHBOARD ----------
    section("DASHBOARD /admin/dashboard")
    page.goto(f"{BASE}/admin/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2500)
    body = page.locator("body").inner_text()
    check("Dashboard loads", "数据看板" in body[:2000])

    # 1+2. AI insight bar
    check("AI洞察条 visible with 📊 icon", "📊 AI 运营洞察" in body)
    m = re.search(r"📊 AI 运营洞察(.*?)待审积分", body, re.S)
    ai_text = m.group(1) if m else ""
    has_sentence = any(k in ai_text for k in ["本周", "运营", "报名", "待审", "积分", "提升", "建议"])
    has_json_syntax = bool(re.search(r'[\{\}"]+|\"",|\d+:\s*|\\u[0-9a-fA-F]{4}', ai_text)) and '"' in ai_text
    has_raw_field = bool(re.search(r'\b(aiInsight|summary|text|content)\s*[:：]', ai_text))
    check("AI洞察条 shows formatted text (not raw JSON)",
          has_sentence and not has_json_syntax and not has_raw_field,
          repr(ai_text[:150]))
    check("AI洞察条 bullet insights (⚠️/💡)", ("⚠️" in ai_text or "💡" in ai_text) and "刷新洞察" in body)
    page.screenshot(path="02_dashboard.png", full_page=True)

    # 3+4+11. Six stat cards
    card_defs = [
        ("活跃雏英", "/admin/users?role=eagle&status=active"),
        ("待审加入", "/admin/join?status=pending"),
        ("待审积分", "/admin/point-apps?status=pending"),
        ("进行中活动", "/admin/activities"),
        ("近7日报名", "/admin/activities"),
        ("近7日积分发放", "/admin/point-apps"),
    ]
    n_ok = n_spark = n_delta = n_num = 0
    card_els = {}
    for label, href in card_defs:
        el = page.locator(f"a:has-text('{label}')").first
        if not el.is_visible():
            check(f"Stat card '{label}' visible", False, "not found")
            continue
        txt = el.inner_text().replace("\n", " | ")
        is_a = el.evaluate("e => e.tagName") == "A"
        spark = el.locator("svg").count() > 0
        nums = re.findall(r"\d+", txt)
        has_delta = "新增" in txt
        card_els[label] = el
        n_ok += 1; n_spark += spark; n_delta += has_delta; n_num += bool(nums)
        if label in ("待审加入", "近7日报名", "近7日积分发放"):
            print(f"  card[{label}]: {txt[:80]}")
    check("6 stat cards visible with numbers", n_ok == 6 and n_num == 6, f"{n_ok} cards, {n_num} with numbers")
    check("Cards have sparklines (svg inside)", n_spark >= 3, f"{n_spark}/6 have svg sparkline (活跃雏英/近7日报名/近7日积分发放 per design)")
    check("Cards have delta badges (新增)", n_delta >= 2, f"{n_delta}/6 (近7日报名 & 近7日积分发放 per design)")
    check("Cards are <a> Link elements", all(page.locator(f"a:has-text('{l}')").first.evaluate("e => e.tagName") == "A" for l, _ in card_defs))

    # 5. 待办队列 tables
    section("待办队列")
    body = page.locator("body").inner_text()
    check("待审积分 table headers (申请人/类型/分值/等待/AI预审)",
          all(h in body for h in ["申请人", "类型", "分值", "等待", "AI预审"]))
    check("待审加入 table headers (姓名/邮箱/提交时间)",
          all(h in body for h in ["姓名", "邮箱", "提交时间"]))
    badges = {"🟢推荐通过": body.count("🟢"), "🟡建议复核": body.count("🟡"),
              "🔴建议驳回": body.count("🔴"), "⚪未评估": body.count("⚪")}
    for b, c in badges.items():
        check(f"Risk badge '{b}' present", c > 0, f"count={c}")
    check("Badge kinds: at least 🟢 and ⚪", badges["🟢推荐通过"] > 0 and badges["⚪未评估"] > 0)
    check("待审积分 row count shown", bool(re.search(r"待审积分 \(\d+\)", body)))
    check("待审加入 row count shown", bool(re.search(r"待审加入 \(\d+\)", body)))
    check("查看全部 → links to filtered lists",
          page.locator("a[href='/admin/point-apps?status=pending']").count() >= 2 and
          page.locator("a[href='/admin/join?status=pending']").count() >= 2)

    # 6/7. Two bar charts + Y-axis labels
    section("近7日趋势 charts")
    chart_sec = page.locator("h3:text-is('近 7 日趋势')").first
    check("近7日趋势 section present", chart_sec.is_visible())
    h4s = page.locator("h4:text-is('报名人数'), h4:text-is('积分发放')")
    check("TWO separate charts (报名人数 + 积分发放)", h4s.count() == 2, f"found {h4s.count()}")
    svgs = page.locator("svg")
    check("At least 2 <svg> elements on page", svgs.count() >= 2, f"{svgs.count()} svgs")
    chart_svgs = []
    for i in range(h4s.count()):
        wrap = h4s.nth(i).locator("xpath=ancestor::div[contains(@class,'chartWrap')][1]")
        s = wrap.locator("svg").first if wrap.count() else None
        chart_svgs.append(s)
    y_ok = True
    for i, s in enumerate(chart_svgs):
        if s is None:
            y_ok = False
            check(f"Chart {i+1} svg found", False)
            continue
        texts = [t or "" for t in s.locator("text").all_text_contents()]
        nums = [t for t in texts if re.fullmatch(r"\d+", t.strip())]
        dates = [t for t in texts if re.search(r"\d+/\d+", t)]
        check(f"Chart {i+1} ('{h4s.nth(i).inner_text()}') Y-axis labels visible", len(nums) >= 4, f"y-labels: {nums[:8]} | x-dates: {dates[:7]}")
        y_ok = y_ok and len(nums) >= 4

    # 8. Hover bar -> tooltip with date + value
    section("Bar tooltip")
    s1 = chart_svgs[0]
    bars = s1.locator("rect[rx]") if s1 else None
    print(f"  (bars in chart1: {bars.count() if bars else 'n/a'})")
    if bars and bars.count() > 0:
        # pick the tallest bar (aim point away from grid lines)
        tallest = None; tallest_h = -1
        for bi in range(bars.count()):
            box = bars.nth(bi).bounding_box()
            if box and box["height"] > tallest_h:
                tallest_h = box["height"]; tallest = bi
        bar = bars.nth(tallest)
        bar.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        box = bar.bounding_box()
        texts_before = [t or "" for t in s1.locator("text").all_text_contents()]
        px, py = box["x"] + box["width"] / 2, box["y"] + 8  # near top of bar
        page.mouse.move(px, py)
        page.wait_for_timeout(600)
        texts_after = [t or "" for t in s1.locator("text").all_text_contents()]
        print(f"  hovered tallest bar idx={tallest} at ({px:.0f},{py:.0f}); before={texts_before}")
        print(f"  after={texts_after}")
        new = [t for t in texts_after if t not in texts_before]
        has_date = any(re.search(r"\d+/\d+", t) for t in new)
        has_val = any(re.search(r"\d+/\d+.*\d+|\d+$", t) for t in new)
        check("Hover on bar shows tooltip", len(new) >= 1, f"new texts: {new[:4]}")
        check("Tooltip has date + value (e.g. '7/30: 12')", has_date and has_val, f"new: {new[:4]}")

        # 9. Click bar -> drawer from right
        page.mouse.click(px, py)
        page.wait_for_timeout(900)
        body2 = page.locator("body").inner_text()
        has_detail = bool(re.search(r"明细", body2)) and ("当日无报名" in body2 or "当日无流水" in body2 or "报名" in body2)
        check("Click bar opens detail drawer", has_detail, "found 明细 text" if has_detail else "no drawer")
        h3 = page.locator("h3:has-text('明细')").first
        if h3.is_visible():
            # walk up to drawer container (fixed overlay wrapper)
            drawer_el = h3.locator("xpath=ancestor::div[contains(@class,'drawer')][1]")
            box = drawer_el.bounding_box()
            vp = page.viewport_size
            if box:
                right = box["x"] + box["width"]
                print(f"  drawer bbox: {box}, viewport {vp}")
                check("Drawer opens from right (anchored to right edge)",
                      right >= vp["width"] - 8 and box["x"] > vp["width"] - 600, f"x={box['x']} w={box['width']}")
            else:
                check("Drawer opens from right", False, "no bbox")
            # drawer content
            check("Drawer shows date in header", bool(re.search(r"\d+/", h3.inner_text())), h3.inner_text())
            # close
            page.locator("button:text-is('✕')").first.click()
            page.wait_for_timeout(500)
            check("Drawer closes via ✕", page.locator("h3:has-text('明细')").count() == 0)
        else:
            check("Drawer header found", False)
    else:
        check("Bars found for hover test", False)

    # 10. Refresh button (verify it triggers a real data refetch)
    section("Refresh button")
    n_before = dash_req["n"]
    page.locator("button:text-is('刷新')").first.click()
    page.wait_for_timeout(2500)
    n_after = dash_req["n"]
    after = page.locator("text=更新于").first.inner_text()
    check("刷新 triggers dashboard data refetch", n_after > n_before, f"dashboard API calls: {n_before} -> {n_after}")
    check("刷新 keeps 更新于 timestamp", "更新于" in after, after)

    # 11. Stat card navigation stays in shell
    section("Stat card navigation")
    page.locator("a[href='/admin/join?status=pending']").first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    check("Click 待审加入 card navigates to join list", "/admin/join" in page.url, page.url)
    check("Admin shell remains (sidebar + topbar)", has_shell(page))
    page.screenshot(path="03_after_card_click.png", full_page=True)

    # ---------- WEEKLY REPORTS ----------
    section("WEEKLY REPORTS /admin/weekly-reports")
    page.goto(f"{BASE}/admin/weekly-reports", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)
    body = page.locator("body").inner_text()
    check("Weekly reports page loads (学习周报)", "学习周报" in body)
    gen_btn = page.locator("button:text-is('生成周报')").first
    check("生成周报 button visible", gen_btn.is_visible())
    page.screenshot(path="04_weekly_before.png", full_page=True)

    gen_btn.click()  # dialog auto-accepted via page.on('dialog')
    page.wait_for_timeout(800)
    loading_shown = page.locator("button:text-is('生成中…')").count() > 0
    if not loading_shown:
        # dialog may have raced; click again
        page.locator("button:text-is('生成周报')").first.click()
        page.wait_for_timeout(800)
        loading_shown = page.locator("button:text-is('生成中…')").count() > 0
    check("Confirm dialog triggered (button shows 生成中…)", loading_shown, "loading state")
    # wait for completion (AI summary can take time)
    for _ in range(60):
        body = page.locator("body").inner_text()
        if "已为" in body or "生成失败" in body or "周报生成" in body:
            break
        page.wait_for_timeout(1000)
    body = page.locator("body").inner_text()
    gen_msg = [l.strip() for l in body.split("\n") if "已为" in l]
    check("Generation success message", bool(gen_msg), gen_msg[0][:100] if gen_msg else "no message")
    check("Week table appears (周次/学员数/操作)", all(h in body for h in ["周次", "学员数", "操作"]))
    page.screenshot(path="05_weekly_generated.png", full_page=True)

    # after generation the week row is auto-expanded -> 收起详情 visible
    auto_expanded = page.locator("button:text-is('收起详情')").count() > 0
    collapse_btn = page.locator("button:text-is('收起详情')").first
    expand_btn = page.locator("button:text-is('查看详情')").first
    check("Week row auto-expands after generation (收起详情)", auto_expanded)
    body = page.locator("body").inner_text()
    has_user_summaries = ("报名" in body and "积分" in body) or "总结" in body
    check("Per-user summaries visible (auto-expanded)", has_user_summaries)
    page.screenshot(path="06_weekly_expanded.png", full_page=True)
    # collapse then re-expand via 查看详情
    if auto_expanded:
        collapse_btn.click()
        page.wait_for_timeout(500)
        check("收起详情 collapses row", page.locator("button:text-is('收起详情')").count() == 0 and expand_btn.count() > 0)
        expand_btn.click()
        page.wait_for_timeout(700)
        body = page.locator("body").inner_text()
        check("查看详情 re-expands row with per-user summaries",
              page.locator("button:text-is('收起详情')").count() > 0 and ("报名" in body or "总结" in body))
        page.screenshot(path="07_weekly_reexpanded.png", full_page=True)
    else:
        check("收起详情 collapses row", False, "row not auto-expanded")
        check("查看详情 re-expands row", False)

    # ---------- SUMMARY ----------
    section("RESULTS")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"\nTOTAL: {passed} passed, {failed} failed / {len(results)} checks")
    if failed:
        print("\nFAILED CHECKS:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name} {('— ' + str(detail)[:160]) if detail else ''}")
    print(f"\nHTTP >=400 RESPONSES: {len(http_errors)}")
    for r in http_errors[:10]:
        print("  -", r[:220])
    print(f"\nCONSOLE ERRORS: {len(console_errors)}")
    for e in console_errors[:10]:
        print("  -", e[:220])
    print(f"FAILED REQUESTS: {len(failed_requests)}")
    for r in failed_requests[:10]:
        print("  -", r[:220])

    browser.close()
    sys.exit(1 if failed else 0)
