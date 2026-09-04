/* ==========================================================================
   model.js — definisi data formulir
   ==========================================================================
   Struktur:

     form
       meta       : judul, kode dokumen, kop (header), footer, paging, atribut
       sections[] : { id, title, page, rows[] }
         rows[]   : { id, cols: 1..6, widths: "", cells: [komponen | null] }
           cells  : satu komponen per kolom; komponen boleh melebar (span)

   Teks antarmuka memakai bahasa Inggris; ISI formulir yang dihasilkan (label
   bawaan, blok siap pakai) tetap bahasa Indonesia karena itu yang tercetak.
   ========================================================================== */

let counter = 0;
export const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const MAX_COLS = 6;

/* Sifat yang dipakai banyak komponen isian:
   layout  : "atas"    -> label di atas kotak isian
             "samping" -> pola "Label : isian" sejajar
   labelWidth : lebar kolom label saat layout samping (boleh px, %, mm)
   width      : lebar kotak isian (boleh px, %, mm; kosong = penuh)
   span       : berapa kolom yang ditempati sel ini */
const isian = (extra = {}) => ({
    label: "Label", field: "", required: false, hint: "",
    layout: "atas", labelWidth: "160px", colon: true, width: "", span: 1,
    ...extra,
});

/* --------------------------------------------------------------------------
   Katalog komponen
   -------------------------------------------------------------------------- */
