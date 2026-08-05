# -*- coding: utf-8 -*-
"""Browser test: admin activity & course management pages of 雏英计划."""
import json
import re
import sys
from datetime import datetime, timedelta

import requests
from playwright.sync_api import expect, sync_playwright

BASE = "http://localhost:5173"
TS = datetime.now().strftime("%m%d%H%M%S")
ONLINE_TITLE = f"BT-线上活动-{TS}"
OFFLINE_TITLE = f"BT-线下活动-{TS}"
DRAFT_TITLE = f"BT-草稿活动-{TS}"
COURSE_TITLE = f"BT-课程-{TS}"
SHOT_DIR = r"D:\仓库\FunnyProjects\雏英官网\.agents\browser-test\screenshots"
PWD = "Demo1234!"

results = []
passed = []
failed = []


def check(name, cond, detail=""):
    if cond:
        passed.append(name)
        print(f"  [PASS] {name}" + (f" | {detail}" if detail else ""))
    else:
        failed.append(name)
        print(f"  [FAIL] {name}" + (f" | {detail}" if detail else ""))
    results.append((name, bool(cond), detail))


def row_of(page, title):
    return page.locator(f"tbody tr:has-text('{title}')").first


def seed_enroll(api_path, activity_id):
    s = requests.Session()
    r = s.post(BASE + "/api/auth/login",
               json={"email": "eagle@demo", "password": PWD}, timeout=10)
    assert r.ok, f"eagle login failed: {r.status_code} {r.text[:200]}"
    r = s.post(BASE + f"{api_path}/{activity_id}/enroll", timeout=10)
    return r


