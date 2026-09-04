"""Verifikasi builder dengan peramban sungguhan (Playwright).

Dijalankan: python3 tools/verify.py [url]
Memuat formulir uji berisi semua komponen (3 halaman), memeriksa HTML
keluaran, mengukur tata letak hasil render pada layar lebar DAN sempit,
menguji paging, pratinjau layar penuh, serta blok buatan sendiri.
"""
import json, pathlib, re, sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173/"
OUT = ROOT / "tools" / "out.html"
masalah, catatan = [], []


def cek(nama, syarat, detail=""):
    (catatan if syarat else masalah).append(f"{'OK  ' if syarat else 'GAGAL'} {nama} {detail}")


with sync_playwright() as pw:
    b = pw.chromium.launch()
    page = b.new_page(viewport={"width": 1600, "height": 1000})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="networkidle")

    # ---------------------------------------------------------------- palet
    komponen = page.locator(".palette-item").count()
    cek("palet terisi", komponen >= 35, f"({komponen} tombol)")
    cek("antarmuka berbahasa Inggris",
        page.locator('h2:has-text("Components")').count() == 1
        and page.locator('h2:has-text("Form layout")').count() == 1
        and page.locator('button:has-text("Export HTML")').count() == 1)

    page.fill(".search", "date")
    page.wait_for_timeout(150)
    tersaring = page.locator(".palette-item").count()
    cek("pencarian palet menyaring", tersaring < komponen, f"({tersaring} tersisa)")
    page.fill(".search", "")

    # -------------------------------------------------- muat formulir uji
    page.set_input_files('input[type="file"][accept=".json"]',
                         str(ROOT / "tools" / "test-form.json"))
    page.wait_for_timeout(500)

    stat = page.locator(".stat").inner_text().replace("\n", " ")
    catatan.append("STAT " + stat)
    cek("kanvas menampilkan 3 halaman", page.locator(".pagegroup").count() == 3,
        f'({page.locator(".pagegroup").count()})')

    page.click('.tabs button:has-text("HTML")')
    html = page.locator(".codebox").input_value()
    OUT.write_text(html, encoding="utf-8")
    cek("HTML keluaran terbentuk", len(html) > 5000, f"({len(html)} bytes)")

    # ------------------------------------------------- pemeriksaan isi HTML
    tema = (ROOT / "src" / "theme" / "medical-form.css").read_text(encoding="utf-8")

    dipakai = set(re.findall(r'class="([^"]+)"', html))
    kelas = {k for grup in dipakai for k in grup.split() if k.startswith("askep-")}
    ada = set(re.findall(r"\.(askep-[A-Za-z0-9_-]+)", tema))
    hilang = sorted(kelas - ada)
    cek("semua kelas askep- ada di tema", not hilang, str(hilang))

    token_pakai = set(re.findall(r"var\((--askep-[a-z0-9-]+)", html + tema))
    token_ada = set(re.findall(r"(--askep-[a-z0-9-]+)\s*:", tema))
    cek("semua token CSS terdefinisi", not (token_pakai - token_ada),
        str(sorted(token_pakai - token_ada)))

    ids = re.findall(r'\sid="([^"]+)"', html)
    ganda = sorted({i for i in ids if ids.count(i) > 1 and i != "CreateTTD"})
    cek("tidak ada id ganda", not ganda, str(ganda))

    with open(ROOT / "tools" / "test-form.json", encoding="utf-8") as fh:
        uji = json.load(fh)
    tipe = [c["type"] for r in uji["sections"][0]["rows"] for c in r["cells"]]
    kurang = [t for t in tipe if f"uji_{t}" not in html
              and t not in ("paragraph", "subtitle", "list", "note", "image",
                            "divider", "spacer", "pagebreak", "table", "matrix",
                            "button", "html", "static", "signature")]
    cek("semua field komponen muncul", not kurang, str(kurang))

    for nama, pola in [
        ("lebar persen", "width:60% !important"),
        ("lebar milimeter", "width:40mm !important"),
        ("lebar kolom baris lewat custom property", "--askep-cols: 30% 70%"),
        ("baris 6 kolom", "askep-grid--6"),
        ("sel melebar (span)", 'class="askep-span-2"'),
        ("tabel dibungkus", 'class="askep-table-wrap"'),
        ("tata letak Label : isian", "askep-field--inline"),
        ("kop diubah pengguna", "Unit Rawat Inap"),
        ("kop dua sisi", "askep-header--split"),
        ("lebar sisi kop", "--askep-header-cols: 60% 40%"),
        ("ukuran logo diatur", "--askep-logo-width: 22mm"),
        ("garis pemisah kop", "askep-header--divided"),
        ("lebar kotak identitas", "--askep-ident-width: 80%"),
        ("lebar kolom nilai identitas", "--askep-ident-value: 34mm"),
        ("ukuran teks identitas", "--askep-ident-fs: 9pt"),
        ("posisi kotak identitas", "askep-header-ident--right"),
        ("baris identitas berupa isian", 'name="no_register_kop"'),
        ("lebar isian identitas per baris", "--askep-ident-row: 25mm"),
        ("baris identitas berlebar khusus dibungkus", 'class="askep-header-ident-row"'),
        ("baris identitas berupa tanggal", 'name="tgl_masuk_kop"'),
        ("isian kop memakai datepicker", 'askep-input--inline datepickerBoots'),
        ("baris identitas pilihan", 'name="kelas_kop"'),
        ("pilihan kop memakai gaya radio tema", 'class="askep-radio"><input type="radio" name="kelas_kop"'),
        ("baris identitas lebar penuh", "askep-header-ident-key--full"),
        ("footer dua sisi", "askep-footer--split"),
        ("lebar sisi footer", "--askep-footer-cols: 40% 60%"),
        ("footer tanda tangan 3", 'id="paraf_3"'),
        ("atribut aplikasi", 'myid="check_cara"'),
        # --- paging ---
        ("fieldset halaman 1", 'id="dokumen_page_1"'),
        ("fieldset halaman 3", 'id="dokumen_page_3"'),
        ("halaman selain pertama disembunyikan", 'class="askep-page-part hidden"'),
        ("navigasi pagination", 'class="pagination askep-pagination'),
        ("tautan NextPage", 'href="javascript:NextPage(2);"'),
        ("penanda tab halaman", 'myid="li_page_2"'),
        ("skrip pindah halaman", "window.NextPage = function"),
        ("skrip hanya bila perlu", 'typeof window.NextPage !== "function"'),
        ("cetak semua halaman", "askep-print-all"),
        ("navigasi tidak ikut tercetak", 'class="askep-no-print hide-print"'),
    ]:
        cek(nama, pola in html)

    # hitung hanya pada MARKUP (bagian setelah <style>), bukan pada tema CSS
    markup = html.split("</style>", 1)[-1]
    cek("kop hanya di halaman pertama",
        markup.count('class="askep-header ') == 1,
        f"""({markup.count('class="askep-header ')}x)""")
    cek("footer hanya di halaman terakhir",
        markup.count('<div class="askep-footer">') == 1,
        f"""({markup.count('<div class="askep-footer">')}x)""")

    # sisi kop/footer memang berisi blok yang dipilih pengguna
    kanan_kop = markup.split('askep-header-right', 1)[-1].split("</div>\n  </div>")[0]
    cek("judul formulir pindah ke sisi kanan kop", "askep-header-title" in kanan_kop)
    kiri_footer = markup.split('askep-footer-side', 1)[-1].split("</div>")[0] + \
                  markup.split('askep-footer-side', 1)[-1][:2000]
    cek("tanda tangan pasien ada di sisi kiri footer",
        "Pasien / Keluarga" in markup.split("askep-footer-side")[1])

    # ------------------------------------------- ukur hasil render sungguhan
    hal = b.new_page(viewport={"width": 1100, "height": 900})
    hal.goto(OUT.as_uri(), wait_until="networkidle")

    sisi = hal.evaluate("""() => {
      const box = (s) => { const el = document.querySelector(s);
        return el ? el.getBoundingClientRect().toJSON() : null; };
      const kop = box('.askep-header');
      const kiri = box('.askep-header-left');
      const kanan = box('.askep-header-right');
      const logo = box('.askep-header-logo img');
      const identEl = document.querySelector('.askep-header-ident');
      const ident = box('.askep-header-ident');
      const identFs = identEl ? getComputedStyle(identEl).fontSize : null;
      const identCols = identEl ? getComputedStyle(identEl).gridTemplateColumns : null;
      const fKiri = box('.askep-footer-side');
      const fKanan = box('.askep-footer-side + .askep-footer-side');
      const fInduk = box('.askep-footer--split');
      return { kop, kiri, kanan, logo, fKiri, fKanan, fInduk, ident, identFs, identCols };
    }""")
    r_kiri = sisi["kiri"]["width"] / sisi["kop"]["width"]
    cek("sisi kiri kop kira-kira 60%", 0.55 < r_kiri < 0.63, f"({r_kiri:.0%})")
    cek("sisi kanan kop kira-kira 40%",
        0.35 < sisi["kanan"]["width"] / sisi["kop"]["width"] < 0.43,
        f'({sisi["kanan"]["width"] / sisi["kop"]["width"]:.0%})')
    cek("logo selebar 22mm", 78 < sisi["logo"]["width"] < 89, f'({sisi["logo"]["width"]:.0f}px)')
    # 60% + 40% + gap tidak boleh meluber keluar kotak kop (bug yang pernah terjadi)
    luber = sisi["kanan"]["x"] + sisi["kanan"]["width"] - (sisi["kop"]["x"] + sisi["kop"]["width"])
    cek("sisi kanan tidak meluber keluar kotak kop", luber <= 0, f"({luber:.1f}px)")

    isianKop = hal.evaluate("""() => {
      const inp = document.querySelector('#no_register_kop');
      const tgl = document.querySelector('#tgl_masuk_kop');
      const pil = document.querySelectorAll('input[name="kelas_kop"]');
      const kotak = document.querySelector('.askep-header-ident').getBoundingClientRect();
      return {
        adaIsian: !!inp, bisaDiketik: inp ? !inp.readOnly && !inp.disabled : false,
        lebarIsian: inp ? inp.getBoundingClientRect().width : 0,
        dalamKotak: inp ? inp.getBoundingClientRect().right <= kotak.right + 1 : false,
        adaTanggal: !!tgl, jumlahPilihan: pil.length,
        myid: inp ? inp.getAttribute('myid') : null,
      };
    }""")
    cek("isian di kop benar-benar bisa diketik",
        isianKop["adaIsian"] and isianKop["bisaDiketik"] and isianKop["lebarIsian"] > 40,
        str(isianKop))
    cek("isian kop tidak meluber keluar kotak identitas", isianKop["dalamKotak"])
    perBaris = hal.evaluate("""() => {
      const b = (s) => document.querySelector(s).getBoundingClientRect();
      const kotak = b('.askep-header-ident');
      const kop = b('.askep-header');
      return {
        kotak: kotak.width,
        pendek: b('#no_register_kop').width,
        normal: b('#tgl_masuk_kop').width,
        penuh: b('#keluhan_kop').width,
        kebesaran: b('#lebar_kop').width,
        rapatKanan: Math.abs(b('#no_register_kop').right - kotak.right) < 2,
        luber: Math.max(b('#keluhan_kop').right, b('#lebar_kop').right) - kop.right,
      };
    }""")
    cek("panjang isian per baris berlaku (25mm)",
        88 < perBaris["pendek"] < 100 and perBaris["normal"] > perBaris["pendek"] + 20,
        f'({perBaris["pendek"]:.0f}px vs baris lain {perBaris["normal"]:.0f}px)')
    cek("isian pendek tetap rapat ke tepi kanan", perBaris["rapatKanan"])
    cek("100% = selebar kotak identitas, bukan selebar kolom",
        abs(perBaris["penuh"] - perBaris["kotak"]) < 2
        and perBaris["penuh"] > perBaris["normal"] + 20,
        f'({perBaris["penuh"]:.0f}px, kotak {perBaris["kotak"]:.0f}px, kolom {perBaris["normal"]:.0f}px)')
    cek("lebar melebihi kotak dibatasi, tidak meluber",
        abs(perBaris["kebesaran"] - perBaris["kotak"]) < 2 and perBaris["luber"] <= 0,
        f'({perBaris["kebesaran"]:.0f}px, luber {perBaris["luber"]:.1f}px)')
    luberIdent = hal.evaluate("""() => {
      const el = document.querySelector('.askep-header-ident');
      const kop = document.querySelector('.askep-header').getBoundingClientRect();
      const teks = [...el.querySelectorAll('span')]
        .map((s) => s.getBoundingClientRect().right);
      return { isi: el.scrollWidth - el.clientWidth,
               palingKanan: Math.max(...teks) - kop.right };
    }""")
    cek("isi kotak identitas tidak meluber", luberIdent["isi"] <= 1,
        f'(scroll {luberIdent["isi"]:.0f}px)')
    cek("tidak ada teks identitas keluar kop", luberIdent["palingKanan"] <= 0,
        f'({luberIdent["palingKanan"]:.1f}px)')
    cek("isian kop mendapat atribut aplikasi", isianKop["myid"] == "check_cara")
    cek("baris pilihan di kop terbentuk", isianKop["jumlahPilihan"] == 3,
        str(isianKop["jumlahPilihan"]))

    r_ident = sisi["ident"]["width"] / sisi["kanan"]["width"]
    cek("kotak identitas 80% dari sisinya", 0.70 < r_ident < 0.84, f"({r_ident:.0%})")
    cek("teks identitas 9pt", sisi["identFs"] == "12px", str(sisi["identFs"]))
    cek("kolom nilai identitas 34mm",
        123 < float(sisi["identCols"].split()[1][:-2]) < 134, str(sisi["identCols"]))
    cek("kotak identitas rata kanan di sisinya",
        abs((sisi["ident"]["x"] + sisi["ident"]["width"]) -
            (sisi["kanan"]["x"] + sisi["kanan"]["width"])) < 2,
        f'({sisi["ident"]["x"] + sisi["ident"]["width"]:.0f} vs {sisi["kanan"]["x"] + sisi["kanan"]["width"]:.0f})')

    # halaman 1 tampak, sisanya tersembunyi
    tampak = hal.evaluate("""() => ({
      satu: !!document.querySelector('#dokumen_page_1').offsetParent,
      dua : !!document.querySelector('#dokumen_page_2').offsetParent,
    })""")
    cek("halaman 1 tampak, halaman 2 tersembunyi",
        tampak["satu"] and not tampak["dua"], str(tampak))

    # --- navigasi halaman benar-benar bekerja (skrip dijalankan) ---
    hal.click('[myid="li_page_2"] a')
    hal.wait_for_timeout(200)
    pindah = hal.evaluate("""() => ({
      dua: !!document.querySelector('#dokumen_page_2').offsetParent,
      satu: !!document.querySelector('#dokumen_page_1').offsetParent,
      aktif: document.querySelector('[myid="li_page_2"]').classList.contains('active'),
    })""")
    cek("klik navigasi memindahkan halaman",
        pindah["dua"] and not pindah["satu"] and pindah["aktif"], str(pindah))

    # halaman 2 sekarang tampak, jadi tata letaknya bisa diukur
    kotak = hal.evaluate("""() => {
      const q = (s) => document.querySelector(s);
      const box = (el) => el ? el.getBoundingClientRect().toJSON() : null;
      const persen = q('#lebar_persen');
      const grid = persen ? persen.closest('.askep-grid') : null;
      const span = q('#span_dua');
      return {
        persen: box(persen),
        persenInduk: persen ? box(persen.closest('.askep-field')) : null,
        gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
        enam: getComputedStyle(q('#enam_1').closest('.askep-grid')).gridTemplateColumns,
        spanLebar: box(span.closest('.askep-span-2')).width,
        sisaLebar: box(q('#span_sisa').closest('.askep-field')).width,
      };
    }""")
    rasio = kotak["persen"]["width"] / kotak["persenInduk"]["width"]
    cek("lebar 60% tetap 60% (custom property)", 0.55 < rasio < 0.65, f"({rasio:.0%})")
    cek("kolom baris 30/70 diterapkan", kotak["gridCols"] and
        abs(float(kotak["gridCols"].split()[0][:-2]) /
            float(kotak["gridCols"].split()[1][:-2]) - 30 / 70) < 0.05, str(kotak["gridCols"]))
    cek("baris 6 kolom benar-benar 6", len(kotak["enam"].split()) == 6, kotak["enam"])
    cek("sel span 2 kira-kira dua kali sel biasa",
        1.7 < kotak["spanLebar"] / kotak["sisaLebar"] < 2.4,
        f'({kotak["spanLebar"]:.0f} vs {kotak["sisaLebar"]:.0f})')

    # footer ada di halaman terakhir, jadi pindah dulu ke sana
    hal.click('[myid="li_page_3"] a')
    hal.wait_for_timeout(200)
    kaki = hal.evaluate("""() => {
      const box = (s) => { const el = document.querySelector(s);
        return el ? el.getBoundingClientRect().toJSON() : null; };
      const induk = box('#dokumen_page_3 .askep-footer--split');
      const kiri = box('#dokumen_page_3 .askep-footer-side');
      const kanan = box('#dokumen_page_3 .askep-footer-side + .askep-footer-side');
      return { induk, kiri, kanan };
    }""")
    cek("sisi kiri footer kira-kira 40%",
        0.35 < kaki["kiri"]["width"] / kaki["induk"]["width"] < 0.43,
        f'({kaki["kiri"]["width"] / kaki["induk"]["width"]:.0%})')
    cek("sisi kanan footer kira-kira 60%",
        0.55 < kaki["kanan"]["width"] / kaki["induk"]["width"] < 0.63,
        f'({kaki["kanan"]["width"] / kaki["induk"]["width"]:.0%})')
    cek("kedua sisi footer sejajar",
        abs(kaki["kiri"]["y"] - kaki["kanan"]["y"]) < 6,
        f'({kaki["kiri"]["y"]:.0f} vs {kaki["kanan"]["y"]:.0f})')
    hal.click('[myid="li_page_2"] a')
    hal.wait_for_timeout(150)

    # --- ukuran kertas TIDAK boleh ikut diruntuhkan (A4 = 794px, F4 = 813px) ---
    hal.set_viewport_size({"width": 794, "height": 900})
    hal.wait_for_timeout(250)
    a4 = hal.evaluate("""() => {
      const q = (s) => document.querySelector(s);
      const kv = q('#tgl_lahir_kv');
      const label = kv.closest('.askep-field').querySelector('.askep-label');
      return {
        enamKolom: getComputedStyle(q('#enam_1').closest('.askep-grid')).gridTemplateColumns.split(' ').length,
        kvSebaris: Math.abs(label.getBoundingClientRect().y - kv.getBoundingClientRect().y) < 12,
      };
    }""")
    cek("lebar A4: kolom tidak runtuh", a4["enamKolom"] == 6, str(a4["enamKolom"]))
    cek("lebar A4: Label : isian tetap sebaris", a4["kvSebaris"])

    # --- responsif: layar sempit ---
    hal.set_viewport_size({"width": 420, "height": 900})
    hal.wait_for_timeout(250)
    sempit = hal.evaluate("""() => {
      const q = (s) => document.querySelector(s);
      const a = q('#enam_1').getBoundingClientRect();
      const c = q('#enam_2').getBoundingClientRect();
      const kv = q('#tgl_lahir_kv');
      const kvLabel = kv.closest('.askep-field').querySelector('.askep-label');
      const wrap = q('.askep-table-wrap');
      return {
        enamStack: Math.abs(a.x - c.x) < 2 && c.y > a.y,
        kvStack: kvLabel.getBoundingClientRect().y < kv.getBoundingClientRect().y - 4,
        tabelGeser: getComputedStyle(wrap).overflowX,
        kopKolom: getComputedStyle(q('.askep-header')).flexDirection,
        halamanLebar: q('.askep-page').getBoundingClientRect().width,
      };
    }""")
    cek("layar sempit: 6 kolom menumpuk jadi 1", sempit["enamStack"])
    cek("layar sempit: Label : isian menumpuk", sempit["kvStack"])
    cek("layar sempit: tabel bisa digeser", sempit["tabelGeser"] == "auto", sempit["tabelGeser"])
    cek("layar sempit: kop menumpuk", sempit["kopKolom"] == "column", sempit["kopKolom"])
    cek("layar sempit: tidak melebihi lebar layar", sempit["halamanLebar"] <= 421,
        f'({sempit["halamanLebar"]:.0f}px)')
    hal.close()

    # --------------------------------- huruf section = urutan yang dicetak
    page.locator(".section-head .pagepick").last.select_option("1")
    page.wait_for_timeout(250)
    ui = page.evaluate("""() => {
      const head = [...document.querySelectorAll('.section-head')];
      return head.map((h) => [h.querySelector('.letter')?.textContent,
                              h.querySelector('input').value]);
    }""")
    page.click('.tabs button:has-text("HTML")')
    html3 = page.locator(".codebox").input_value().split("</style>", 1)[-1]
    dari_html = [[m[0], m[1].replace("&amp;", "&")] for m in
                 re.findall(r'askep-section-title">([A-Z])\. ([^<]+)<', html3)]
    urut_ui = sorted(ui, key=lambda x: x[0])
    cek("huruf section di kanvas sama dengan hasil cetak",
        urut_ui == sorted(dari_html, key=lambda x: x[0]),
        f"kanvas={ui} html={dari_html}")
    page.click('.tabs button:has-text("Preview")')

    # ------------------------------- berpindah antara Form / Section / Component
    page.locator(".cell.filled").first.click()
    page.wait_for_timeout(200)
    cek("tab Component aktif setelah memilih sel",
        page.locator(".pane-head .seg.on").inner_text().strip().lower() == "component",
        page.locator(".pane-head .seg.on").inner_text())
    page.locator('.pane-head .seg:has-text("Form")').click()
    page.wait_for_timeout(200)
    cek("tab Form mengembalikan pengaturan formulir",
        page.locator('.insp label:has-text("Hospital name")').count() == 1)

    page.locator(".cell.filled").first.click()
    page.wait_for_timeout(150)
    page.locator('button:has-text("⚙ Header & footer")').click()
    page.wait_for_timeout(400)
    cek("tombol pintas membuka pengaturan kop",
        page.locator('.insp label:has-text("Hospital name")').count() == 1
        and page.locator('.group:has-text("Letterhead")').first.get_attribute("open") is not None)

    # mematikan pembagian sisi -> kop menjadi satu kolom
    page.locator('.insp label:has-text("Split the letterhead") input').uncheck()
    page.wait_for_timeout(250)
    page.click('.tabs button:has-text("HTML")')
    satu = page.locator(".codebox").input_value().split("</style>", 1)[-1]
    cek("kop bisa dijadikan satu kolom", "askep-header--stack" in satu
        and "askep-header--split" not in satu)
    page.locator('.insp label:has-text("Split the letterhead") input').check()
    page.wait_for_timeout(200)
    page.click('.tabs button:has-text("Preview")')

    page.locator(".cell.filled").first.click()
    page.wait_for_timeout(150)
    page.evaluate("""() => {
      const c = document.querySelector('.canvas');
      c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }""")
    page.wait_for_timeout(200)
    cek("klik latar kanvas kembali ke pengaturan formulir",
        page.locator('.insp label:has-text("Hospital name")').count() == 1)

    # ------------------------------------------------ pratinjau layar penuh
    page.click('button:has-text("⛶ Full preview")')
    page.wait_for_timeout(700)
    cek("pratinjau layar penuh terbuka", page.locator(".modal").count() == 1)
    bingkai = page.frame_locator(".modal iframe")
    cek("isi pratinjau penuh ikut terender",
        bingkai.locator(".askep-page").count() == 1)
    ukur = page.evaluate("""() => {
      const s = document.querySelector('.modal .sheet');
      const f = document.querySelector('.modal iframe');
      return { lebar: s.getBoundingClientRect().width, tinggi: f.getBoundingClientRect().height };
    }""")
    cek("kertas A4 pada pratinjau penuh", 780 < ukur["lebar"] < 800, f'({ukur["lebar"]:.0f}px)')
    cek("bingkai menyesuaikan tinggi isi", ukur["tinggi"] > 600, f'({ukur["tinggi"]:.0f}px)')
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    cek("Esc menutup pratinjau penuh", page.locator(".modal").count() == 0)

    # -------------------------------------------------- fitur blok sendiri
    page.click('.tabs button:has-text("Preview")')
    page.evaluate("window.prompt = () => 'My Test Block'")
    page.locator('.section-head button:has-text("Block")').first.click()
    page.wait_for_timeout(200)
    cek("blok tersimpan muncul di palet",
        page.locator('.palette-row .palette-item:has-text("My Test Block")').count() == 1)
    sebelum = page.locator(".section").count()
    page.locator('.palette-row .palette-item:has-text("My Test Block")').click()
    page.wait_for_timeout(250)
    cek("blok bisa disisipkan kembali", page.locator(".section").count() == sebelum + 1)
    page.reload(wait_until="networkidle")
    cek("blok bertahan setelah muat ulang",
        page.locator('.palette-row .palette-item:has-text("My Test Block")').count() == 1)
    page.evaluate("window.confirm = () => true")
    page.locator(".palette-row .btn.danger").first.click()
    page.wait_for_timeout(150)
    cek("blok bisa dihapus",
        page.locator('.palette-row .palette-item:has-text("My Test Block")').count() == 0)

    # ---------------------------------------- kolom fleksibel & TTD via UI
    sebelum_kolom = page.locator(".row-head .colnum").first.inner_text()
    page.locator('.row-head button:has-text("+")').first.click()
    page.wait_for_timeout(150)
    sesudah_kolom = page.locator(".row-head .colnum").first.inner_text()
    cek("tombol + menambah kolom baris",
        sesudah_kolom == str(int(sebelum_kolom) + 1),
        f"{sebelum_kolom} -> {sesudah_kolom}")

    sebelum_ttd = page.locator(".signcard").count()
    page.locator('button:has-text("+ Add signature")').click()
    page.wait_for_timeout(200)
    cek("tanda tangan footer bertambah lewat UI",
        page.locator(".signcard").count() == sebelum_ttd + 1)
    page.click('.tabs button:has-text("HTML")')
    html2 = page.locator(".codebox").input_value()
    cek("paraf_2 ikut terbentuk", 'id="paraf_2"' in html2)

    # ---------------------------------------- bullet list ber-isian
    # (klik kepala section kembali ke panel Form/Section dan mengaktifkan palet)
    page.locator(".section-head").first.click()
    page.wait_for_timeout(150)
    page.locator('.palette-item:has-text("Bullet list")').first.click()
    page.wait_for_timeout(250)
    # pilih SEL berisi komponen list yang barusan ditambahkan (bukan sel terakhir
    # sembarang — penempatannya bergantung pilihan aktif saat menambah)
    page.locator('.cell.filled:has-text("Bullet list")').last.click()
    page.wait_for_timeout(250)
    cek("editor butir list muncul", page.locator(".listitem").count() >= 2)

    for label in ["+ Text field", "+ Dropdown", "+ Date", "+ Choice"]:
        page.locator(f'.seg-add button:has-text("{label}")').first.click()
        page.wait_for_timeout(100)
    # 1 segmen teks bawaan butir 1 + 4 tambahan + 1 segmen teks butir 2 = 6
    cek("segmen bisa ditambah ke butir", page.locator(".seg-row").count() == 6,
        str(page.locator(".seg-row").count()))

    kolomNama = page.locator('.seg-row input[placeholder="name"]')
    for i, nm in enumerate(["hasil_lab", "diagnosa", "tgl_periksa", "jenis_kelamin"]):
        kolomNama.nth(i).fill(nm)
    page.wait_for_timeout(250)

    page.click('.tabs button:has-text("Preview")')
    page.wait_for_timeout(300)
    bingkai = page.frame_locator(".side-view iframe")
    cek("isian tampil sebaris dalam list (pratinjau)",
        bingkai.locator(".askep-list input, .askep-list select").count() == 5,
        str(bingkai.locator(".askep-list input, .askep-list select").count()))

    page.click('.tabs button:has-text("HTML")')
    page.wait_for_timeout(400)
    html3 = page.locator(".codebox").input_value()
    i_hl = html3.find('name="hasil_lab"')      # jangkar = isian yang baru diisi
    potongan = html3[max(0, i_hl - 800):i_hl + 1600] if i_hl > -1 else ""
    cek("list diekspor dengan name & myid",
        'name="hasil_lab"' in potongan and 'name="jenis_kelamin"' in potongan
        and 'myid="check_cara"' in potongan)
    cek("tanggal dalam list dapat datepickerBoots",
        "datepickerBoots" in potongan)
    cek("isian garis bawah memakai kelas askep-garis", "askep-garis" in potongan)
    cek("dropdown dalam list terekspor", "<select" in potongan)
    cek("pilihan radio dalam list terekspor", "askep-radio" in potongan)

    # ---------------------------------------- model tertanam & draft autosave
    stat_a = page.locator(".stat").inner_text()
    cek("ekspor menyematkan model proyek", 'id="askep-model"' in html3)

    pathlib.Path("/tmp/verify-export.html").write_text(html3, encoding="utf-8")
    page.set_input_files('input[type="file"][accept=".html,.htm"]',
                         "/tmp/verify-export.html")
    page.wait_for_timeout(1200)
    cek("ekspor sendiri dipulihkan TANPA layar tinjauan",
        page.locator(".import-table").count() == 0
        and "Restored" in page.locator(".importbar").first.inner_text())
    stat_b = page.locator(".stat").inner_text()
    cek("pemulihan EXACT (stat identik)", stat_a == stat_b,
        f"{stat_a!r} vs {stat_b!r}")

    page.reload(wait_until="networkidle")
    page.wait_for_timeout(900)
    cek("draft tersimpan otomatis & pulih setelah reload",
        "Draft restored" in page.locator(".importbar").first.inner_text()
        and page.locator(".stat").inner_text() == stat_a)
    page.locator('.importbar button:has-text("Dismiss")').first.click()
    page.wait_for_timeout(200)

    # ---------------------------------------- titik radio pada cetakan
    # Regresi: radio yang diceklis harus TERLIHAT saat dicetak. Titiknya
    # dibangun dari border di media print (background bisa dibuang oleh opsi
    # "background graphics" di dialog cetak sebagian peramban).
    page.click('button:has-text("Full preview")')
    page.wait_for_timeout(700)
    page.emulate_media(media="print")
    page.evaluate("""() => {
        const d = document.querySelector('.modal iframe').contentDocument;
        const r = d.querySelector('input[type="radio"]');
        if (r) r.click();
    }""")
    page.wait_for_timeout(200)
    titik = page.evaluate("""() => {
        const d = document.querySelector('.modal iframe').contentDocument;
        const r = d.querySelector('input[type="radio"]:checked');
        if (!r) return null;
        const cs = d.defaultView.getComputedStyle(r, "::after");
        return { border: cs.borderTopWidth, bg: cs.backgroundColor };
    }""")
    cek("titik radio saat cetak berbasis border",
        titik and titik["border"] not in (None, "", "0px")
        and titik["bg"] in ("rgba(0, 0, 0, 0)", "transparent"), str(titik))
    page.emulate_media(media="screen")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

    # galat pemuatan gambar placeholder ({V_PETH}{VLOGO}) bukan galat aplikasi
    nyata = [e for e in errors if "load local resource" not in e
             and "Failed to load resource" not in e]
    cek("tidak ada error di konsol", not nyata, str(nyata[:3]))
    b.close()

print("\n".join(catatan))
print("-" * 60)
if masalah:
    print("\n".join(masalah))
    print(f"\n{len(masalah)} MASALAH")
    sys.exit(1)
print(f"semua {len(catatan)} pemeriksaan lolos")