export const CATALOG = [
    /* ---------------------------------------------------------------- Fields */
    {
        type: "text", name: "Text field", icon: "abc", group: "Fields",
        make: () => isian({ placeholder: "", unit: "", boxed: false, readOnly: false, value: "" }),
    },
    {
        type: "textarea", name: "Long text", icon: "¶", group: "Fields",
        make: () => isian({ placeholder: "", rows: 3, ruled: false, boxed: false }),
    },
    {
        type: "number", name: "Number", icon: "123", group: "Fields",
        make: () => isian({
            label: "Angka", placeholder: "", unit: "", width: "80px",
            min: "", max: "", step: "", boxed: false
        }),
    },
    {
        type: "date", name: "Date", icon: "📅", group: "Fields",
        make: () => isian({
            label: "Tanggal", placeholder: "dd-mm-yy",
            withTime: false, width: ""
        }),
    },
    {
        type: "time", name: "Time", icon: "🕘", group: "Fields",
        make: () => isian({ label: "Jam", placeholder: "hh:mm", suffix: "WIB", width: "70px" }),
    },
    {
        type: "daterange", name: "Date range", icon: "⇥", group: "Fields",
        make: () => isian({
            label: "Periode", field: "", fieldTo: "", separator: "s.d.",
            width: "120px"
        }),
    },
    {
        type: "select", name: "Dropdown", icon: "▾", group: "Fields",
        make: () => isian({
            kind: "static",
            options: [{ label: "Pilihan 1", value: "1" }, { label: "Pilihan 2", value: "2" }],
            firstBlank: "- Pilih -", dynamicOptions: "",
        }),
    },
    {
        type: "kv", name: "Label : value", icon: "：", group: "Fields",
        make: () => ({
            label: "Label", field: "", kind: "text", labelWidth: "160px", unit: "",
            width: "120px", center: false, hint: "",
            options: [{ label: "Ya", value: "" }, { label: "Tidak", value: "" }],
            value: "", required: false, span: 1
        }),
    },
    {
        type: "boxes", name: "Character boxes", icon: "▢▢", group: "Fields",
        make: () => isian({ label: "No. Rekam Medis", count: 8, width: "" }),
    },
    {
        type: "static", name: "System value", icon: "{}", group: "Fields",
        make: () => ({
            label: "Nama Pasien", value: "{NAME_REAL}", strong: true, hint: "",
            layout: "atas", labelWidth: "160px", colon: true, span: 1
        }),
    },
    {
        type: "hidden", name: "Hidden field", icon: "•", group: "Fields",
        make: () => ({ field: "regpid", value: "{REGPID}", span: 1 }),
    },

    /* --------------------------------------------------------------- Choices */
    {
        type: "checkbox", name: "Checkbox", icon: "☑", group: "Choices",
        make: () => isian({
            options: [{ label: "Opsi A", value: "" }, { label: "Opsi B", value: "" }],
            columns: 0, otherField: "",
        }),
    },
    {
        type: "radio", name: "Radio", icon: "◉", group: "Choices",
        make: () => isian({
            options: [{ label: "Ya", value: "t" }, { label: "Tidak", value: "f" }],
            columns: 0, otherField: "",
        }),
    },
    {
        type: "checkfill", name: "Checkbox + fill-in", icon: "☑_", group: "Choices",
        make: () => isian({
            label: "Keluhan",
            items: [{ text: "Nyeri, lokasi", field: "keluhan_nyeri" },
            { text: "Mual", field: "" }],
            columns: 0, fillWidth: "120px",
        }),
    },
    {
        type: "scale", name: "Numeric scale", icon: "0-10", group: "Choices",
        make: () => isian({
            label: "Skala Nyeri", min: 0, max: 10,
            leftLabel: "Tidak nyeri", rightLabel: "Nyeri hebat"
        }),
    },
    {
        type: "score", name: "Score / total box", icon: "Σ", group: "Choices",
        make: () => isian({
            label: "Total Skor", width: "60px", unit: "",
            note: "0-24 rendah · 25-44 sedang · ≥45 tinggi",
            boxed: true, readOnly: false
        }),
    },

    /* -------------------------------------------------------------- Layout */
    {
        type: "matrix", name: "Checklist matrix", icon: "▦", group: "Layout",
        make: () => ({
            title: "", itemHeader: "Pemeriksaan",
            choices: ["Ya", "Tidak"], noteColumn: "Keterangan",
            items: [{ text: "Item 1", field: "", noteField: "" },
            { text: "Item 2", field: "", noteField: "" }],
            single: true, span: 1,
        }),
    },
    {
        type: "table", name: "Data table", icon: "▤", group: "Layout",
        make: () => ({
            columns: [{ head: "Nama Obat", field: "obat", width: "" },
            { head: "Dosis", field: "dosis", width: "90px" }],
            rows: 3, numbered: true, addButton: false, addLabel: "Tambah baris", span: 1,
        }),
    },
    {
        type: "paragraph", name: "Text / paragraph", icon: "T", group: "Layout",
        make: () => ({ html: "Tulis keterangan di sini.", strong: false, center: false, span: 1 }),
    },
    {
        type: "subtitle", name: "Subheading", icon: "H", group: "Layout",
        make: () => ({ text: "Sub-judul", italic: false, span: 1 }),
    },
    {
        type: "list", name: "Bullet list", icon: "≔", group: "Layout",
        /* butir = { segs: [segmen …] }; butir lama berupa string otomatis
           dikonversi normalise() menjadi segmen teks */
        make: () => ({
            marker: "decimal",
            items: [
                { segs: [{ type: "text", text: "Poin pertama" }] },
                { segs: [{ type: "text", text: "Poin kedua" }] },
            ],
            span: 1,
        }),
    },
    {
        type: "note", name: "Callout box", icon: "❗", group: "Layout",
        make: () => ({ html: "Perhatian: isi dengan huruf cetak.", plain: false, span: 1 }),
    },
    {
        type: "image", name: "Image", icon: "🖼", group: "Layout",
        make: () => ({ src: "", alt: "Gambar", height: "40mm", caption: "", center: true, span: 1 }),
    },
    {
        type: "divider", name: "Divider line", icon: "—", group: "Layout",
        make: () => ({ dashed: true, span: 1 }),
    },
    {
        type: "spacer", name: "Empty space", icon: "␣", group: "Layout",
        make: () => ({ height: "10px", span: 1 }),
    },
    {
        type: "pagebreak", name: "Print page break", icon: "✂", group: "Layout",
        make: () => ({ span: 1 }),
    },
    {
        type: "signature", name: "Signature", icon: "✍", group: "Layout",
        make: () => ({
            role: "Petugas", place: "Bandung", withDate: true,
            withSelect: true, selectField: "dokter1", parafIndex: 1,
            withPentablet: true, span: 1
        }),
    },
    {
        type: "button", name: "Action button", icon: "⏵", group: "Layout",
        make: () => ({ label: "Hitung", elementId: "btnHitung", extraClass: "", span: 1 }),
    },
    {
        type: "html", name: "Raw HTML", icon: "</>", group: "Layout",
        make: () => ({ html: "<!-- tempel HTML apa pun di sini -->", span: 1 }),
    },
];