def future_start(days=1):
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        console_msgs, page_errors = [], []
        page.on("console", lambda m: console_msgs.append(
            f"{m.type}: {m.text[:200]}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)[:300]))

        def shot(name):
            page.screenshot(path=f"{SHOT_DIR}\\{name}.png", full_page=False)

        # ---------------- LOGIN ----------------
        print("\n== Login ==")
        page.goto(BASE + "/login", wait_until="domcontentloaded")
        page.fill("#login-account", "super@demo")
        page.fill("#login-password", PWD)
        page.click("button[type=submit]")
        page.wait_for_url(re.compile(r"/admin"), timeout=15000)
        check("login as super@demo lands on /admin",
              "/admin" in page.url, page.url)
        shot("01-admin-console")

        # ---------------- ACTIVITY LIST ----------------
        print("\n== Activity list ==")
        page.goto(BASE + "/admin/activities", wait_until="domcontentloaded")
        page.wait_for_selector("h1:has-text('活动管理')")
        check("activities page h1 活动管理", True)
        check("status filter exists (#act-status)", page.locator("#act-status").count() == 1)
        check("mode filter exists (#act-mode)", page.locator("#act-mode").count() == 1)
        opts = page.locator("#act-status option").all_inner_texts()
        check("status filter options", opts == ["全部", "草稿", "已发布", "已归档"], str(opts))
        opts = page.locator("#act-mode option").all_inner_texts()
        check("mode filter options", opts == ["全部", "线上", "线下"], str(opts))
        check('"新建活动" button', page.locator("a:has-text('新建活动')").count() >= 1)
        page.wait_for_selector("tbody tr")
        first_row = page.locator("tbody tr").first
        check("each row has 编辑 link", first_row.locator("a:has-text('编辑')").count() == 1)
        check("each row has 报名名单 link",
              first_row.locator("a:has-text('报名名单')").count() == 1)
        shot("02-activities-list")

        # ---------------- ONLINE ACTIVITY EDITOR ----------------
        print("\n== Online activity editor ==")
        page.click("a:has-text('新建活动')")
        page.wait_for_url(re.compile(r"/admin/activities/new"))
        page.wait_for_selector("h1:has-text('新建活动')")
        check("editor: title input #act-title", page.locator("#act-title").count() == 1)
        check("editor: description textarea #act-desc", page.locator("#act-desc").count() == 1)
        check("editor: mode select #act-mode", page.locator("#act-mode").count() == 1)
        mopts = page.locator("#act-mode option").all_inner_texts()
        check("editor mode options 线上/线下", mopts == ["线上", "线下"], str(mopts))
        check("default mode = online", page.locator("#act-mode").input_value() == "online")
        check("online mode: video UPLOAD (file input) visible",
              page.locator("input[type=file]").count() == 1)
        check("online mode: NO url text input (#act-image-url absent)",
              page.locator("#act-image-url").count() == 0)
        check("editor: start time #act-start", page.locator("#act-start").count() == 1)
        check("editor: end time #act-end", page.locator("#act-end").count() == 1)
        check("editor: point deadline #act-point-deadline",
              page.locator("#act-point-deadline").count() == 1)
        check("editor: target points #act-points", page.locator("#act-points").count() == 1)
        check('"存草稿" button', page.locator("button:has-text('存草稿')").count() == 1)
        check('"保存并发布" button', page.locator("button:has-text('保存并发布')").count() == 1)

        # mode switch to offline
        page.select_option("#act-mode", "offline")
        page.wait_for_selector("#act-image-url")
        check("offline mode: image URL input #act-image-url appears",
              page.locator("#act-image-url").count() == 1)
        check("offline mode: file input hidden",
              page.locator("input[type=file]").count() == 0)
        check("offline image input is type=url",
              page.locator("#act-image-url").get_attribute("type") == "url")
        page.select_option("#act-mode", "online")
        page.wait_for_selector("input[type=file]")
        check("switch back to online: file input returns",
              page.locator("input[type=file]").count() == 1)
        shot("03-activity-editor-online")

        # ---------------- CREATE ONLINE ACTIVITY ----------------
        print("\n== Create + publish online activity ==")
        page.fill("#act-title", ONLINE_TITLE)
        page.fill("#act-desc", f"自动化浏览器测试创建的线上活动 {TS}")
        page.fill("#act-start", future_start())
        page.fill("#act-end", "2030-01-01T00:00")
        page.fill("#act-point-deadline", "2030-01-01T00:00")
        page.fill("#act-points", "10")
        upload_ok = False
        with page.expect_response(lambda r: r.url.endswith("/api/admin/upload") and r.ok,
                                  timeout=15000) as resp_info:
            page.set_input_files("input[type=file]", r"D:\仓库\FunnyProjects\雏英官网\.agents\browser-test\test-video.mp4")
        resp = resp_info.value
        body = resp.json()
        upload_ok = resp.ok and body.get("url", "").startswith("/uploads/")
        check("video upload POST /api/admin/upload succeeds", upload_ok, str(body)[:120])
        page.wait_for_selector("video[src*='/uploads/']", timeout=10000)
        check("uploaded video preview <video> rendered", True)
        shot("04-activity-editor-video-uploaded")
        page.click("button:has-text('保存并发布')")
        page.wait_for_url(re.compile(r"/admin/activities/\d+/edit"), timeout=15000)
        online_id = int(re.search(r"/admin/activities/(\d+)/edit", page.url).group(1))
        check("publish navigates to edit page", f"/admin/activities/{online_id}/edit" in page.url)
        page.wait_for_selector("h1:has-text('编辑活动')")
        check("edit page title input keeps title",
              page.locator("#act-title").input_value() == ONLINE_TITLE)
        page.wait_for_selector("video[src*='/uploads/']", timeout=10000)
        check("saved video URL persists on reload (video preview)", True)
        shot("05-activity-published-edit")

        # ---------------- LIST VERIFY ONLINE ----------------
        page.goto(BASE + "/admin/activities", wait_until="domcontentloaded")
        page.wait_for_selector(f"tbody tr:has-text('{ONLINE_TITLE}')", timeout=10000)
        r = row_of(page, ONLINE_TITLE)
        cells = r.locator("td").all_inner_texts()
        check("online activity in list", True, " | ".join(cells))
        check("list shows 形式=线上", "线上" in cells[1], cells[1])
        check("list shows 发布状态=已发布", "已发布" in cells[3], cells[3])
        check("row has 报名名单 link", r.locator("a:has-text('报名名单')").count() == 1)
        shot("06-activities-list-after-online")

        # ---------------- OFFLINE ACTIVITY ----------------
        print("\n== Create + publish offline activity ==")
        page.click("a:has-text('新建活动')")
        page.wait_for_url(re.compile(r"/admin/activities/new"))
        page.wait_for_selector("h1:has-text('新建活动')")
        page.select_option("#act-mode", "offline")
        page.wait_for_selector("#act-image-url")
        page.fill("#act-title", OFFLINE_TITLE)
        page.fill("#act-desc", f"自动化浏览器测试创建的线下活动 {TS}")
        page.fill("#act-start", future_start())
        page.fill("#act-end", "2030-01-01T00:00")
        page.fill("#act-point-deadline", "2030-01-01T00:00")
        page.fill("#act-image-url", "https://example.com/photo.jpg")
        shot("07-activity-editor-offline")
        page.click("button:has-text('保存并发布')")
        page.wait_for_url(re.compile(r"/admin/activities/\d+/edit"), timeout=15000)
        offline_id = int(re.search(r"/admin/activities/(\d+)/edit", page.url).group(1))
        check("offline publish navigates to edit page", True)
        check("offline edit page keeps image URL",
              page.locator("#act-image-url").input_value() == "https://example.com/photo.jpg")
        page.goto(BASE + "/admin/activities", wait_until="domcontentloaded")
        page.wait_for_selector(f"tbody tr:has-text('{OFFLINE_TITLE}')", timeout=10000)
        cells = row_of(page, OFFLINE_TITLE).locator("td").all_inner_texts()
        check("offline activity in list, 形式=线下, 已发布",
              "线下" in cells[1] and "已发布" in cells[3], " | ".join(cells))

        # ---------------- DRAFT + list publish ----------------
        print("\n== Draft flow ==")
        page.click("a:has-text('新建活动')")
        page.wait_for_url(re.compile(r"/admin/activities/new"))
        page.fill("#act-title", DRAFT_TITLE)
        page.fill("#act-desc", "草稿测试")
        page.fill("#act-start", future_start())
        page.fill("#act-end", "2030-01-01T00:00")
        page.fill("#act-point-deadline", "2030-01-01T00:00")
        page.click("button:has-text('存草稿')")
        page.wait_for_url(re.compile(r"/admin/activities/\d+/edit"), timeout=15000)
        check("存草稿 creates draft and navigates", True)
        page.goto(BASE + "/admin/activities", wait_until="domcontentloaded")
        page.wait_for_selector(f"tbody tr:has-text('{DRAFT_TITLE}')", timeout=10000)
        cells = row_of(page, DRAFT_TITLE).locator("td").all_inner_texts()
        check("draft in list with 发布状态=草稿 and 发布 button",
              "草稿" in cells[3] and row_of(page, DRAFT_TITLE).locator("button:has-text('发布')").count() == 1,
              " | ".join(cells))

        # ---------------- FILTERS ----------------
        print("\n== Filters ==")
        page.select_option("#act-mode", "online")
        page.wait_for_timeout(800)
        visible_titles = page.locator("tbody tr").all_inner_texts()
        check("mode filter 线上: only online rows shown",
              all("线下" not in t for t in visible_titles) and len(visible_titles) > 0,
              f"{len(visible_titles)} rows")
        # NOTE: '全部' option is disabled in the DOM - cannot reset filters via
        # dropdown once chosen; must reload the page instead.
        page.goto(BASE + "/admin/activities", wait_until="domcontentloaded")
        page.wait_for_selector("tbody tr", timeout=10000)
        page.select_option("#act-status", "published")
        page.wait_for_timeout(800)
        visible_titles = page.locator("tbody tr").all_inner_texts()
        check("status filter 已发布: only published rows shown",
              all("已发布" in t for t in visible_titles) and len(visible_titles) > 0,
              f"{len(visible_titles)} rows")
        # ---------------- ENROLLMENTS ----------------
        print("\n== Activity enrollments ==")
        r = seed_enroll("/api/activities", online_id)
        check(f"seed eagle enrollment for activity {online_id}",
              r.ok, f"{r.status_code} {r.text[:120]}")
        page.goto(BASE + f"/admin/activities/{online_id}/enrollments",
                  wait_until="domcontentloaded")
        page.wait_for_function(
            f"document.querySelector('h1')?.textContent.includes('{ONLINE_TITLE}')",
            timeout=10000)
        h1 = page.locator("h1").inner_text()
        check("enrollments page shows activity title", h1 == ONLINE_TITLE, h1)
        page.wait_for_selector("tbody tr", timeout=10000)
        rows = page.locator("tbody tr").all_inner_texts()
        check("enrollments list shows enrolled user eagle@demo",
              any("eagle@demo" in t for t in rows), " | ".join(rows))
        page.wait_for_function(
            "[...document.querySelectorAll('p')].some(p => p.textContent.includes('共'))",
            timeout=10000)
        check("enrollments page shows count", True)
        shot("08-activity-enrollments")

        # ---------------- COURSE LIST ----------------
        print("\n== Course list ==")
        page.goto(BASE + "/admin/courses", wait_until="domcontentloaded")
        page.wait_for_selector("h1:has-text('课程管理')")
        check("courses page h1 课程管理", True)
        check("course list renders", page.locator("tbody tr").count() >= 0)
        page.wait_for_selector("tbody tr")
        cr = page.locator("tbody tr").first
        check("course row has 编辑 link", cr.locator("a:has-text('编辑')").count() == 1)
        check("course row has 学习名单 link", cr.locator("a:has-text('学习名单')").count() == 1)
        check('"新建课程" button', page.locator("a:has-text('新建课程')").count() == 1)
        shot("09-courses-list")

        # ---------------- COURSE EDITOR ----------------
        print("\n== Course editor ==")
        page.click("a:has-text('新建课程')")
        page.wait_for_url(re.compile(r"/admin/courses/new"))
        page.wait_for_selector("h1:has-text('新建课程')")
        check("course editor: title #course-title", page.locator("#course-title").count() == 1)
        check("course editor: description #course-desc", page.locator("#course-desc").count() == 1)
        check("course editor: video upload (file input)", page.locator("input[type=file]").count() == 1)
        check("course editor: cover #course-cover-url", page.locator("#course-cover-url").count() == 1)
        check("cover field is type=url (URL input, not upload)",
              page.locator("#course-cover-url").get_attribute("type") == "url")
        check('"存草稿"/"保存并发布" buttons',
              page.locator("button:has-text('存草稿')").count() == 1 and
              page.locator("button:has-text('保存并发布')").count() == 1)

        # ---------------- CREATE COURSE ----------------
        print("\n== Create + publish course ==")
        page.fill("#course-title", COURSE_TITLE)
        page.fill("#course-desc", f"自动化浏览器测试创建的课程 {TS}")
        with page.expect_response(lambda r: r.url.endswith("/api/admin/upload") and r.ok,
                                  timeout=15000) as resp_info:
            page.set_input_files("input[type=file]", r"D:\仓库\FunnyProjects\雏英官网\.agents\browser-test\test-video.mp4")
        body = resp_info.value.json()
        check("course video upload succeeds", body.get("url", "").startswith("/uploads/"),
              str(body)[:120])
        page.wait_for_selector("video[src*='/uploads/']", timeout=10000)
        page.fill("#course-cover-url", "https://example.com/cover.jpg")
        shot("10-course-editor-video-uploaded")
        page.click("button:has-text('保存并发布')")
        page.wait_for_url(re.compile(r"/admin/courses/\d+/edit"), timeout=15000)
        course_id = int(re.search(r"/admin/courses/(\d+)/edit", page.url).group(1))
        check("course publish navigates to edit page", True)
        page.wait_for_selector("video[src*='/uploads/']", timeout=10000)
        check("course video URL persists on reload", True)
        page.goto(BASE + "/admin/courses", wait_until="domcontentloaded")
        page.wait_for_selector(f"tbody tr:has-text('{COURSE_TITLE}')", timeout=10000)
        cells = row_of(page, COURSE_TITLE).locator("td").all_inner_texts()
        check("course in list with 有视频 tag + 已发布",
              "有视频" in cells[1] and "已发布" in cells[2], " | ".join(cells))
        shot("11-courses-list-after")

        # ---------------- COURSE ENROLLMENTS ----------------
        print("\n== Course enrollments ==")
        r = seed_enroll("/api/courses", course_id)
        check(f"seed eagle enrollment for course {course_id}",
              r.ok, f"{r.status_code} {r.text[:120]}")
        page.goto(BASE + f"/admin/courses/{course_id}/enrollments",
                  wait_until="domcontentloaded")
        page.wait_for_function(
            f"document.querySelector('h1')?.textContent.includes('{COURSE_TITLE}')",
            timeout=10000)
        check("course enrollments h1 = course title", page.locator("h1").inner_text() == COURSE_TITLE)
        page.wait_for_selector("tbody tr", timeout=10000)
        rows = page.locator("tbody tr").all_inner_texts()
        check("course 学习名单 shows eagle@demo", any("eagle@demo" in t for t in rows),
              " | ".join(rows))
        shot("12-course-enrollments")

        # ---------------- SUMMARY ----------------
        print("\n================ SUMMARY ================")
        print(f"PASSED: {len(passed)}  FAILED: {len(failed)}")
        if failed:
            print("FAILURES:")
            for n, c, d in results:
                if not c:
                    print(f"  - {n} | {d}")
        if console_msgs:
            print("\nConsole warnings/errors (first 10):")
            for m in console_msgs[:10]:
                print(f"  {m}")
        if page_errors:
            print("\nPage errors:")
            for e in page_errors[:10]:
                print(f"  {e}")
        browser.close()
        return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
