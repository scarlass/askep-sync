"""Codemod refactor: ganti nama pengenal Indonesia -> Inggris di src/.
- Komentar & string biasa dilindungi placeholder -> komentar tetap Indonesia.
- Template literal diproses: teks template tetap, interpolasi ${...} ikut kode
  (dengan dukungan sarang ${ `${}` } dan string di dalamnya).
Dipakai untuk refactor besar; disimpan sebagai jejak dokumentasi.
"""
import re
import sys

MAP_R1 = {
    # read.js
    "hapusKomentar": "stripComments", "inventarisField": "fieldInventory",
    "idGanda": "duplicateIds", "cariWadah": "findContainers",
    "cariHalaman": "findPages", "nomorHalaman": "pageNumberOf",
    "rapikan": "tidyText", "teksTanpaKontrol": "textWithoutControls",
    "punyaKontrol": "hasControls", "selLangsung": "directCells",
    "barisLangsung": "directRows", "angkaDari": "numFrom",
    # detect.js
    "POLA_SATUAN": "UNIT_RE", "SATUAN": "UNIT_RE_BASE", "POLA_JUDUL": "TITLE_RE",
    "teksSebelum": "textBefore", "teksSesudah": "textAfter",
    "dariTextarea": "fromTextarea", "dariSelect": "fromSelect",
    "dariInputTeks": "fromTextInput", "dariPilihan": "fromChoiceGroup",
    "namaDari": "nameOf", "bersihkanLabel": "cleanLabel", "dariSel": "detectCell",
    "jenisTabel": "tableKind", "bacaTabelData": "readDataTable",
    "bacaMatriks": "readMatrix", "judulSection": "sectionTitleOf",
    "judulDariGaya": "titleFromStyle", "gayaJudul": "looksLikeTitle",
    # geometry.js
    "TANDA": "MARK_ATTR", "tandaiDoc": "stampDoc", "tanda": "markOf",
    "tanpaTanda": "stripMarks", "duaFrame": "twoRafs",
    "ukurDokumen": "measureDocument", "barisVisual": "visualLines",
    "gabungRect": "mergeRect",
    # build.js struktur
    "MAKS_KOLOM": "MAX_COLS", "ekstrakKop": "extractLetterhead",
    "ekstrakTtd": "extractSignatures", "NAMA_TTD": "TTD_NAME_RE",
    "deskripsiSel": "describeCell", "gabungLabel": "absorbLabels",
    "teksSebelumAda": "hasLeadingText", "serapLabelSatuan": "absorbLabelUnit",
    "pecahGeometri": "splitByGeometry", "susunRow": "assembleRow",
    "buatBaris": "buildRows", "penelusur": "createTraverser",
    "mulaiSection": "startSection", "pastikan": "ensureSection",
    "catat": "record", "prosesTabel": "walkTable", "prosesBaris": "walkRow",
    "prosesElemen": "walkElement", "catatListBertanda": "recordMarkedList",
    # build.js listify
    "TANDA_STRIP": "MARK_DASH_RE", "TANDA_ALPHA": "MARK_ALPHA_RE",
    "TANDA_NUM": "MARK_NUM_RE", "TANDA_AWAL": "MARK_PREFIX_RE",
    "TANDA_LABEL": "MARKED_LABEL_RE", "tandaBaris": "rowMarker",
    "segsDariRow": "segsFromRow", "itemIsian": "sentenceListItem",
    "infoRowBertanda": "rowMarkerInfo", "gabungRunBertanda": "mergeMarkedRows",
    # laporan & nama
    "namaDalamSections": "namesInSections", "namaDalamForm": "namesInForm",
    "laporan": "buildReport", "yakin": "confidence",
    # App / ImportPanel / Inspector / generate
    "terapkanImpor": "applyImport", "namaBerkas": "fileStem",
    "menimpa": "scanning", "pakaiBlok": "useBlock", "banding": "compare",
    "hasilHtml": "resultHtml", "setSemua": "setAll", "BandingPane": "ComparePane",
    "namaField": "fieldNameBox", "kopRef": "headerRef",
    "gayaIdent": "identStyle", "barisIdent": "identRows",
    "posisiIdent": "identPos", "lebarKhusus": "customWidth",
    "aktif": "active", "elemen": "elements", "unduh": "download",
    "kelasTanggal": "dateCls",
    # React senyawa & umum
    "setMenimpa": "setScanning", "setCari": "setSearch", "cari": "search",
    "hapusBlok": "removeBlock", "simpanBlok": "saveBlock",
    "pakaiHalaman": "usesPaging", "jumlahHalaman": "pageCount",
    "sisipkan": "insertBlock", "bagian": "block",
}