export const GROUPS = ["Fields", "Choices", "Layout"];

export const catalogOf = (type) => CATALOG.find((c) => c.type === type);

export function makeComponent(type) {
    const def = catalogOf(type);
    return { id: uid("c"), type, ...def.make() };
}

/* --------------------------------------------------------------------------
   Baris, section, formulir
   -------------------------------------------------------------------------- */
export function makeRow(cols = 2) {
    const n = Math.min(Math.max(cols, 1), MAX_COLS);
    return { id: uid("r"), cols: n, widths: "", cells: Array.from({ length: n }, () => null) };
}

export function makeSection(title = "New section", page = 1) {
    return { id: uid("s"), title, page, rows: [makeRow(2)] };
}

/* Satu blok tanda tangan di footer. Nomor parafnya ditentukan urutan. */
/* satu baris pada kotak identitas kop */
/* ==========================================================================
   Segmen butir list (bullet list ber-isian)
   ==========================================================================
   Satu butir list adalah rangkaian segmen sebaris:
   - text   : teks bebas (boleh HTML inline sederhana)
   - field  : isian teks (garis bawah / kotak, lebar atur sendiri)
   - select : dropdown ber-opsi
   - date   : isian tanggal (otomatis datepickerBoots saat diekspor)
   - time   : isian jam
   - choice : grup radio/checkbox ber-opsi
   ========================================================================== */
const SEGBAKU = {
    text: { type: "text", text: "" },
    field: { type: "field", field: "", width: "50mm", inputStyle: "garis", placeholder: "" },
    select: { type: "select", field: "", options: ["Pilihan 1", "Pilihan 2"], width: "50mm" },
    date: { type: "date", field: "", width: "28mm" },
    time: { type: "time", field: "", width: "18mm" },
    choice: { type: "choice", field: "", choice: "radio", options: ["Ya", "Tidak"] },
};

export function makeListSeg(type, patch = {}) {
    return { ...(SEGBAKU[type] || SEGBAKU.text), ...patch };
}

/* Terima butir lama (string) maupun baru ({ segs }) -> bentuk baku. */
export function normaliseListItem(it) {
    if (typeof it === "string" || it == null) {
        return { segs: [makeListSeg("text", { text: typeof it === "string" ? it : "Item" })] };
    }
    const segs = (it.segs || []).map((s) => makeListSeg(s?.type || "text", s || {}));
    return { segs: segs.length ? segs : [makeListSeg("text", { text: "Item" })] };
}

/* Terima opsi radio/checkbox lama (string) maupun baru ({label,value}). */
export function normaliseOption(o) {
    if (typeof o === "string" || o == null) return { label: o ?? "", value: "" };
    return { label: o.label ?? "", value: o.value ?? "" };
}

export function makeIdentRow(key = "Label") {
    return {
        key, type: "static", value: "", field: "", options: ["Ya", "Tidak"],
        multi: false, full: false, width: ""
    };
}

export function makeSign(role = "Petugas") {
    return {
        id: uid("g"), role, place: "Bandung", withDate: true, withTime: true,
        withSelect: false, selectField: "", withName: true, withPentablet: true,
        side: "kanan",     // dipakai bila footer dibagi dua sisi
    };
}

