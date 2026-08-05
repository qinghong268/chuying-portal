"""Verify 雏英计划 demo seed data end-to-end (Playwright)."""
import sys, json, time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
SHOT_DIR = r"D:\仓库\FunnyProjects\雏英官网\.agents\shots"

results = []

def log(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {('- ' + detail) if detail else ''}")

def login(page, account, password):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill("#login-account", account)
    page.fill("#login-password", password)
    page.click('button[type="submit"]')
    try:
        page.wait_for_url(lambda url: "login" not in url, timeout=10000)
    except Exception:
        pass  # still on /login if login failed
    time.sleep(1.5)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})

    # ---------- EAGLE ----------
    page = ctx.new_page()
    page.on("console", lambda m: None)
    page.on("pageerror", lambda e: print("PAGEERROR:", e))
    login(page, "eagle@demo", "Demo1234!")
    cur = page.url
    log("eagle login", "login" not in cur, f"url={cur}")
    page.screenshot(path=f"{SHOT_DIR}/01_eagle_login.png")

    # /me overview + learning recommendations
    page.goto(f"{BASE}/me", wait_until="networkidle")
    time.sleep(2)
    body = page.inner_text("body")
    has_rec_section = "学习推荐" in body
    rec_cards = page.locator("text=学习推荐").count() > 0
    rec_count = page.locator("section").count()
    rec_cards_actual = 0
    # find recommendation cards: look for text like 推荐课程/新活动/推荐 in panel sections
    try:
        txt = page.inner_text("body")
        import re
        rec_cards_actual = txt.count("推荐课程") + txt.count("新活动") + txt.count("推荐活动") + txt.count("recommend")
    except Exception as e:
        rec_cards_actual = f"err:{e}"
    empty_rec = "暂无推荐" in body
    log("eagle /me overview renders", page.locator("body").inner_text() != "", "page loaded")
    log("/me 学习推荐 section present", has_rec_section, "header found")
    log("/me recommendation cards rendered", (rec_cards_actual if isinstance(rec_cards_actual, int) else 0) >= 1, f"cards={rec_cards_actual}, emptyMsg={empty_rec}")
    page.screenshot(path=f"{SHOT_DIR}/02_me_overview.png")

    # /me/enrollments
    page.goto(f"{BASE}/me/enrollments", wait_until="networkidle")
    time.sleep(1.5)
    rows = page.locator("tbody tr").count()
    en_body = page.inner_text("body")
    has_seed1 = "往期线下实践" in en_body
    has_seed2 = "线上技术分享会" in en_body
    log("eagle /me/enrollments >= 4 rows", rows >= 4, f"rows={rows}")
    log("enrollments contain seed '往期线下实践'", has_seed1, "")
    log("enrollments contain seed '线上技术分享会'", has_seed2, "")
    page.screenshot(path=f"{SHOT_DIR}/03_me_enrollments.png")

    # /me/applications
    page.goto(f"{BASE}/me/applications", wait_until="networkidle")
    time.sleep(1.5)
    app_rows = page.locator("tbody tr").count()
    app_body = page.inner_text("body")
    has_seed_t2 = "全国算法竞赛二等奖" in app_body
    pending_t1 = "心得" in app_body and "待审" in app_body
    log("eagle /me/applications renders list", app_rows > 0, f"rows={app_rows}")
    log("applications contain seed type2 '全国算法竞赛二等奖'", has_seed_t2, "")
    page.screenshot(path=f"{SHOT_DIR}/04_me_applications.png")

    # /me/points
    page.goto(f"{BASE}/me/points", wait_until="networkidle")
    time.sleep(1.5)
    pts_body = page.inner_text("body")
    import re
    m = re.search(r"当前积分[^\d]*(\d+)", pts_body) or re.search(r"(\d+)\s*积分", pts_body)
    balance = m.group(1) if m else "?"
    log("eagle /me/points balance > 0", str(balance) != "?" and int(balance) > 0, f"balance={balance}")
    page.screenshot(path=f"{SHOT_DIR}/05_me_points.png")

    # ---------- SUPER ADMIN (fresh context) ----------
    ctx2 = browser.new_context(viewport={"width": 1440, "height": 900})
    page2 = ctx2.new_page()
    login(page2, "super@demo", "Demo1234!")
    log("super login", "login" not in page2.url, f"url={page2.url}")
    page2.screenshot(path=f"{SHOT_DIR}/06_super_login.png")

    # /admin/join
    page2.goto(f"{BASE}/admin/join", wait_until="networkidle")
    time.sleep(1.5)
    join_rows = page2.locator("tbody tr").count()
    join_body = page2.inner_text("body")
    has_demo_applicant = "演示申请人" in join_body
    log("/admin/join renders list", join_rows > 0, f"rows={join_rows}")
    log("/admin/join shows seed '演示申请人'", has_demo_applicant, "")
    page2.screenshot(path=f"{SHOT_DIR}/07_admin_join.png")

    # /admin/point-apps
    page2.goto(f"{BASE}/admin/point-apps", wait_until="networkidle")
    time.sleep(1.5)
    pa_rows = page2.locator("tbody tr").count()
    pa_body = page2.inner_text("body")
    log("/admin/point-apps renders pending apps", pa_rows > 0, f"rows={pa_rows}")
    page2.screenshot(path=f"{SHOT_DIR}/08_admin_point_apps.png")

    # /admin/dashboard
    page2.goto(f"{BASE}/admin/dashboard", wait_until="networkidle")
    time.sleep(2.5)
    dash_body = page2.inner_text("body")
    import re
    mj = re.search(r"待审加入\s*\((\d+)\)", dash_body)
    join_count = mj.group(1) if mj else "?"
    risk_badges = sum(1 for s in ["🟢", "🟡", "🔴"] if s in dash_body)
    log("/admin/dashboard 待审加入 >= 1", str(join_count) != "?" and int(join_count) >= 1, f"待审加入={join_count}")
    log("/admin/dashboard AI risk badges visible", risk_badges >= 1, f"badge_emojis_found={risk_badges}")
    page2.screenshot(path=f"{SHOT_DIR}/09_admin_dashboard.png")

    ctx2.close()
    browser.close()

print("\n===== SUMMARY =====")
fails = 0
for name, ok, detail in results:
    if not ok:
        fails += 1
print(f"{len(results) - fails}/{len(results)} passed, {fails} failed")
