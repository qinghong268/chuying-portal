# -*- coding: utf-8 -*-
"""Browser tests for 雏英计划 activities & courses pages (guest + eagle login)."""
import os
import re
import time
import json as _json
import urllib.parse
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
SHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(SHOT_DIR, exist_ok=True)

issues = []


def issue(msg):
    print("  !! ISSUE:", msg)
    issues.append(msg)


def ok(msg):
    print("  ok:", msg)


def shot(page, name):
    path = os.path.join(SHOT_DIR, name + ".png")
    page.screenshot(path=path, full_page=True)
    print("  shot:", name)


def lifecycle_of(start_ms, end_ms, now=time.time() * 1000):
    if now < start_ms:
        return "报名中"
    if now <= end_ms:
        return "进行中"
    return "已结束"


def card_texts(page):
    """Return list of dicts for each card in the card grid."""
    grid = page.locator('div[class*="cardGrid"]')
    cards = grid.locator('a[class*="card"]')
    out = []
    for i in range(cards.count()):
        c = cards.nth(i)
        title = c.locator("h2").first.inner_text() if c.locator("h2").count() else ""
        tags = [t.inner_text() for t in c.locator('span[class*="tag"]').all()]
        descs = [d.inner_text() for d in c.locator('p[class*="cardDesc"]').all()]
        href = c.get_attribute("href")
        out.append({"title": title, "tags": tags, "descs": descs, "href": href})
    return out


def dismiss_notif(page):
    """The 学习提醒 modal (full-screen overlay, z-10000) blocks all clicks until
    dismissed. It can appear up to ~1s after login / any navigation as eagle.
    Wait for it, then click 知道了."""
    try:
        page.wait_for_selector('[role="dialog"][aria-label="学习提醒"]', timeout=3500)
    except Exception:
        return False
    if page.locator('[role="dialog"][aria-label="学习提醒"]').count():
        ok("notification modal appeared — dismissing")
        page.locator('[role="dialog"] button', has_text="知道了").first.click()
        page.wait_for_timeout(300)
        return True
    return False


def navigate_eagle(page, path):
    """goto + settle any notification modal."""
    page.goto(BASE + path, wait_until="networkidle")
    page.wait_for_timeout(1200)
    dismiss_notif(page)


def collect_console(page):
    errors = []
    non_guest_401 = []

    def on_console(msg):
        if msg.type == "error" and "Failed to load resource" not in msg.text:
            errors.append("console.error: " + msg.text)
        if msg.type == "warning" and "403" not in msg.text:
            errors.append("console.warn: " + msg.text)

    def on_pageerror(err):
        errors.append("pageerror: " + str(err))

    def on_response(resp):
        if resp.status >= 400 and "/api/auth/me" not in resp.url and "/vite" not in resp.url:
            non_guest_401.append(f"{resp.status} {resp.request.method} {resp.url}")

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    page.on("response", on_response)

    def finalize():
        for u in non_guest_401:
            errors.append(f"console: 401 for {u}")
        return errors

    return finalize


def check_layout(page):
    res = page.evaluate(
        """() => {
            const doc = document.documentElement;
            const overflow = doc.scrollWidth > doc.clientWidth + 1;
            const broken = [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
            return { overflow, scrollW: doc.scrollWidth, clientW: doc.clientWidth, broken };
        }"""
    )
    if res["overflow"]:
        issue(f"horizontal overflow: scrollWidth={res['scrollW']} > clientWidth={res['clientW']}")
    else:
        ok("no horizontal overflow")
    for src in res["broken"]:
        issue(f"broken image: {src}")


