"""Recon 2: login as super@demo and dump admin dashboard DOM."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1000})
    page.goto("http://localhost:5173/login", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1000)
    print("Login page URL:", page.url)
    # find inputs
    inputs = page.locator("input")
    for i in range(inputs.count()):
        print("input", i, "name=", inputs.nth(i).get_attribute("name"), "type=", inputs.nth(i).get_attribute("type"))
    # fill email/password
    if inputs.count() >= 2:
        inputs.nth(0).fill("super@demo")
        inputs.nth(1).fill("Demo1234!")
        page.locator("button[type='submit'], form button").first.click()
        page.wait_for_timeout(2500)
    print("URL after login:", page.url)
    page.screenshot(path="recon_dashboard.png", full_page=True)
    body = page.locator("body").inner_text()
    print("--- BODY (first 4000 chars) ---")
    print(body[:4000])
    browser.close()