export function defaultHeader() {
    return {
        showLogo: true,
        logoSrc: "{V_PETH}{VLOGO}",
        logoWidth: "18mm",
        hospitalName: "{RS_NAMA}",
        addressLines: "{RS_ALAMAT}\nTelp. {RS_TELEPON} | Fax. {RS_FAX}",
        showTitle: true,
        showDocCode: true,
        extraHtml: "",
        showIdent: true,
        identWidth: "100%",        // lebar kotak identitas DI DALAM sisinya
        identAlign: "kanan",       // posisi kotak dalam sisi: kiri | tengah | kanan
        identKeyWidth: "1fr",      // lebar kolom label identitas
        identValueWidth: "30mm",   // lebar kolom nilai identitas
        identFontSize: "",         // kosong = ikut ukuran baku (9.5pt)
        everyPage: false,          // kop diulang di tiap halaman?

        /* --- dua sisi --- */
        split: true,               // false = semua isi menumpuk satu kolom
        leftWidth: "1fr",          // lebar sisi kiri  (px, %, mm, fr, auto)
        rightWidth: "62mm",        // lebar sisi kanan
        divider: true,             // garis pemisah antar sisi
        leftAlign: "kiri",         // kiri | tengah | kanan
        rightAlign: "kanan",
        /* penempatan tiap blok: "kiri" atau "kanan" */
        logoSide: "kiri",
        infoSide: "kiri",          // nama rumah sakit + alamat
        titleSide: "kiri",         // judul formulir + kode + baris tambahan
        identSide: "kanan",        // kotak identitas pasien

        /* Tiap baris identitas:
             type  : "static" (nilai sistem) | "input" (isian teks) |
                     "date" (isian tanggal)  | "blank" (garis kosong) |
                     "options" (pilihan ceklis / radio)
             key   : teks label
             value : isi untuk type "static"
             field : atribut name untuk type input/date/options
             full  : baris memakai lebar penuh (label di atas isian)
             width : lebar isian BARIS INI saja; kosong = ikut kolom nilai      */
        ident: [
            { key: "No. RM", type: "static", value: "{NO_RM}", field: "", options: [], full: false },
            { key: "Nama", type: "static", value: "{NAME_REAL}", field: "", options: [], full: false },
            { key: "Tgl Lahir", type: "static", value: "{TGL_LAHIR}", field: "", options: [], full: false },
        ],
    };
}

export function defaultFooter() {
    return {
        align: "kanan",              // kanan | kiri | tengah | rata (mode satu baris)
        note: "",                    // catatan bebas di bawah tanda tangan
        showPrintDate: false,        // baris "Dicetak: {TGL_CETAK}"
        everyPage: false,            // footer diulang di tiap halaman?

        /* --- dua sisi --- */
        split: false,                // true = footer dibagi kiri & kanan
        leftWidth: "1fr",
        rightWidth: "1fr",
        leftAlign: "kiri",           // kiri | tengah | kanan
        rightAlign: "kanan",
        noteSide: "kiri",            // catatan ikut sisi mana

        signs: [makeSign("Petugas")],
    };
}

/* Paging mengikuti pola aplikasi rumah sakit:
   <ul class="pagination"> + <fieldset id="dokumen_page_N" class="hidden">   */
export function defaultPaging() {
    return {
        enabled: false,
        label: "Page",
        navTop: true,
        navBottom: true,
        idPrefix: "dokumen_page_",
        hiddenClass: "hidden",
        functionName: "NextPage",
        includeScript: true,   // sisipkan NextPage() bila aplikasi belum punya
        printAll: false,       // cetak semua halaman, bukan hanya yang tampil
    };
}

export function makeForm() {
    return {
        version: 3,
        meta: {
            title: "Judul Formulir",
            docCode: "",
            showHeader: true,
            showFooter: true,
            letterSections: true,     // beri huruf A. B. C. otomatis
            formClass: "smart-form",
            dataTtd: "yes",
            embedModel: true,       // sematkan model proyek di ekspor HTML (round-trip)
            fieldAttr: 'myid="check_cara"',
            dateClass: "datepickerBoots",
            pageWidth: "none",
            header: defaultHeader(),
            footer: defaultFooter(),
            paging: defaultPaging(),
        },
        sections: [makeSection("Identitas Pasien", 1)],
    };
}

