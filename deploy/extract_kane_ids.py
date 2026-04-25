from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
    context = browser.new_context()
    page = context.new_page()
    page.goto('https://www.iolformula.com/', timeout=60000)
    page.wait_for_timeout(3000)
    
    # I Agree
    try:
        page.evaluate("""() => { let btn = Array.from(document.querySelectorAll('div, button, a')).find(el => el.innerText.trim().toLowerCase() === 'i agree'); if (btn) btn.click(); }""")
    except: pass
    page.wait_for_timeout(2000)
    
    calc_frame = None
    for f in [page] + page.frames:
        if f.locator('#Patient').count() > 0:
            calc_frame = f
            break

    # Toric
    page.evaluate("""() => { let b = Array.from(document.querySelectorAll('div, button, label, span')).find(x => x.innerText.trim() === 'Toric'); if(b) b.click(); }""")
    page.wait_for_timeout(3000)

    print('INPUTS IN FRAME:')
    inputs = calc_frame.evaluate("""() => { return Array.from(document.querySelectorAll('input')).map(i => i.id + ' | ' + i.name + ' | ' + i.className); }""")
    for i in inputs:
        if not i.startswith(' | '):
            print(i)
    browser.close()
