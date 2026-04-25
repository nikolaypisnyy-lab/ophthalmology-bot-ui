from playwright.sync_api import sync_playwright

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://www.iolformula.com/agreement/")
        print(page.title())
        try:
            page.locator(".btn_agreement").click()
            page.wait_for_url("https://www.iolformula.com/")
            print("On calculator page")
            # dump inputs
            inputs = page.evaluate("() => Array.from(document.querySelectorAll('input')).map(e => e.name + ':' + e.type)")
            print(inputs)
        except Exception as e:
            print("Error:", e)
        browser.close()

if __name__ == "__main__":
    test()