/* Jumlah halaman = nomor halaman terbesar yang dipakai section. */
export function pageCount(form) {
    if (!form.meta.paging?.enabled) return 1;
    return Math.max(1, ...form.sections.map((s) => Number(s.page) || 1));
}

/* --------------------------------------------------------------------------
   Nomor paraf berikutnya yang belum terpakai.
   Tiap tanda tangan di footer memakai nomor 1..n sesuai urutannya, jadi blok
   tanda tangan di dalam body harus memakai nomor lain — kalau tidak, id
   `paraf_N` menjadi ganda.
   -------------------------------------------------------------------------- */
export function footerSigns(form) {
    if (!form.meta.showFooter) return [];
    return form.meta.footer?.signs || [];
}

export function nextParafIndex(form) {
    const used = new Set(footerSigns(form).map((_, i) => i + 1));
    (form.sections || []).forEach((s) =>
        (s.rows || []).forEach((r) =>
            (r.cells || []).forEach((c) => {
                if (c && c.type === "signature") used.add(Number(c.parafIndex) || 1);
            })));
    let i = 1;
    while (used.has(i)) i += 1;
    return i;
}

/* --------------------------------------------------------------------------
   Placeholder data pasien — daftar bantu, tetap boleh diketik bebas
   -------------------------------------------------------------------------- */
export const PLACEHOLDERS = [
    "{NO_RM}", "{NAME_REAL}", "{TGL_LAHIR}", "{UMUR}", "{SEX}", "{DPJP}",
    "{ROOM_NAME}", "{NO_KTP}", "{REGPID}",
    "{RS_NAMA}", "{RS_ALAMAT}", "{RS_TELEPON}", "{RS_FAX}", "{RS_EMAIL}",
    "{V_PETH}", "{VLOGO}", "{TGL_CETAK}",
];

/* --------------------------------------------------------------------------
   Blok siap pakai — nama blok bahasa Inggris (antarmuka), isinya Indonesia
   -------------------------------------------------------------------------- */
function comp(type, patch) {
    return { ...makeComponent(type), ...patch };
}

function rowOf(...cells) {
    const r = makeRow(cells.length || 1);
    r.cells = cells;
    return r;
}

function rowWide(widths, ...cells) {
    const r = rowOf(...cells);
    r.widths = widths;
    return r;
}