def now_ms():
    return int(time.time() * 1000)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        finalize = collect_console(page)

        # -------------------------------------------------------------
        # PART A: Activities list
        # -------------------------------------------------------------
        print("=== A. /activities (guest) ===")
        page.goto(BASE + "/activities", wait_until="networkidle")
        shot(page, "A1-activities-list")

        cards = card_texts(page)
        print("  card count:", len(cards))
        for c in cards:
            print("   -", c["title"], "|", c["tags"], "|", c["descs"][0] if c["descs"] else "")
        if len(cards) < 1:
            issue("activities list: no cards rendered")
        for c in cards:
            href = c["href"] or ""
            if not re.match(r"^/activities/\d+$", href):
                issue(f"activity card {c['title']} href={href} not a detail link")
            if not any(t in ("线上", "线下") for t in c["tags"]):
                issue(f"activity card {c['title']} missing mode badge")
            if not c["descs"]:
                issue(f"activity card {c['title']} missing date line")
        ok("cards render with title/mode badge/date, link to detail")

        page.select_option("#mode-filter", "online")
        page.wait_for_timeout(200)
        cards = card_texts(page)
        bad = [c["title"] for c in cards if "线下" in c["tags"]]
        ok(f"filter 形态=线上 -> {len(cards)} cards; offline leaked: {bad}")
        if bad:
            issue("mode filter online leaked offline cards")
        shot(page, "A2-filter-online")

        page.select_option("#mode-filter", "offline")
        page.wait_for_timeout(200)
        cards = card_texts(page)
        bad = [c["title"] for c in cards if "线上" in c["tags"]]
        ok(f"filter 形态=线下 -> {len(cards)} cards; online leaked: {bad}")
        if bad:
            issue("mode filter offline leaked online cards")

        page.select_option("#mode-filter", "all")

        acts = page.request.get(BASE + "/api/activities").json()["activities"]
        now = now_ms()
        expected = {}
        for a in acts:
            life = lifecycle_of(a["startAt"], a["endAt"], now)
            expected.setdefault(life, []).append(a["title"])
        print("  lifecycle map @ now:", {k: v for k, v in expected.items()})
        for opt, label in [("enrolling", "报名中"), ("ongoing", "进行中"), ("ended", "已结束")]:
            page.select_option("#status-filter", opt)
            page.wait_for_timeout(200)
            cards = card_texts(page)
            got = sorted(c["title"] for c in cards)
            exp = sorted(expected.get(label, []))
            ok(f"filter 状态={label} -> {len(cards)} cards: {got}")
            if got != exp:
                issue(f"status filter {label}: got {got}, expected {exp} (time-dependent)")
        page.select_option("#status-filter", "all")
        page.wait_for_timeout(200)

        page.fill("#activity-search", "工作坊")
        page.wait_for_timeout(200)
        cards = card_texts(page)
        ok(f"search 工作坊 -> {[c['title'] for c in cards]}")
        if [c["title"] for c in cards] != ["线下实践工作坊"]:
            issue(f"search 工作坊 expected [线下实践工作坊], got {[c['title'] for c in cards]}")
        page.fill("#activity-search", "zzz-no-such-keyword")
        page.wait_for_timeout(200)
        empty = page.locator('div[class*="empty"]')
        if empty.count() and empty.is_visible():
            ok("empty state shows: " + empty.inner_text())
        else:
            issue("empty state not shown for no-match search")
        shot(page, "A3-search-empty")
        page.fill("#activity-search", "")
        page.wait_for_timeout(200)

        page.locator('div[class*="cardGrid"] a[class*="card"]').first.click()
        page.wait_for_load_state("networkidle")
        if not re.search(r"/activities/\d+$", page.url):
            issue(f"card click did not navigate to detail: {page.url}")
        else:
            ok("clicked first card -> " + page.url)
        check_layout(page)

        # -------------------------------------------------------------
        # PART B: Activity detail /activities/1 (online, no videoUrl)
        # -------------------------------------------------------------
        print("=== B. /activities/1 (online) ===")
        page.goto(BASE + "/activities/1", wait_until="networkidle")
        shot(page, "B1-activity-1")

        bc = page.locator('p[class*="breadcrumb"]')
        if bc.count():
            t = bc.inner_text()
            ok("breadcrumb: " + t)
            if "活动" not in t or "线上入门讲座" not in t:
                issue(f"breadcrumb wrong: {t}")
        else:
            issue("breadcrumb missing")

        title = page.locator("h1").first
        if title.inner_text() != "线上入门讲座":
            issue(f"detail title wrong: {title.inner_text()}")
        else:
            ok("title OK")

        body = page.locator("body").inner_text()
        if "面向雏英的线上入门讲座" not in body:
            issue("description missing")
        if "时间：" not in body or "目标积分：10" not in body:
            issue("time/target points info missing")
        if "积分申请通道截止" not in body:
            issue("point apply deadline line missing")
        if "报名与积分规则摘要" not in body:
            issue("rules summary section missing")
        else:
            for rule in [
                "线上与线下：活动开始前可报名",
                "积分申请：活动结束后 24 小时内、且须在积分申请通道截止前可提交心得",
                "心得正文 300–1000 字",
            ]:
                if rule not in body:
                    issue(f"rules summary missing item: {rule}")
        ok("info list + rules summary present")

        cover = page.locator('div[class*="cover"]')
        if cover.count() and cover.is_visible():
            ok("media placeholder (cover div) rendered for online activity without videoUrl")
        else:
            issue("no media placeholder for online activity without videoUrl")

        login_link = page.locator('a[class*="btnPrimary"]', has_text="去登录")
        if login_link.count():
            href = login_link.first.get_attribute("href")
            ok("guest CTA href: " + str(href))
            if "/login?redirect=" not in href or "/activities/1" not in urllib.parse.unquote(href):
                issue(f"guest CTA missing redirect param: {href}")
        else:
            issue("guest CTA 去登录 missing (should show when logged out)")

        dl_text = page.locator("dl").inner_text()
        if "未登录" in dl_text:
            ok("side panel 我的状态=未登录")
        else:
            issue(f"side panel should say 未登录, got: {dl_text}")
        if "立即报名" in body:
            issue("guest sees 立即报名 button (should be hidden, only 去登录)")
        check_layout(page)

        # -------------------------------------------------------------
        # B2: /activities/5 online WITH videoUrl -> <video>
        # -------------------------------------------------------------
        print("=== B2. /activities/5 (online with videoUrl) ===")
        page.goto(BASE + "/activities/5", wait_until="networkidle")
        video = page.locator("video")
        if video.count() and video.first.is_visible():
            src = video.first.get_attribute("src")
            controls = video.first.get_attribute("controls")
            ok(f"video element renders: src={src}, controls={controls is not None}")
            if src != "https://example.com/video.mp4":
                issue(f"video src unexpected: {src}")
        else:
            issue("video player did not render for online activity with videoUrl")
        shot(page, "B2-activity-5-video")

        # -------------------------------------------------------------
        # B3: offline activity image rendering (seed data has no imageUrl)
        # -------------------------------------------------------------
        print("=== B3. offline activity image rendering ===")
        admin = browser.new_context(viewport={"width": 1440, "height": 900})
        ap = admin.new_page()
        ap.request.post(
            BASE + "/api/auth/demo-login",
            data=_json.dumps({"role": "admin"}),
            headers={"Content-Type": "application/json"},
        )
        stamp = time.strftime("%m%d%H%M%S")
        start = now_ms() + 10 * 86400 * 1000
        resp = ap.request.post(
            BASE + "/api/admin/activities",
            data=_json.dumps({
                "title": f"BT图片活动-{stamp}",
                "description": "浏览器测试：验证线下活动图片渲染",
                "mode": "offline",
                "startAt": start,
                "endAt": start + 86400 * 1000,
                "pointApplyDeadline": start + 2 * 86400 * 1000,
                "targetPoints": 5,
                "imageUrl": "/uploads/test-img-1.svg",
                "status": "published",
                "featured": False,
            }),
            headers={"Content-Type": "application/json"},
        )
        created = resp.json()
        new_id = created["activity"]["id"]
        ok(f"created offline activity id={new_id}")

        page.goto(BASE + f"/activities/{new_id}", wait_until="networkidle")
        img = page.locator('img[class*="coverImage"]')
        if img.count() and img.first.is_visible():
            src = img.first.get_attribute("src")
            ok("offline detail shows image: " + str(src))
            if src != "/uploads/test-img-1.svg":
                issue(f"image src unexpected: {src}")
        else:
            issue("offline activity detail did not render image (imageUrl set but no <img>)")
        shot(page, "B3-offline-with-image")
        check_layout(page)

        page.goto(BASE + "/activities/2", wait_until="networkidle")
        body2 = page.locator("body").inner_text()
        if "线下实践工作坊" in body2:
            ok("/activities/2 offline detail loads")
        if page.locator("video").count() == 0 and page.locator('div[class*="cover"]').count():
            ok("/activities/2: cover placeholder (seed has no imageUrl)")
        shot(page, "B4-activity-2-offline")

        ap.request.put(
            BASE + f"/api/admin/activities/{new_id}",
            data=_json.dumps({"status": "archived"}),
            headers={"Content-Type": "application/json"},
        )

        # -------------------------------------------------------------
        # PART C: Courses list
        # -------------------------------------------------------------
        print("=== C. /courses ===")
        page.goto(BASE + "/courses", wait_until="networkidle")
        shot(page, "C1-courses-list")
        cards = card_texts(page)
        print("  course count:", len(cards))
        for c in cards:
            print("   -", c["title"])
        if len(cards) < 1:
            issue("courses list: no cards rendered")
        for c in cards:
            if not re.match(r"^/courses/\d+$", c["href"] or ""):
                issue(f"course card {c['title']} href wrong: {c['href']}")
        page.fill("#course-search", "Python")
        page.wait_for_timeout(200)
        cards = card_texts(page)
        ok(f"search Python -> {[c['title'] for c in cards]}")
        if [c["title"] for c in cards] != ["Python数据分析"]:
            issue(f"course search Python expected [Python数据分析], got {[c['title'] for c in cards]}")
        page.fill("#course-search", "没有的课程xyz")
        page.wait_for_timeout(200)
        if page.locator('div[class*="empty"]').count() and page.locator('div[class*="empty"]').is_visible():
            ok("courses empty state shows")
        else:
            issue("courses empty state missing")
        page.fill("#course-search", "")
        check_layout(page)

        # -------------------------------------------------------------
        # PART D: Course detail /courses/1
        # -------------------------------------------------------------
        print("=== D. /courses/1 ===")
        page.goto(BASE + "/courses/1", wait_until="networkidle")
        shot(page, "D1-course-1")
        body = page.locator("body").inner_text()
        if "雏英成长第一课" not in body:
            issue("course detail title missing")
        if "介绍雏英计划的学习路径与基本要求" not in body:
            issue("course description missing")
        if "学习进度达到 99%" not in body:
            issue("course progress threshold note missing (99%)")
        if "课程说明" not in body:
            issue("course 课程说明 section missing")
        if page.locator("video").count():
            ok("video rendered")
        elif page.locator('div[class*="cover"]').count() and page.locator('div[class*="cover"]').is_visible():
            ok("course 1: cover placeholder (no videoUrl/coverUrl in seed)")
        login_link = page.locator('a[class*="btnPrimary"]', has_text="去登录")
        if login_link.count():
            href = login_link.first.get_attribute("href")
            ok("guest CTA: " + str(href))
            if "/login?redirect=" not in href or "/courses/1" not in urllib.parse.unquote(href):
                issue(f"course guest CTA missing redirect: {href}")
        else:
            issue("course detail guest CTA missing")
        if "未登录" in page.locator("dl").inner_text():
            ok("course side 我的状态=未登录")
        else:
            issue("course side should say 未登录 for guest")
        if page.locator("#course-progress-input").count():
            issue("guest sees progress editor (should require login+enroll)")
        check_layout(page)

        page.goto(BASE + "/courses/4", wait_until="networkidle")
        video = page.locator("video")
        if video.count() and video.first.is_visible():
            ok("course 4 renders video (videoUrl takes precedence over coverUrl): " + str(video.first.get_attribute("src")))
        else:
            issue("course 4 video did not render")
        shot(page, "D2-course-4-video")

        cresp = ap.request.post(
            BASE + "/api/admin/courses",
            data=_json.dumps({
                "title": f"BT封面课程-{stamp}",
                "description": "浏览器测试：验证课程封面图片渲染",
                "coverUrl": "/uploads/test-img-2.svg",
                "status": "published",
                "featured": False,
            }),
            headers={"Content-Type": "application/json"},
        )
        ccreated = cresp.json()
        cid = ccreated["course"]["id"]
        ok(f"created cover-only course id={cid}")
        page.goto(BASE + f"/courses/{cid}", wait_until="networkidle")
        img = page.locator('img[class*="coverImage"]')
        if img.count() and img.first.is_visible():
            ok("course cover image renders: " + str(img.first.get_attribute("src")))
        else:
            issue("course with coverUrl only did not render cover image")
        shot(page, "D3-course-cover-only")
        ap.request.put(
            BASE + f"/api/admin/courses/{cid}",
            data=_json.dumps({"status": "archived"}),
            headers={"Content-Type": "application/json"},
        )
        admin.close()

        # -------------------------------------------------------------
        # PART E: guest CTA redirect flow + demo login as eagle + enroll
        # -------------------------------------------------------------
        print("=== E. guest CTA redirect flow ===")
        page.goto(BASE + "/activities/1", wait_until="networkidle")
        page.locator('a[class*="btnPrimary"]', has_text="去登录").first.click()
        page.wait_for_load_state("networkidle")
        if "/login" in page.evaluate("location.href") and "redirect=" in page.evaluate("location.href"):
            ok("guest CTA -> login with redirect param: " + page.evaluate("location.href"))
        else:
            issue("guest CTA redirect wrong: " + page.evaluate("location.href"))

        print("=== E2. demo login as 雏英 ===")
        role_card = page.locator('button[class*="roleCard"]', has_text="雏英").first
        if not role_card.count():
            issue("demo login card for 雏英 not found")
        else:
            role_card.click()
            try:
                page.wait_for_function("location.pathname !== '/login'", timeout=15000)
                ok("after demo login pathname: " + page.evaluate("location.pathname"))
                if page.evaluate("location.pathname") != "/activities/1":
                    issue(f"after demo login expected /activities/1, got {page.evaluate('location.href')}")
            except Exception:
                issue(f"demo login did not navigate away from /login (href={page.evaluate('location.href')})")
        dismiss_notif(page)
        shot(page, "E1-after-login-activity-1")

        if page.locator("#progress-input").count():
            ok("progress editor visible for enrolled eagle (online activity)")
            # save 50 then restore to previous value
            prev_prog = page.request.get(BASE + "/api/activities/1").json()["activity"].get("progressPercent")
            page.fill("#progress-input", "50")
            page.locator("button", has_text="保存进度").first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(600)
            body = page.locator("body").inner_text()
            if "进度已更新" in body and "50%" in body:
                ok("activity progress save -> 进度已更新, shows 50%")
            else:
                issue(f"activity progress save result unexpected: 进度已更新={'进度已更新' in body}, 50%={'50%' in body}")
            if prev_prog is not None:
                page.fill("#progress-input", str(prev_prog))
                page.locator("button", has_text="保存进度").first.click()
                page.wait_for_load_state("networkidle")
        else:
            issue("progress editor missing for enrolled eagle on online activity")
        shot(page, "E2-activity-enrolled-progress")

        # enroll in a fresh activity
        acts = page.request.get(BASE + "/api/activities").json()["activities"]
        target = None
        for a in acts:
            d = page.request.get(BASE + f"/api/activities/{a['id']}").json()["activity"]
            if not d.get("enrolled") and d.get("canEnroll"):
                target = d
                break
        if target is None:
            ok("no enrollable activity — creating a fresh activity via admin API")
            admin2 = browser.new_context(viewport={"width": 1440, "height": 900})
            ap2 = admin2.new_page()
            ap2.request.post(
                BASE + "/api/auth/demo-login",
                data=_json.dumps({"role": "admin"}),
                headers={"Content-Type": "application/json"},
            )
            astart = now_ms() + 20 * 86400 * 1000
            aresp = ap2.request.post(
                BASE + "/api/admin/activities",
                data=_json.dumps({
                    "title": f"BT报名活动-{stamp}",
                    "description": "浏览器测试：验证活动报名",
                    "mode": "online",
                    "startAt": astart,
                    "endAt": astart + 86400 * 1000,
                    "pointApplyDeadline": astart + 2 * 86400 * 1000,
                    "targetPoints": 5,
                    "status": "published",
                    "featured": False,
                }),
                headers={"Content-Type": "application/json"},
            )
            target = aresp.json()["activity"]
            target["fallback_id"] = target["id"]
            ok(f"created activity id={target['id']}")
            ap2.close()
            admin2.close()
        if target is not None:
            tid = target["id"]
            ok(f"enroll target: /activities/{tid} ({target['title']})")
            navigate_eagle(page, f"/activities/{tid}")
            btn = page.locator("button", has_text="立即报名")
            if btn.count():
                if btn.first.is_disabled():
                    issue(f"立即报名 disabled for activity {tid} though API says canEnroll")
                else:
                    btn.first.click()
                    page.wait_for_load_state("networkidle")
                    got_ui = False
                    for _ in range(40):
                        if "已报名" in page.locator("dl").inner_text():
                            got_ui = True
                            break
                        time.sleep(0.2)
                    body = page.locator("body").inner_text()
                    if "报名成功" in body:
                        ok("enroll -> 报名成功")
                    else:
                        issue(f"enroll click: 报名成功 message not visible; body: {body[-400:]}")
                    if got_ui:
                        ok("side panel 已报名 after enroll")
                    else:
                        issue("side panel did not turn 已报名 after enroll")
                shot(page, "E3-activity-enrolled")
            else:
                issue(f"立即报名 button missing for eagle on /activities/{tid}")
            detail = page.request.get(BASE + f"/api/activities/{tid}").json()["activity"]
            if detail.get("enrolled"):
                ok("enroll persisted server-side (API enrolled=true)")
            else:
                issue("API shows enrolled=false after enroll click")
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(1200)
            dismiss_notif(page)
            if "已报名" in page.locator("dl").inner_text():
                ok("enroll persists across reload")
            else:
                issue("enroll did not persist after reload")

        # course enroll
        courses = page.request.get(BASE + "/api/courses").json()["courses"]
        ctarget = None
        for c in courses:
            d = page.request.get(BASE + f"/api/courses/{c['id']}").json()["course"]
            if not d.get("enrolled"):
                ctarget = d
                break
        if ctarget is None:
            ok("no unenrolled course — creating a fresh course via admin API")
            admin2 = browser.new_context(viewport={"width": 1440, "height": 900})
            ap2 = admin2.new_page()
            ap2.request.post(
                BASE + "/api/auth/demo-login",
                data=_json.dumps({"role": "admin"}),
                headers={"Content-Type": "application/json"},
            )
            cresp = ap2.request.post(
                BASE + "/api/admin/courses",
                data=_json.dumps({
                    "title": f"BT报名课程-{stamp}",
                    "description": "浏览器测试：验证课程报名",
                    "status": "published",
                    "featured": False,
                }),
                headers={"Content-Type": "application/json"},
            )
            ctarget = cresp.json()["course"]
            ctarget["fallback_id"] = ctarget["id"]
            ok(f"created course id={ctarget['id']}")
            ap2.close()
            admin2.close()
        if ctarget is not None:
            cid = ctarget["id"]
            ok(f"course enroll target: /courses/{cid} ({ctarget['title']})")
            navigate_eagle(page, f"/courses/{cid}")
            btn = page.locator("button", has_text="报名学习")
            if btn.count():
                btn.first.click()
                page.wait_for_load_state("networkidle")
                got_ui = False
                for _ in range(40):
                    if "已报名" in page.locator("dl").inner_text():
                        got_ui = True
                        break
                    time.sleep(0.2)
                body = page.locator("body").inner_text()
                if "报名成功，开始学习吧" in body:
                    ok("course enroll -> 报名成功，开始学习吧")
                else:
                    issue(f"course enroll: success message not visible; body tail: {body[-300:]}")
                if got_ui:
                    ok("course side 已报名 after enroll")
                else:
                    issue("course side did not turn 已报名 after enroll")
            else:
                issue("报名学习 button missing for eagle")
            editor = False
            for _ in range(40):
                if page.locator("#course-progress-input").count():
                    editor = True
                    break
                time.sleep(0.2)
            if editor:
                ok("course progress editor visible after enroll")
                page.fill("#course-progress-input", "80")
                page.locator("button", has_text="保存进度").first.click()
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(800)
                body = page.locator("body").inner_text()
                if "进度已更新" in body and "80%" in body:
                    ok("course progress save OK, shows 80%")
                else:
                    issue(f"course progress save unexpected: {'进度已更新' in body}")
                shot(page, "E4-course-enrolled-progress")
            else:
                issue("course progress editor missing after enroll")

        # course 1: enrolled + 99% progress -> reflection CTA should show
        page.request.put(
            BASE + "/api/courses/1/progress",
            data=_json.dumps({"percent": 99}),
            headers={"Content-Type": "application/json"},
        )
        navigate_eagle(page, "/courses/1")
        body = page.locator("body").inner_text()
        if "申请课程心得积分" in body:
            ok("course 1 (progress 99%): 申请课程心得积分 CTA shows")
        else:
            issue("course 1 (99%) should show 申请课程心得积分 CTA")
        if "学习进度" in body and "99%" in body:
            ok("course 1 progress display shows 学习进度 99%")
        else:
            issue(f"course 1 progress display wrong (body): 学习进度={'学习进度' in body}, 99%={'99%' in body}")
        shot(page, "E5-course-1-progress-99")

        check_layout(page)

        # cleanup fallback-created artifacts (archive)
        fallback_ids = []
        if target is not None and target.get("fallback_id"):
            fallback_ids.append(("activities", target["fallback_id"]))
        if ctarget is not None and ctarget.get("fallback_id"):
            fallback_ids.append(("courses", ctarget["fallback_id"]))
        if fallback_ids:
            aclean = browser.new_context(viewport={"width": 800, "height": 600})
            apc = aclean.new_page()
            apc.request.post(
                BASE + "/api/auth/demo-login",
                data=_json.dumps({"role": "admin"}),
                headers={"Content-Type": "application/json"},
            )
            for kind, fid in fallback_ids:
                r = apc.request.put(
                    BASE + f"/api/admin/{kind}/{fid}",
                    data=_json.dumps({"status": "archived"}),
                    headers={"Content-Type": "application/json"},
                )
                ok(f"archived fallback {kind[:-1]} {fid}: HTTP {r.status}")
            aclean.close()

        print("=" * 60)
        print("CONSOLE/PAGE ERRORS:")
        errors = finalize()
        uniq = sorted(set(errors))
        if uniq:
            for e in uniq:
                print("  -", e)
                issues.append("console: " + e)
        else:
            print("  none")
        print("=" * 60)
        print(f"TOTAL ISSUES: {len(issues)}")
        for i, it in enumerate(issues, 1):
            print(f"  {i}. {it}")
        browser.close()


if __name__ == "__main__":
    main()
