"""Debug importer: dump section + komponen raw untuk satu berkas.
Menjalankan scanHtml langsung di konteks halaman (dev server, modul ESM)
supaya hasil pindaian bisa diperiksa mendetail tanpa lewat UI.
"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173/"
BERKAS = sys.argv[2] if len(sys.argv) > 2 else \
    "/home/user/uploads/ASUHAN KEPERAWATAN PASIEN DIAGNOSTIK INVASIF DAN INTERVENSI NON BEDAH CATHLAB.html"

async def main():
    html = pathlib.Path(BERKAS).read_text(encoding="utf-8", errors="ignore")
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(URL, wait_until="networkidle")
        hasil = await page.evaluate(
            """async (html) => {
                const m = await import('/src/import/build.js');
                const scan = await m.scanHtml(html, {});
                const ringkas = [];
                scan.sections.forEach((s) => {
                    const raws = [];
                    s.rows.forEach((r) => r.cells.forEach((c) => {
                        if (c && c.type === 'html') raws.push(c.html.slice(0, 300));
                    }));
                    ringkas.push({ judul: s.title, baris: s.rows.length,
                                    stat: s.stat, raws });
                });
                return { ringkas, geo: scan.meta.geometry };
            }""", html)
        print("geometry:", hasil["geo"])
        for s in hasil["ringkas"]:
            print(f"\n### {s['judul']} | baris {s['baris']} | stat {s['stat']}")
            for i, raw in enumerate(s["raws"][:6]):
                print(f"  raw[{i}]: {' '.join(raw.split())[:260]}")
            if len(s["raws"]) > 6:
                print(f"  ... +{len(s['raws'])-6} raw lain")
        await browser.close()

asyncio.run(main())