COMMON = {
    "judul": "title", "teks": "text", "kelas": "cls", "opsi": "options",
    "pilihan": "choices", "pertama": "first", "sesudah": "after",
    "sebelum": "before", "sebelumnya": "prev", "nama": "name",
    "kosong": "blank", "baris": "rows", "anak": "child", "keluar": "out",
    "dipakai": "used", "kontrol": "controls", "nilai": "value",
    "kiri": "left", "kanan": "right", "bersih": "kept", "gabung": "merged",
}

PER_FILE = {
    "src/App.jsx": {"nama": "names", "bagian": "block"},
    "src/ImportPanel.jsx": {"judul": "title"},
    "src/Inspector.jsx": {"opsi": "opt", "setOpsi": "setOpt"},
    "src/model.js": {"dipakai": "used"},
    "src/import/geometry.js": {
        "anak": "children", "baris": "lines", "kosong": "empty",
        "selesai": "loaded", "sering": "freq", "isi": "content",
    },
    "src/import/read.js": {"anak": "child"},
    "src/import/detect.js": {
        "isiPertama": "firstBody", "kelasA": "clsA", "kepalaTeks": "headIsText",
        "ketKontrol": "noteCtrl", "namaSama": "sameName",
        "semuaPilihan": "allChoices", "dekat": "near", "kata": "words",
        "bernomor": "numbered", "sama": "uniform", "jumlahIsian": "inputCounts",
        "ceklis": "checkCells", "kolomCeklis": "checkCols",
        "adaKeterangan": "hasNote", "contoh": "sample", "ket": "noteCell",
        "kepala": "headRow", "selKepala": "headCells",
        "cocokMatriks": "matrixRows", "daftar": "list", "sel": "cell",
        "jenis": "kind", "tampak": "visible", "tersembunyi": "hiddenCtrls",
        "tebal": "boldTag",
    },
    "src/import/build.js": {
        "barisKontrol": "controlRows", "barisTeks": "textLines",
        "belumAda": "missing", "berKontrol": "withCtrls", "bertanda": "marked",
        "daerah": "regions", "dikenali": "recognized",
        "diselamatkan": "rescued", "disimpanTersembunyi": "keptHiddenNames",
        "gabungan": "joined", "halaman": "pages", "hilang": "lost",
        "infoPertama": "firstInfo", "jenisTanda": "markerKind",
        "judulKop": "titleInHead", "kandidatJudul": "titleCandidate",
        "ketemu": "found", "kop": "head", "kopKlas": "letterheadEl",
        "kota": "city", "namaAsli": "originalNames", "namaKontrol": "ctrlName",
        "namaRS": "hospitalLine", "nilaiAsli": "origValues",
        "nilaiAwal": "initialValue", "pecahan": "splitParts", "peran": "role",
        "punyaPasangan": "hasPair", "sederhana": "plain",
        "semuaHilang": "allLost", "semuaPilihan": "allChoices",
        "sudah": "seen", "sudahAda": "covered", "teksDalam": "innerText",
        "teksLuar": "outerText", "totalTeks": "totalText",
        "trsTabel": "tableRows", "ttd": "sigs", "tutupPilihan": "closeChoice",
        "ukur": "measurement", "unik": "unique", "wadah": "containers",
        "wadahLabel": "labelBox", "anak": "kids", "pola": "IDENT_RE",
        "tambah": "addName", "kandidat": "candidates", "blok": "block",
        "nomor": "num", "dibangunUlang": "rebuiltNames", "isi": "content",
    },
}