export const PRESETS = [
    {
        key: "identitas",
        name: "Block: Patient Identity",
        note: "Nama, No. RM, tanggal lahir, jenis kelamin",
        build: () => ({
            title: "Identitas Pasien",
            rows: [
                rowOf(comp("static", { label: "Nama Pasien", value: "{NAME_REAL}" }),
                    comp("static", { label: "No. Rekam Medis", value: "{NO_RM}" })),
                rowOf(comp("static", { label: "Tanggal Lahir / Umur", value: "{TGL_LAHIR} / {UMUR}" }),
                    comp("static", { label: "Jenis Kelamin", value: "{SEX}" })),
                rowOf(comp("date", {
                    label: "Tanggal / Jam Pengkajian", field: "tgl_pengkajian",
                    withTime: true, required: true
                }),
                    comp("text", { label: "DPJP", field: "dpjp" })),
            ],
        }),
    },
    {
        key: "identitas-kv",
        name: "Block: Identity (Label : value)",
        note: "Pola bertitik dua sejajar, satu kolom",
        build: () => ({
            title: "Identitas Pasien",
            rows: [
                rowOf(comp("static", {
                    label: "Nama Pasien", value: "{NAME_REAL}",
                    layout: "samping", labelWidth: "170px"
                })),
                rowOf(comp("static", {
                    label: "No. Rekam Medis", value: "{NO_RM}",
                    layout: "samping", labelWidth: "170px"
                })),
                rowOf(comp("date", {
                    label: "Tanggal Masuk", field: "tgl_masuk",
                    layout: "samping", labelWidth: "170px", width: "140px"
                })),
                rowOf(comp("select", {
                    label: "Ruang Perawatan", field: "ruang",
                    options: ["Melati", "Anggrek", "ICU"],
                    layout: "samping", labelWidth: "170px", width: "45%"
                })),
            ],
        }),
    },
    {
        key: "ttv",
        name: "Block: Vital Signs",
        note: "TD, nadi, suhu, SPO2, pernapasan",
        build: () => ({
            title: "Tanda-tanda Vital",
            rows: [
                rowOf(comp("text", { label: "Tekanan Darah", field: "td", unit: "mmHg" }),
                    comp("text", { label: "Nadi", field: "nadi", unit: "x/menit" })),
                rowOf(comp("text", { label: "Suhu", field: "suhu", unit: "°C" }),
                    comp("text", { label: "Pernapasan", field: "rr", unit: "x/menit" })),
                rowOf(comp("text", { label: "SPO2", field: "spo2", unit: "%" }),
                    comp("text", {
                        label: "Skala Nyeri", field: "nyeri",
                        hint: "NIRS / WBFS / NIPS"
                    })),
            ],
        }),
    },
    {
        key: "antropometri",
        name: "Block: Anthropometry",
        note: "BB, TB, IMT dengan tombol hitung",
        build: () => ({
            title: "Antropometri",
            rows: [
                rowWide("1fr 1fr 1fr",
                    comp("number", { label: "Berat Badan", field: "bb", unit: "kg", width: "70px" }),
                    comp("number", { label: "Tinggi Badan", field: "tb", unit: "cm", width: "70px" }),
                    comp("number", {
                        label: "IMT", field: "imt", unit: "kg/m²", width: "70px",
                        readOnly: true, hint: "terisi otomatis"
                    })),
                rowOf(comp("button", { label: "Hitung IMT", elementId: "btnHitungIMT" })),
            ],
        }),
    },
    {
        key: "nyeri",
        name: "Block: Pain Screening",
        note: "Skala 0-10, lokasi, kualitas, durasi",
        build: () => ({
            title: "Skrining Nyeri",
            rows: [
                rowOf(comp("scale", {
                    label: "Skala Nyeri (NRS)", field: "skala_nyeri",
                    min: 0, max: 10,
                    leftLabel: "0 = tidak nyeri", rightLabel: "10 = nyeri hebat"
                })),
                rowOf(comp("text", { label: "Lokasi Nyeri", field: "lokasi_nyeri" }),
                    comp("select", {
                        label: "Kualitas", field: "kualitas_nyeri",
                        options: ["Tertusuk", "Tertekan", "Terbakar", "Kram"]
                    })),
                rowOf(comp("checkfill", {
                    label: "Faktor Pencetus", field: "pencetus",
                    items: [{ text: "Gerakan", field: "" }, { text: "Istirahat", field: "" },
                    { text: "Lainnya", field: "pencetus_lain" }],
                })),
            ],
        }),
    },
    {
        key: "jatuh",
        name: "Block: Fall Risk",
        note: "Matriks skor + kotak total + tindak lanjut",
        build: () => ({
            title: "Skrining Risiko Jatuh",
            rows: [
                rowOf(comp("matrix", {
                    itemHeader: "Parameter", choices: ["Ya", "Tidak"], noteColumn: "Skor",
                    items: [{ text: "Riwayat jatuh dalam 3 bulan terakhir", field: "jatuh_riwayat" },
                    { text: "Diagnosis sekunder (> 1 diagnosis)", field: "jatuh_diagnosis" },
                    { text: "Alat bantu jalan", field: "jatuh_alat" },
                    { text: "Terpasang infus / heparin lock", field: "jatuh_infus" }],
                })),
                rowOf(comp("score", {
                    label: "Total Skor", field: "jatuh_total",
                    note: "0-24 rendah · 25-44 sedang · ≥45 tinggi"
                })),
                rowOf(comp("radio", {
                    label: "Tindak Lanjut", field: "jatuh_tindak",
                    options: ["Tanpa intervensi", "Intervensi standar",
                        "Intervensi risiko tinggi"]
                })),
            ],
        }),
    },
    {
        key: "alergi",
        name: "Block: Allergies",
        note: "Ada / tidak ada + tabel rincian alergi",
        build: () => ({
            title: "Riwayat Alergi",
            rows: [
                rowOf(comp("radio", {
                    label: "Status Alergi", field: "alergi_status",
                    options: ["Tidak ada", "Tidak diketahui", "Ada"]
                })),
                rowOf(comp("table", {
                    columns: [{ head: "Jenis Alergen", field: "alergen", width: "" },
                    { head: "Reaksi", field: "alergi_reaksi", width: "" },
                    { head: "Tingkat Keparahan", field: "alergi_derajat", width: "120px" }],
                    rows: 2, numbered: true, addButton: true,
                })),
            ],
        }),
    },
    {
        key: "obat",
        name: "Block: Medication Table",
        note: "Tabel data dengan tombol tambah baris",
        build: () => ({
            title: "Daftar Obat",
            rows: [
                rowOf(comp("table", {
                    columns: [{ head: "Nama Obat", field: "nama_obat", width: "" },
                    { head: "Dosis", field: "dosis", width: "90px" },
                    { head: "Rute", field: "rute", width: "90px" },
                    { head: "Jam", field: "jam_obat", width: "90px" }],
                    rows: 3, numbered: true, addButton: true,
                })),
            ],
        }),
    },
    {
        key: "matriks",
        name: "Block: Systematic Assessment",
        note: "Matriks item × Ya / Tidak / Keterangan",
        build: () => ({
            title: "Asesmen Sistematik",
            rows: [
                rowOf(comp("matrix", {
                    itemHeader: "General", choices: ["Ya", "Tidak"], noteColumn: "Keterangan",
                    items: [{ text: "Lelah", field: "gen_lelah" },
                    { text: "Gangguan tidur", field: "gen_tidur" },
                    { text: "Postur dan pola jalan", field: "gen_postur" }],
                })),
            ],
        }),
    },
    {
        key: "edukasi",
        name: "Block: Education & Consent",
        note: "Materi edukasi, metode, kotak catatan",
        build: () => ({
            title: "Edukasi Pasien / Keluarga",
            rows: [
                rowOf(comp("checkbox", {
                    label: "Materi Edukasi", field: "edukasi_materi",
                    columns: 2,
                    options: ["Penyakit & rencana perawatan", "Obat",
                        "Diet & nutrisi", "Manajemen nyeri"]
                })),
                rowOf(comp("radio", {
                    label: "Metode", field: "edukasi_metode",
                    options: ["Lisan", "Demonstrasi", "Leaflet"]
                }),
                    comp("radio", {
                        label: "Evaluasi", field: "edukasi_evaluasi",
                        options: ["Paham", "Perlu pengulangan"]
                    })),
                rowOf(comp("note", { html: "Edukasi wajib diberikan dalam 24 jam pertama perawatan." })),
            ],
        }),
    },
    {
        key: "ttd",
        name: "Block: Signature",
        note: "Tempat, tanggal, paraf, nama terang",
        build: () => ({
            title: "Pengesahan",
            rows: [rowOf(comp("signature", { role: "Perawat" }))],
        }),
    },
];

