"""Uji importer dengan formulir asli milik pengguna.

Memuat tiap berkas HTML lewat antarmuka builder, membaca laporan mutu di layar
tinjauan, mengimpornya, lalu memeriksa hasil akhirnya.
"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173/"
BERKAS = sorted(pathlib.Path("/home/user/uploads").glob("*.html")) + \
         [ROOT.parent / "medical-form-formatter/samples/SAMPLE - INPATIENT INITIAL ASSESSMENT.html"]

masalah = []

with sync_playwright() as pw:
    b = pw.chromium.launch()
    page = b.new_page(viewport={"width": 1600, "height": 1000})
    galat = []
    page.on("pageerror", lambda e: galat.append(str(e)))
    page.on("console", lambda m: galat.append(m.text) if m.type == "error" else None)
    page.goto(URL, wait_until="networkidle")

    for f in BERKAS:
        page.set_input_files('input[type="file"][accept=".html,.htm"]', str(f))
        try:
            page.locator(".import-table").wait_for(timeout=20000)
        except Exception as e:
            masalah.append(f"{f.name[:34]}: layar tinjauan tidak muncul ({e})")
            continue

        pil = page.locator(".report .pill").all_inner_texts()
        baris = page.locator(".import-table tbody tr").count()
        hilang = page.locator(".report .warn b").count()
        page.click('button:has-text("Import into builder")')
        page.wait_for_timeout(600)

        bar = page.locator(".importbar").inner_text().replace("\n", " · ")
        stat = page.locator(".stat").inner_text().replace("\n", " ")
        page.click('.tabs button:has-text("HTML")')
        html = page.locator(".codebox").input_value()
        markup = html.split("</style>", 1)[-1]
        page.click('.tabs button:has-text("Preview")')

        asli = f.read_text(encoding="utf-8", errors="ignore")
        # nama field pada berkas asli (di luar komentar)
        tanpa_komentar = re.sub(r"(?s)<!--.*?-->", "", asli)
        tanpa_komentar = re.sub(r"(?s)<script.*?</script>", "", tanpa_komentar)
        nama_asli = {re.sub(r"\[\]$", "", n) for n in
                     re.findall(r'<(?:input|select|textarea)[^>]*\sname="([^"]+)"', tanpa_komentar)}
        nama_hasil = {re.sub(r"\[\]$", "", n) for n in re.findall(r'name="([^"]+)"', markup)}
        hilang_nyata = sorted(n for n in nama_asli if n and n not in nama_hasil)

        print(f"\n=== {f.name[:56]}")
        print("   ", bar)
        print("   ", stat)
        print(f"    section terdeteksi: {baris} · nama asli: {len(nama_asli)} · "
              f"hilang: {len(hilang_nyata)} {hilang_nyata[:6]}")
        if hilang_nyata:
            masalah.append(f"{f.name[:34]}: {len(hilang_nyata)} nama hilang")
        if "askep-page" not in markup:
            masalah.append(f"{f.name[:34]}: keluaran tidak terbentuk")

    nyata = [g for g in galat if "load local resource" not in g
             and "Failed to load resource" not in g]
    if nyata:
        masalah.append("galat konsol: " + "; ".join(sorted(set(nyata))[:3]))
    b.close()

print("\n" + "-" * 60)
if masalah:
    print("\n".join(masalah))
    print(f"{len(masalah)} MASALAH")
    sys.exit(1)
print("semua berkas terimpor tanpa kehilangan field")
