"""Debug: inspect chart SVG structure and y-axis labels."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1100})
    page.goto("http://localhost:5173/login", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(800)
    inputs = page.locator("input")
    inputs.nth(0).fill("super@demo")
    inputs.nth(1).fill("Demo1234!")
    page.locator("button[type='submit'], form button").first.click()
    page.wait_for_timeout(2500)
    page.goto("http://localhost:5173/admin/dashboard", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2500)

    h3 = page.locator("h3:text-is('近 7 日趋势')")
    print("h3 count:", h3.count())
    # walk svgs
    svgs = page.locator("svg")
    for i in range(svgs.count()):
        bbox = svgs.nth(i).bounding_box()
        texts = svgs.nth(i).locator("text").all_inner_texts()
        rects = svgs.nth(i).locator("rect").count()
        print(f"svg[{i}]: bbox={bbox} rects={rects} texts={texts[:10]}")
    # chart titles
    for h in page.locator("h4").all():
        print("h4:", repr(h.inner_text()))
    browser.close()