/* --------------------------------------------------------------------------
   Blok buatan sendiri — disimpan di server (lihat src/api/client.js)
   -------------------------------------------------------------------------- */

/* Salin section menjadi blok (id lama dibuang supaya tidak bentrok). */
export function sectionToBlock(section, name) {
    return {
        key: uid("b"),
        name: name || section.title || "Untitled block",
        note: `${section.rows.length} rows`,
        section: {
            title: section.title,
            rows: JSON.parse(JSON.stringify(section.rows)).map((r) => {
                delete r.id;
                (r.cells || []).forEach((c) => { if (c) delete c.id; });
                return r;
            }),
        },
    };
}

/* Bangun ulang section dari blok, dengan id baru. */
export function blockToSection(block, page = 1) {
    const s = JSON.parse(JSON.stringify(block.section));
    return {
        id: uid("s"),
        title: s.title || block.name,
        page,
        rows: (s.rows || []).map((r) => ({
            ...r,
            id: uid("r"),
            cells: (r.cells || []).map((c) => (c ? { ...c, id: uid("c") } : null)),
        })),
    };
}

/* --------------------------------------------------------------------------
   Muat / simpan
   -------------------------------------------------------------------------- */
export function normalise(form) {
    const dasar = makeForm();
    const f = { ...dasar, ...form };
    f.meta = { ...dasar.meta, ...(form.meta || {}) };
    f.meta.header = { ...defaultHeader(), ...(form.meta?.header || {}) };
    /* Berkas lama menyimpan lebar kotak identitas pada identWidth. */
    if (form.meta?.header?.identWidth && !form.meta?.header?.rightWidth) {
        f.meta.header.rightWidth = form.meta.header.identWidth;
        f.meta.header.identWidth = defaultHeader().identWidth;
    }
    f.meta.footer = { ...defaultFooter(), ...(form.meta?.footer || {}) };
    f.meta.paging = { ...defaultPaging(), ...(form.meta?.paging || {}) };

    /* Berkas versi 1 menyimpan kota & peran penanda tangan langsung di meta. */
    if (!form.meta?.footer && (form.meta?.city || form.meta?.signRole)) {
        f.meta.footer.signs = [{
            ...makeSign(form.meta.signRole || "Petugas"),
            place: form.meta.city || "Bandung",
            withSelect: false
        }];
    }
    /* baris identitas lama hanya punya key+value -> dianggap nilai sistem */
    f.meta.header.ident = (f.meta.header.ident || []).map((it) => ({
        key: "", type: "static", value: "", field: "", options: [], multi: false,
        full: false, width: "", ...it,
        type: it.type || "static",
    }));

    f.meta.footer.signs = (f.meta.footer.signs || []).map((g) => ({ ...makeSign(), ...g }));
    if (!f.meta.footer.signs.length) f.meta.footer.signs = [makeSign()];
    delete f.meta.city;
    delete f.meta.signRole;

    f.sections = (form.sections || []).map((s) => ({
        id: s.id || uid("s"),
        title: s.title || "",
        page: Math.max(1, Number(s.page) || 1),
        rows: (s.rows || []).map((r) => {
            const cols = Math.min(Math.max(r.cols || 1, 1), MAX_COLS);
            const cells = Array.from({ length: cols }, (_, i) => {
                const c = (r.cells || [])[i] || null;
                if (c) c.span = Math.min(Math.max(Number(c.span) || 1, 1), cols);
                return c;
            });
            return { id: r.id || uid("r"), cols, widths: r.widths || "", cells };
        }),
    }));
    if (!f.sections.length) f.sections = [makeSection("Identitas Pasien", 1)];

    /* Butir list lama berupa string -> dikonversi jadi segmen teks supaya
       formulir .json lama tetap bisa dibuka tanpa perubahan. */
    f.sections.forEach((s) => s.rows.forEach((r) => r.cells.forEach((c) => {
        if (c && c.type === "list") {
            c.items = (c.items || []).map(normaliseListItem);
            if (!c.items.length) c.items = [normaliseListItem("Item")];
        }
        if (c && (c.type === "checkbox" || c.type === "radio" || c.type === "select" || c.type === "kv")) {
            c.options = (c.options || []).map(normaliseOption);
            if (!c.options.length) c.options = [normaliseOption("Opsi")];
        }
    })));
    return f;
}
