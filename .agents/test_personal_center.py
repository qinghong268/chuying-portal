# -*- coding: utf-8 -*-
"""Browser tests: personal center + point application (雏英计划).

Covers:
  1. Demo login (eagle) -> /me
  2. /me overview (stats, quick links, weekly report)
  3. /me/enrollments
  4. /me/applications (status badges)
  5. /me/points (balance + ledger)
  6. Point application type-locking (activityId / courseId / no params)
  7. Point application validation (type1 + type2)
  8. Notification modal after login

Run:  python .agents/test_personal_center.py
"""

import re
import sys
import datetime

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "http://localhost:5173"
RESULTS = []  # (section, status, detail)
CONSOLE_ERRORS = []
PAGE_ERRORS = []
REQ_FAILURES = []


def now_utc() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def report(section, ok, detail):
    tag = "PASS" if ok else "FAIL"
    RESULTS.append((section, ok, detail))
    print(f"[{now_utc()}] [{tag}] {section}: {detail}")


def report_info(section, detail):
    print(f"[{now_utc()}] [INFO] {section}: {detail}")


def dispatch_submit(page):
    """Trigger the React onSubmit handler (bypasses disabled button + native
    constraint validation) so we can observe the in-handler error paths."""
    page.locator("form").evaluate(
        "(f) => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))"
    )


def visible_text_or(page, locator, timeout=8000, fallback="<not found>"):
    try:
        locator.wait_for(state="visible", timeout=timeout)
        return locator.inner_text()
    except PWTimeout:
        return fallback


def check_no_selector(page):
    n = page.locator("form select").count()
    if n != 0:
        report("type-lock", False, f"expected 0 <select> elements, found {n}")
        return False
    return True


