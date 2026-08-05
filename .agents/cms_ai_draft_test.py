# -*- coding: utf-8 -*-
"""Browser test for the NEW CMS AI draft feature (雏英计划, localhost:5173)."""
import re
import sys
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
RESULTS = []


def log(ok, msg, extra=""):
    RESULTS.append((ok, msg))
    print(f"[{'PASS' if ok else 'FAIL'}] {msg} {extra}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        console_errors = []
        page_errors = []
        ai_responses = []
        ai_requests = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on(
            "response",
            lambda r: ai_responses.append((r.status, r.url))
            if "/ai-draft" in r.url
            else None,
        )
        page.on(
            "request",
            lambda r: ai_requests.append(r.url) if "/ai-draft" in r.url else None,
        )
        page.set_default_timeout(15000)

        # ---------- 1. Login ----------
        page.goto(f"{BASE}/login", wait_until="domcontentloaded")
        page.wait_for_selector("#login-account", timeout=15000)
        page.fill("#login-account", "super@demo")
        page.fill("#login-password", "Demo1234!")
        page.click('form button[type="submit"]')
        page.wait_for_url(re.compile(r"/admin"), timeout=20000)
        print(f"[INFO] Logged in, URL = {page.url}")
        time.sleep(1.0)

        # ---------- 2. Navigate to /admin/content ----------
        page.goto(f"{BASE}/admin/content", wait_until="domcontentloaded")
        page.wait_for_selector("text=内容运营", timeout=15000)
        time.sleep(0.8)
        log(True, "Step 1-2: Login + navigate to /admin/content")

        # Ensure at least one content block exists
        rows = page.locator("table tbody tr")
        if rows.count() == 0:
            log(False, "Step 3: No content blocks exist in list — cannot proceed")
            page.screenshot(path=".agents/shot_no_blocks.png")
        else:
            # ---------- 3. Select a content block ----------
            block_key = rows.first.locator("td").nth(0).inner_text()
            rows.first.click()
            time.sleep(0.5)
            editor_head = page.locator("h2", has_text="编辑")
            log(True, f"Step 3: Selected content block '{block_key}', editor shows '{editor_head.inner_text().strip()}'")

            # ---------- 4. AI button visible in editor header ----------
            ai_btn = page.get_by_role("button", name="AI 生成草稿")
            visible = ai_btn.is_visible()
            log(visible, "Step 4: 🤖 AI 生成草稿 button visible in editor header",
                f"(text='{ai_btn.inner_text().strip()}')")

            # ---------- 10 (first). Empty topic -> button disabled ----------
            if visible:
                ai_btn.click()
                time.sleep(0.4)
                topic_input = page.get_by_placeholder("雏英计划2026届迎新活动")
                gen_btn = page.get_by_role("button", name="生成草稿", exact=True)
                panel_visible = topic_input.is_visible() and gen_btn.is_visible()
                log(panel_visible, "Step 5: Inline panel opens with 输入内容主题 input + 生成草稿 button")
                if panel_visible:
                    disabled_empty = gen_btn.is_disabled()
                    log(disabled_empty, "Step 10: 生成草稿 button disabled when topic is empty")
                    # Try to force-click to confirm it really blocks (no network call)
                    if not disabled_empty:
                        gen_btn.click()
                        time.sleep(1.0)
                        any_ai_call = any("/ai-draft" in u for _, u in ai_responses)
                        log(not any_ai_call, "Step 10b: No ai-draft request fired on empty topic click")

                    # ---------- 6. Enter topic ----------
                    topic = "雏英计划2026届迎新活动介绍"
                    topic_input.fill(topic)

                    # ---------- 7. Click 生成草稿, verify loading ----------
                    gen_btn.click()
                    loading_seen = False
                    try:
                        page.get_by_text("AI 正在生成内容…", exact=True).wait_for(timeout=3000)
                        loading_seen = True
                    except Exception:
                        # loading may flash too fast; check once more quickly
                        try:
                            page.get_by_text("AI 正在生成内容…", exact=True).wait_for(timeout=800)
                            loading_seen = True
                        except Exception:
                            loading_seen = False
                    log(loading_seen, "Step 7: Loading state 'AI 正在生成内容…' shown")

                    # Record pre-existing field values (block may already have content)
                    orig_title = page.input_value("#block-title")
                    orig_summary = page.input_value("#block-summary")
                    orig_body = page.input_value("#block-body")

                    # ---------- 8. Wait for AI response (definitive signals) ----------
                    ai_start = time.time()
                    ai_filled = False
                    ai_error_text = None
                    while time.time() - ai_start < 180:
                        if page.get_by_text("AI 草稿已填入，请检查后保存", exact=True).count() > 0:
                            ai_filled = True
                            break
                        err_el = page.locator(".error, [class*=error]")
                        if err_el.count() > 0:
                            txt = err_el.first.inner_text().strip()
                            if txt:
                                ai_error_text = txt
                                break
                        if len(ai_requests) > 0 and not ai_responses:
                            pass  # request in flight
                        time.sleep(0.5)
                    log(ai_filled, "Step 8: AI response received, fields auto-filled",
                        f"(elapsed={time.time() - ai_start:.1f}s)")
                    if ai_error_text:
                        print(f"[INFO] AI error message shown: {ai_error_text}")

                    # ---------- 12. AI draft message ----------
                    log(ai_filled, "Step 12: Success message 'AI 草稿已填入，请检查后保存' shown")

                    # ---------- 9. Content checks ----------
                    title_val = page.input_value("#block-title")
                    summary_val = page.input_value("#block-summary")
                    body_val = page.input_value("#block-body")
                    print(f"[INFO] orig title={orig_title!r}")
                    print(f"[INFO] orig summary={orig_summary!r}")
                    print(f"[INFO] orig body={orig_body[:150]!r}")
                    print(f"[INFO] NEW title={title_val!r}")
                    print(f"[INFO] NEW summary={summary_val!r}")
                    print(f"[INFO] NEW body(first 300)={body_val[:300]!r}")
                    changed = title_val != orig_title or body_val != orig_body or summary_val != orig_summary
                    log(changed, "Step 8b: Fields actually CHANGED from pre-existing values (real AI output)")
                    chinese = re.search(r"[一-鿿]", title_val) is not None
                    html_tags = re.findall(r"</?([a-zA-Z][a-zA-Z0-9]*)>", body_val)
                    has_struct = any(t in html_tags for t in ("h2", "h1", "p", "ul", "li", "strong", "div"))
                    log(chinese, "Step 9a: Generated title is in Chinese", f"(title={title_val[:40]})")
                    log(has_struct, "Step 9b: Body has proper HTML structure",
                        f"(tags seen: {sorted(set(html_tags))[:12]})")
                    body_chinese = re.search(r"[一-鿿]", body_val) is not None
                    log(body_chinese, "Step 9c: Body content is in Chinese")
                    summary_ok = len(summary_val.strip()) > 0
                    log(summary_ok, "Step 9d: Summary is filled")

                    # If AI failed, skip save persistence checks
                    if ai_filled and changed:
                        page.screenshot(path=".agents/shot_after_ai.png")

                        # ---------- 11. Save draft ----------
                        save_btn = page.get_by_role("button", name="存草稿", exact=True)
                        save_btn.click()
                        try:
                            page.get_by_text("草稿已保存", exact=True).wait_for(timeout=15000)
                            log(True, "Step 11: 存草稿 clicked, '草稿已保存' confirmed")
                        except Exception:
                            log(False, "Step 11: '草稿已保存' message NOT shown after save")

                        # Persistence check: reload and confirm content survived
                        page.reload(wait_until="domcontentloaded")
                        page.wait_for_selector("table tbody tr", timeout=15000)
                        time.sleep(0.6)
                        # re-select the same block (auto-selects first)
                        persisted_title = page.input_value("#block-title")
                        persisted_body = page.input_value("#block-body")
                        same = persisted_title == title_val and persisted_body == body_val
                        log(same, "Step 11b: Content persisted after page reload (saved to server)")
                        if not same:
                            print(f"[INFO] persisted title={persisted_title!r} body(first80)={persisted_body[:80]!r}")
                    else:
                        log(False, "Step 11: skipped save (AI generation did not succeed)")
                        page.screenshot(path=".agents/shot_ai_failed.png")

        # ---------- Summary of console / network issues ----------
        real_errors = [c for c in console_errors if "favicon" not in c.lower()]
        print("\n--- Console errors ---")
        for c in real_errors[:10]:
            print(" ", c)
        print("--- Page errors ---")
        for e in page_errors[:10]:
            print(" ", e)
        print("--- ai-draft network responses ---")
        for status, url in ai_responses:
            print(" ", status, url)
        if not ai_responses:
            print("  (no /ai-draft request observed)")

        browser.close()

    failed = [m for ok, m in RESULTS if not ok]
    print(f"\n===== RESULT: {len(RESULTS) - len(failed)}/{len(RESULTS)} passed =====")
    for ok, m in RESULTS:
        print(f"  {'PASS' if ok else 'FAIL'} {m}")
    if failed:
        print(f"\nFAILURES ({len(failed)}):")
        for m in failed:
            print("  -", m)
        sys.exit(1)


if __name__ == "__main__":
    main()
