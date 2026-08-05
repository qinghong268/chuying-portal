"""Recon 3: dump /admin/dashboard DOM structure."""
from playwright.sync_api import sync_playwright

def login(page):
    page.goto("http://localhost:5173/login", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(800)
    inputs = page.locator("input")
    inputs.nth(0).fill("super@demo")
    inputs.nth(1).fill("Demo1234!")
    page.locator("button[type='submit'], form button").first.click()
    page.wait_for_timeout(2500)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    login(page)
    page.goto("http://localhost:5173/admin/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2500)
    print("Dashboard URL:", page.url)
    page.screenshot(path="recon_dashboard_page.png", full_page=True)
    body = page.locator("body").inner_text()
    print("--- DASHBOARD BODY TEXT ---")
    print(body[:6000])
    print("--- LINKS (a) on page ---")
    for a in page.locator("a").all():
        href = a.get_attribute("href")
        txt = a.inner_text()[:60].replace("\n", " | ")
        print("LINK:", repr(txt), "->", href)
    print("--- BUTTONS ---")
    for b in page.locator("button").all():
        print("BTN:", repr(b.inner_text()[:60]))
    browser.close()
