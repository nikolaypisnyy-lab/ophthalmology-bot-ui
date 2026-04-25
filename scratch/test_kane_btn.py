from playwright.sync_api import sync_playwright

def test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://www.iolformula.com/agreement/")
        try:
            page.locator(".btn_agreement").click()
            page.wait_for_url("https://www.iolformula.com/")
            buttons = page.evaluate("() => Array.from(document.querySelectorAll('button, input[type=button], input[type=submit]')).map(e => ({tag: e.tagName, type: e.type, cls: e.className, text: e.innerText || e.value}))")
            print("Buttons:", buttons)
            print("HTML around buttons:", page.evaluate("() => document.querySelector('.bottom_buttons')?.innerHTML || ''"))
        except Exception as e:
            print("Error:", e)
        browser.close()

if __name__ == "__main__":
    test()
