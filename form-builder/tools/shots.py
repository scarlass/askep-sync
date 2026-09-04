"""Ambil tangkapan layar untuk README: antarmuka builder, pratinjau penuh,
hasil render pada layar lebar, dan hasil render pada layar sempit."""
import pathlib
from playwright.sync_api import sync_playwright


def klip_inspektur(page):
    """Kotak panel properti (panel ke-3), diambil dari posisi sebenarnya."""
    b = page.locator(".pane").nth(2).bounding_box()
    return {"x": b["x"], "y": b["y"], "width": b["width"], "height": b["height"]}

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
DOCS.mkdir(exist_ok=True)
URL = "http://localhost:5173/"

with sync_playwright() as pw:
    b = pw.chromium.launch()
    page = b.new_page(viewport={"width": 1680, "height": 1000}, device_scale_factor=2)
    page.goto(URL, wait_until="networkidle")

    # susun formulir contoh dari blok siap pakai
    for nama in ["Block: Identity (Label : value)", "Block: Anthropometry",
                 "Block: Pain Screening", "Block: Fall Risk"]:
        page.locator(f'.palette-item:has-text("{nama}")').first.click()
        page.wait_for_timeout(120)

    page.evaluate("window.confirm = () => true")
    page.locator('.section-head button:has-text("✕")').first.click()   # buang section kosong
    page.fill(".title-input", "ASESMEN AWAL KEPERAWATAN RAWAT INAP")
    page.wait_for_timeout(300)

    # hidupkan paging lalu pindahkan dua section ke halaman 2
    page.locator('.group summary:has-text("Pages (paging)")').click()
    page.wait_for_timeout(200)
    page.locator('.insp label:has-text("Split this form into pages") input').check()
    page.wait_for_timeout(300)
    for i in (2, 3):
        page.locator(".section-head .pagepick").nth(i).select_option("2")
        page.wait_for_timeout(150)

    page.evaluate("document.querySelectorAll('.pane').forEach(p => p.scrollTop = 0)")
    page.wait_for_timeout(600)
    page.screenshot(path=str(DOCS / "screenshot-builder.png"))

    # panel pengaturan (kop, footer, paging)
    page.locator('.pane-head .seg.on:has-text("Form")').wait_for(timeout=3000)
    page.screenshot(path=str(DOCS / "screenshot-settings.png"), clip=klip_inspektur(page))

    # panduan kop & footer: tab Form, grup Letterhead + Footer, dua tanda tangan
    page.locator('.cell.filled').first.click()
    page.wait_for_timeout(200)
    page.locator('button:has-text("⚙ Header & footer")').click()
    page.wait_for_timeout(400)
    page.screenshot(path=str(DOCS / "screenshot-header.png"), clip=klip_inspektur(page))
    page.locator('.insp label:has-text("Split the footer") input').check()
    page.wait_for_timeout(250)
    page.locator('button:has-text("+ Add signature")').click()
    page.wait_for_timeout(300)
    page.locator('.signcard').last.locator('select').first.select_option("kiri")
    page.wait_for_timeout(200)
    page.locator('.signcard').last.scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    page.screenshot(path=str(DOCS / "screenshot-footer.png"), clip=klip_inspektur(page))
    page.reload(wait_until="networkidle")
    for nama in ["Block: Identity (Label : value)", "Block: Anthropometry",
                 "Block: Pain Screening", "Block: Fall Risk"]:
        page.locator(f'.palette-item:has-text("{nama}")').first.click()
        page.wait_for_timeout(120)
    page.evaluate("window.confirm = () => true")
    page.locator('.section-head button:has-text("✕")').first.click()
    page.fill(".title-input", "ASESMEN AWAL KEPERAWATAN RAWAT INAP")
    page.wait_for_timeout(400)

    # pratinjau layar penuh
    page.click('button:has-text("⛶ Full preview")')
    page.wait_for_timeout(900)
    page.screenshot(path=str(DOCS / "screenshot-fullpreview.png"))
    page.keyboard.press("Escape")

    # hasil render
    page.click('.tabs button:has-text("HTML")')
    html = page.locator(".codebox").input_value()
    contoh = ROOT / "tools" / "contoh.html"
    contoh.write_text(html, encoding="utf-8")

    hal = b.new_page(viewport={"width": 900, "height": 1150}, device_scale_factor=2)
    hal.goto(contoh.as_uri(), wait_until="networkidle")
    hal.screenshot(path=str(DOCS / "screenshot-hasil.png"), full_page=True)

    # bukti responsif: layar ponsel
    kecil = b.new_page(viewport={"width": 414, "height": 1000}, device_scale_factor=2)
    kecil.goto(contoh.as_uri(), wait_until="networkidle")
    kecil.screenshot(path=str(DOCS / "screenshot-responsive.png"), full_page=True)
    b.close()
print("selesai")