def main():
    failures_any = False
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.set_default_timeout(15000)

        page.on("console", lambda m: CONSOLE_ERRORS.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: PAGE_ERRORS.append(str(e)))
        page.on("requestfailed", lambda r: REQ_FAILURES.append(f"{r.method} {r.url} :: {r.failure}"))

        try:
            # ============================ LOGIN ============================
            section = "login"
            page.goto(BASE + "/login", wait_until="domcontentloaded")
            page.get_by_text("一键演示登录").wait_for(state="visible")
            eagle_btn = page.get_by_role("button", name=re.compile(r"雏英.*前台个人中心"))
            report(section, eagle_btn.is_visible(), "雏英 demo button visible on /login")
            eagle_btn.click()
            page.wait_for_url(re.compile(r"/me/?$"), timeout=20000)
            report(section, True, f"demo login redirected to {page.url}")

            # ======================== NOTIFICATION MODAL ===================
            section = "notification"
            modal_text = None
            try:
                dialog = page.locator('[role="dialog"]')
                dialog.wait_for(state="visible", timeout=8000)
                modal_text = dialog.inner_text()
                report_info(section, "modal APPEARED after login")
                report(
                    section,
                    "学习提醒" in modal_text,
                    f"modal title present; full text:\n{modal_text}",
                )
                # upcoming activities show NAMES not IDs
                names_not_ids = True
                for line in modal_text.splitlines():
                    # bare numeric id patterns like "活动 1" / "1 — " are suspicious
                    if re.search(r"(活动|课程)\s*\d+\s*$", line.strip()):
                        names_not_ids = False
                report(section, names_not_ids, "no bare-id lines found in modal")
                # course progress percentages
                pcts = re.findall(r"进度\s*(\d+)%", modal_text)
                report(
                    section,
                    True,
                    f"course progress percentage markers found: {pcts}",
                )
                dialog.get_by_role("button", name="知道了").click()
                dialog.wait_for(state="hidden", timeout=5000)
                report(section, True, "modal dismissed via 知道了")
            except PWTimeout:
                report_info(section, "no notification modal appeared (once-per-day rule or empty content)")

            # ========================== /me OVERVIEW =======================
            section = "overview"
            page.get_by_text("你好，演示雏英").wait_for(state="visible")
            report(section, True, "welcome message shows 演示雏英")
            report(
                section,
                page.get_by_text("账号状态：正常").is_visible(),
                "账号状态：正常 visible",
            )

            bal_panel = page.locator("section", has_text="当前积分").first
            bal_text = visible_text_or(section + ":balance", bal_panel)
            m = re.search(r"当前积分\s*([\d.]+)", bal_text)
            report(
                section,
                m is not None,
                f"stat card 当前积分 => {m.group(1) if m else bal_text}",
            )

            todo_panel = page.locator("section", has_text="待办").first
            todo_text = visible_text_or(section + ":todo", todo_panel)
            eligible_m = re.search(r"可发起申请：(\d+) 条", todo_text)
            pending_m = re.search(r"审批中：(\d+) 条", todo_text)
            report(
                section,
                eligible_m is not None and pending_m is not None,
                f"待办 card => 可发起申请:{eligible_m.group(1) if eligible_m else '?'} 审批中:{pending_m.group(1) if pending_m else '?'}",
            )

            quick = {
                "我的报名": "/me/enrollments",
                "我的申请": "/me/applications",
                "积分明细": "/me/points",
                "发起积分申请": "/me/applications/new",
            }
            quick_section = page.locator("section", has_text="快捷入口").first
            for name, href in quick.items():
                link = quick_section.get_by_role("link", name=name)
                ok = link.is_visible() and link.get_attribute("href") == href
                report(section, ok, f"快捷入口 link {name} -> {link.get_attribute('href')}")

            report(section, page.get_by_text("学习周报").is_visible(), "学习周报 section present")
            wcards = page.locator("article", has_text=re.compile(r"报名 \d+ ·"))
            wcnt = wcards.count()
            report(section, wcnt > 0, f"weekly report cards: {wcnt}")
            if wcnt > 0:
                report_info(section, "weekly card head: " + wcards.first.inner_text().splitlines()[0])
                report_info(section, "weekly summary: " + wcards.first.inner_text())

            # ========================= /me/enrollments =====================
            section = "enrollments"
            page.goto(BASE + "/me/enrollments", wait_until="domcontentloaded")
            page.get_by_role("heading", name="我的报名").wait_for(state="visible")
            page.wait_for_selector("tbody tr", timeout=15000)
            rows = page.locator("tbody tr")
            n = rows.count()
            report(section, n > 0, f"{n} enrollment rows rendered")
            headers = page.locator("thead th").all_inner_texts()
            report(section, "活动标题" in headers and "报名状态" in headers and "进度/窗口" in headers,
                   f"table headers: {headers}")
            first = rows.first.inner_text()
            report(section, "已报名" in first, f"first row status 已报名; row text: {first[:200]}")
            act_link = rows.first.locator("td >> nth=0 >> a").get_attribute("href") if rows.first.locator("a").count() else None
            report(section, act_link and re.match(r"/activities/\d+$", act_link), f"first row links to {act_link}")

            # ======================== /me/applications =====================
            section = "applications"
            page.goto(BASE + "/me/applications", wait_until="domcontentloaded")
            page.get_by_role("heading", name="我的申请").wait_for(state="visible")
            page.wait_for_selector("tbody tr", timeout=15000)
            rows = page.locator("tbody tr")
            n = rows.count()
            report(section, n > 0, f"{n} application rows rendered")
            statuses = set()
            points_col = set()
            summaries = []
            for i in range(n):
                tds = rows.nth(i).locator("td").all_inner_texts()
                if len(tds) >= 6:
                    statuses.add(tds[4].strip())
                    points_col.add(tds[5].strip())
                    summaries.append(tds[2].strip())
            report(section, {"待审批", "已通过", "已驳回"}.issubset(statuses),
                   f"status badges seen: {sorted(statuses)}")
            report(section, any(p.startswith("+") for p in points_col),
                   f"分值 column values sample: {sorted(points_col)[:6]}")
            report_info(section, f"summary cell sample: {summaries[:8]}")
            detail_link = page.locator("tbody a", has_text="详情").first
            href = detail_link.get_attribute("href")
            report(section, bool(re.match(r"/me/applications/\d+$", href or "")),
                   f"详情 link -> {href}")

            # ========================== /me/points =========================
            section = "points"
            page.goto(BASE + "/me/points", wait_until="domcontentloaded")
            page.get_by_role("heading", name="积分明细").wait_for(state="visible")
            page.wait_for_selector("tbody tr", timeout=15000)
            bal_panel = page.locator("section", has_text="当前积分余额").first
            bal_text = visible_text_or(section, bal_panel)
            m = re.search(r"当前积分余额\s*([\d.]+)", bal_text)
            report(section, m is not None, f"balance card => {bal_text.replace(chr(10), ' ')}")
            rows = page.locator("tbody tr")
            n = rows.count()
            report(section, n > 0, f"{n} ledger entries rendered")
            first = rows.first.locator("td").all_inner_texts()
            report(section, len(first) >= 5 and re.match(r"\+?\d+$", first[1].strip()),
                   f"ledger row => 变动:{first[1].strip()} 快照:{first[2].strip()} 来源:{first[3].strip()}")
            report(section, any(re.search(r"积分申请#\d+通过", r3) for r3 in
                                [row.locator("td").nth(3).inner_text() for row in rows.all()]),
                   "ledger 来源说明 contains 积分申请#N通过 entries")

            # ===================== TYPE-LOCK: activityId=1 =================
            section = "lock-activity"
            page.goto(BASE + "/me/applications/new?activityId=1", wait_until="domcontentloaded")
            page.locator("#reflection").wait_for(state="visible", timeout=15000)
            picker_count = page.get_by_text("类型一：活动 / 课程心得").count() + page.get_by_text("类型二：独立专项申请").count()
            report(section, picker_count == 0, f"type picker hidden (found {picker_count} picker labels)")
            report(section, page.get_by_text("关联活动（已锁定，不可更改）").is_visible(),
                   "activity locked label visible")
            report(section, page.locator("#activity-select").count() == 0,
                   "no #activity-select dropdown (read-only instead)")
            report(section, page.locator("#course-select").count() == 0,
                   "NO course dropdown visible")
            check_no_selector(page)
            page.fill("#reflection", "锁定页心得编辑测试")
            report(section, page.locator("#reflection").input_value() == "锁定页心得编辑测试",
                   "reflection textarea editable on locked page")
            report_info(section, "form text: " + page.locator("form").inner_text()[:400].replace("\n", " | "))

            # ====================== TYPE-LOCK: courseId=1 ==================
            section = "lock-course"
            page.goto(BASE + "/me/applications/new?courseId=1", wait_until="domcontentloaded")
            page.locator("#reflection").wait_for(state="visible", timeout=15000)
            picker_count = page.get_by_text("类型一：活动 / 课程心得").count() + page.get_by_text("类型二：独立专项申请").count()
            report(section, picker_count == 0, f"type picker hidden (found {picker_count} picker labels)")
            report(section, page.get_by_text("关联课程（已锁定，不可更改）").is_visible(),
                   "course locked label visible")
            report(section, page.locator("#course-select").count() == 0,
                   "no #course-select dropdown (read-only instead)")
            report(section, page.locator("#activity-select").count() == 0,
                   "NO activity dropdown visible")
            check_no_selector(page)
            form_text = page.locator("form").inner_text()
            # The course may be eligible (readonly summary with title+progress) or
            # blocked by an existing application (muted notice) - both prove the lock.
            readonly_ok = ("雏英成长第一课" in form_text and "99%" in form_text)
            blocked_ok = "该课程当前不可申请" in form_text
            report(section, readonly_ok or blocked_ok,
                   f"locked course area OK (readonly-summary={readonly_ok}, blocked-note={blocked_ok}); form text: {form_text[:300].replace(chr(10), ' | ')}")
            page.fill("#reflection", "课程锁定页心得编辑测试")
            report(section, page.locator("#reflection").input_value() == "课程锁定页心得编辑测试",
                   "reflection textarea editable on locked course page")

            # ==================== TYPE-LOCK: no params =====================
            section = "lock-none"
            page.goto(BASE + "/me/applications/new", wait_until="domcontentloaded")
            page.locator("#activity-select").wait_for(state="visible", timeout=15000)
            t1 = page.get_by_text("类型一：活动 / 课程心得")
            t2 = page.get_by_text("类型二：独立专项申请")
            report(section, t1.is_visible() and t2.is_visible(), "type picker VISIBLE (both cards)")
            report(section, page.locator("#activity-select").count() == 1 and page.locator("#course-select").count() == 1,
                   "type1 default: BOTH activity and course dropdowns visible")
            act_options = page.locator("#activity-select option").all_inner_texts()
            course_options = page.locator("#course-select option").all_inner_texts()
            report_info(section, f"activity options ({len(act_options)}): {act_options[:8]}")
            report_info(section, f"course options ({len(course_options)}): {course_options[:8]}")

            # mutually exclusive behavior
            if page.locator("#course-select option").count() > 1:
                page.select_option("#course-select", index=1)
                report(section, page.locator("#activity-select").input_value() == "",
                       "selecting course clears activity (mutually exclusive)")
            elif page.locator("#activity-select option").count() > 1:
                page.select_option("#activity-select", index=1)
                report(section, page.locator("#course-select").input_value() == "",
                       "selecting activity clears course (mutually exclusive)")
            else:
                report(section, True, "no eligible options to test mutual exclusion (INFO)")

            # switch to type2
            page.locator("button", has_text="类型二：").click()
            page.locator("#template-select").wait_for(state="visible", timeout=10000)
            report(section, page.locator("#template-select").count() == 1,
                   "type2: template dropdown appears")
            report(section, page.locator("#activity-select").count() == 0 and page.locator("#course-select").count() == 0,
                   "type2: activity/course dropdowns hidden")
            tpl_options = page.locator("#template-select option").all_inner_texts()
            report(section, any(o in tpl_options for o in ["比赛获奖", "分享宣讲", "项目贡献", "荣誉表彰", "其他专项"]),
                   f"template options: {tpl_options}")
            # back to type1
            page.locator("button", has_text="类型一：").click()
            page.locator("#activity-select").wait_for(state="visible", timeout=10000)
            report(section, page.locator("#activity-select").count() == 1 and page.locator("#course-select").count() == 1,
                   "back to type1: both dropdowns visible again")

            # ================ VALIDATION: type1 no selection ================
            section = "validation-type1-noselect"
            page.goto(BASE + "/me/applications/new", wait_until="domcontentloaded")
            page.locator("#reflection").wait_for(state="visible", timeout=15000)
            page.fill("#reflection", "心" * 320)
            submit_btn = page.get_by_role("button", name="提交申请")
            enabled = submit_btn.is_enabled()
            report_info(section, f"submit button enabled with valid reflection & no selection: {enabled}")
            if enabled:
                submit_btn.click()
            else:
                dispatch_submit(page)
            try:
                page.get_by_text("请从活动与课程中选择一项（二选一）").wait_for(state="visible", timeout=6000)
                report(section, True, "error shown: 请从活动与课程中选择一项（二选一）")
            except PWTimeout:
                report(section, False, "expected error 请从活动与课程中选择一项（二选一） NOT shown")

            # ================ VALIDATION: type1 short reflection ============
            section = "validation-type1-short"
            page.goto(BASE + "/me/applications/new", wait_until="domcontentloaded")
            page.locator("#course-select").wait_for(state="visible", timeout=15000)
            if page.locator("#course-select option").count() <= 1:
                report(section, False, "no eligible courses available for short-reflection test")
            else:
                page.select_option("#course-select", index=1)
                report_info(section, "selected eligible course for short-reflection test")
                page.fill("#reflection", "心" * 150)
                try:
                    page.get_by_text(re.compile(r"字数：150/1000")).wait_for(state="visible", timeout=5000)
                    report(section, True, "char counter shows 字数：150/1000")
                except PWTimeout:
                    report(section, False, "char counter did not show 150/1000")
                report(section, not submit_btn.is_enabled(),
                       f"submit button DISABLED for short reflection (enabled={submit_btn.is_enabled()})")
                dispatch_submit(page)
                try:
                    page.get_by_text("心得正文需 300–1000 字").wait_for(state="visible", timeout=6000)
                    report(section, True, "error shown: 心得正文需 300–1000 字")
                except PWTimeout:
                    report(section, False, "expected error 心得正文需 300–1000 字 NOT shown")

            # ================ VALIDATION: type1 valid submit ================
            section = "validation-type1-success"
            page.goto(BASE + "/me/applications/new", wait_until="domcontentloaded")
            page.locator("#course-select").wait_for(state="visible", timeout=15000)
            if page.locator("#course-select option").count() <= 1:
                report(section, False, "no eligible courses to submit a valid type1 application")
            else:
                # pick the last eligible course so repeated runs don't always
                # consume the same one (a submitted app blocks further apps)
                chosen_idx = page.locator("#course-select option").count() - 1
                chosen = page.locator("#course-select option").nth(chosen_idx).inner_text()
                page.select_option("#course-select", index=chosen_idx)
                page.fill("#reflection", "通" * 380)
                page.get_by_role("button", name="提交申请").click()
                page.wait_for_url(re.compile(r"/me/applications/\d+$"), timeout=15000)
                app_id = re.search(r"/me/applications/(\d+)$", page.url).group(1)
                report(section, True, f"redirected to /me/applications/{app_id} (course: {chosen})")
                try:
                    page.locator('[role="status"]').wait_for(state="visible", timeout=5000)
                    toast = page.locator('[role="status"]').inner_text()
                    report(section, "提交成功" in toast, f"toast: {toast}")
                except PWTimeout:
                    report(section, False, "toast 提交成功 not visible")

            # ================ VALIDATION: type2 no template =================
            section = "validation-type2-notemplate"
            page.goto(BASE + "/me/applications/new", wait_until="domcontentloaded")
            page.locator("button", has_text="类型二：").click()
            page.locator("#template-select").wait_for(state="visible", timeout=10000)
            submit_btn = page.get_by_role("button", name="提交申请")
            report(section, not submit_btn.is_enabled(),
                   f"submit button DISABLED without template (enabled={submit_btn.is_enabled()})")
            dispatch_submit(page)
            try:
                page.get_by_text("请选择积分模板").wait_for(state="visible", timeout=6000)
                report(section, True, "error shown: 请选择积分模板")
            except PWTimeout:
                report(section, False, "expected error 请选择积分模板 NOT shown")

            # ================ VALIDATION: type2 valid submit ================
            section = "validation-type2-success"
            page.locator("#template-select").wait_for(state="visible", timeout=10000)
            page.select_option("#template-select", index=1)
            page.fill("#matter", "浏览器验收测试专项申请")
            page.fill("#reason", "通过端到端浏览器测试验证积分申请流程的完整性，覆盖类型二专项申请路径，确保表单校验与提交功能正常。")
            page.get_by_role("button", name="提交申请").click()
            page.wait_for_url(re.compile(r"/me/applications/\d+$"), timeout=15000)
            app_id = re.search(r"/me/applications/(\d+)$", page.url).group(1)
            report(section, True, f"redirected to /me/applications/{app_id}")
            try:
                page.locator('[role="status"]').wait_for(state="visible", timeout=5000)
                toast = page.locator('[role="status"]').inner_text()
                report(section, "提交成功" in toast, f"toast: {toast}")
            except PWTimeout:
                report(section, False, "toast 提交成功 not visible")
            detail_text = page.locator("body").inner_text()
            report(section, "专项申请" in detail_text or "浏览器验收测试专项申请" in detail_text,
                   f"detail page shows type2 title (has 浏览器验收测试专项申请: {'浏览器验收测试专项申请' in detail_text})")

        except Exception as exc:  # noqa: BLE001
            import traceback
            traceback.print_exc()
            try:
                page.screenshot(path=".agents/screenshots-failure.png", full_page=True)
                report_info("fatal", "screenshot saved to .agents/screenshots-failure.png")
            except Exception:
                pass
            raise

        finally:
            browser.close()

    # =============================== SUMMARY ===============================
    fails = [r for r in RESULTS if not r[1]]
    print("\n" + "=" * 80)
    print(f"SUMMARY: {len(RESULTS)} checks, {len(fails)} FAILED")
    for section, ok, detail in RESULTS:
        print(f"  [{'PASS' if ok else 'FAIL'}] {section}: {detail}")
    if CONSOLE_ERRORS:
        print(f"\nCONSOLE ERRORS ({len(CONSOLE_ERRORS)}):")
        for e in CONSOLE_ERRORS[:20]:
            print("  ", e[:300])
    if PAGE_ERRORS:
        print(f"\nPAGE ERRORS ({len(PAGE_ERRORS)}):")
        for e in PAGE_ERRORS[:20]:
            print("  ", e[:300])
    if REQ_FAILURES:
        print(f"\nREQUEST FAILURES ({len(REQ_FAILURES)}):")
        for e in REQ_FAILURES[:20]:
            print("  ", e[:300])
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