def _regex_ok(out) -> bool:
    """Apakah '/' di posisi sekarang pembuka literal regex? Heuristik: karakter
    bermakna terakhir (penanda placeholder dilewati) bukan pengenal/angka/
    ) ] > = (yang menandakan pembagian atau JSX self-closing)."""
    k = len(out) - 1
    while k >= 0:
        ch = out[k]
        if ch == "\x00":                       # akhir placeholder: lewati isinya
            k -= 1
            while k >= 0 and out[k].isdigit():
                k -= 1
            continue                            # lanjut lihat karakter sebelumnya
        if ch in (" ", "\t", "\n", "\r"):
            k -= 1
            continue
        return not (ch.isalnum() or ch in "_$)]<")
    return True


def lex_and_rename(src: str, mapping: dict) -> str:
    """Lexer berstatus: code / tpl (teks template) / expr (isi ${...}).
    Komentar & string biasa -> placeholder (tak di-rename); teks template
    dibiarkan apa adanya; kode di dalam interpolasi ${...} ikut di-rename."""
    out, ph = [], []
    stack = ["code"]            # "code" | "tpl" | "expr"
    depth = 0                   # kedalaman kurung kurawal di dalam expr
    i, n = 0, len(src)

    def protect(j_end):         # simpan src[i:j_end] sebagai placeholder
        ph.append(src[i:j_end])
        out.append(f"\x00{len(ph) - 1}\x00")
        return j_end

    while i < n:
        st = stack[-1]
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""

        if st == "tpl":
            # teks template: salin sampai ` (tutup) atau ${
            j = i
            while j < n and src[j] != "`" and not (src[j] == "$" and nxt_of(src, j) == "{"):
                j += 1
            if j < n and src[j] == "`":
                out.append(src[i:j + 1]); i = j + 1; stack.pop()
            elif j < n:                      # ${
                out.append(src[i:j + 2]); i = j + 2
                stack.append("expr"); depth = 0
            else:
                out.append(src[i:]); i = n
            continue

        if st == "code" and ch == "/" and nxt not in ("", "/", "*", ">") and _regex_ok(out):
            # literal regex: telusuri sampai '/' penutup (lewati kelas [...])
            j, dalam_kelas = i + 1, False
            while j < n:
                c2 = src[j]
                if c2 == "\\":
                    j += 2
                    continue
                if c2 == "[":
                    dalam_kelas = True
                elif c2 == "]":
                    dalam_kelas = False
                elif c2 == "/" and not dalam_kelas:
                    break
                j += 1
            while j < n and src[j + 1:j + 2].isalpha():
                j += 1                      # bendera (g/i/m/u/s/y)
            ph.append(src[i:j + 1])
            out.append(f"\x00{len(ph) - 1}\x00")
            i = j + 1
            continue
        if st == "code" and ch == "/" and nxt == "/":
            j = src.find("\n", i); j = n if j == -1 else j
            i = protect(j)
            continue
        if st == "code" and ch == "/" and nxt == "*":
            j = src.find("*/", i); j = n if j == -1 else j + 2
            i = protect(j)
            continue
        if ch in ("'", '"'):
            j = i + 1
            while j < n and src[j] != ch:
                j += 2 if src[j] == "\\" else 1
            i = protect(min(j + 1, n))
            continue
        if ch == "`":
            out.append(ch); i += 1; stack.append("tpl")
            continue
        if st == "expr":
            if ch == "{":
                depth += 1
            elif ch == "}":
                if depth == 0:
                    out.append(ch); i += 1; stack.pop()
                    continue
                depth -= 1
        out.append(ch)
        i += 1

    code = "".join(out)
    for old, new in mapping.items():
        code = re.sub(rf"\b{re.escape(old)}\b", new, code)
    code = (code.replace('"tinggi"', '"high"').replace('"sedang"', '"medium"')
                .replace('"rendah"', '"low"')
                .replace(".tinggi", ".high").replace(".sedang", ".medium")
                .replace(".rendah", ".low")
                .replace("tinggi:", "high:").replace("sedang:", "medium:")
                .replace("rendah:", "low:"))
    return re.sub(r"\x00(\d+)\x00", lambda m: ph[int(m.group(1))], code)


def nxt_of(src, j):
    return src[j + 1:j + 2]


if __name__ == "__main__":
    for path in sys.argv[1:]:
        src = open(path, encoding="utf-8").read()
        mapping = {**MAP_R1, **COMMON, **PER_FILE.get(path, {})}
        open(path, "w", encoding="utf-8").write(lex_and_rename(src, mapping))
        print("rename:", path)
