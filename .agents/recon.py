"""Recon: login as super@demo, dump dashboard DOM structure."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.goto("http://localhost:5173", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)
    print("URL after load:", page.url)
    print("--- BODY TEXT (first 1500 chars) ---")
    print(page.locator("body").inner_text()[:1500])
    print("--- FORMS / INPUTS ---")
    for inp in page.locator("input").all():
        print("input:", inp.get_attribute("name"), "|", inp.get_attribute("placeholder"), "| type:", inp.get_attribute("type"))
    for btn in page.locator("button").all():
        print("button:", repr(btn.inner_text()[:50]))
    browser.close()
