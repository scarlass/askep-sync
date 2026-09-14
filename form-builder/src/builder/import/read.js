/* ==========================================================================
   import/read.js — membaca berkas HTML lama menjadi bahan mentah yang bersih
   ==========================================================================
   Tugas berkas ini HANYA membaca dan membersihkan; pengenalan komponen ada di
   detect.js. Semua berjalan di peramban memakai DOMParser (tanpa server).
   ========================================================================== */

/* Placeholder data pasien yang dipakai aplikasi. */
export const PLACEHOLDER_RE = /\{(NO_RM|NAME_REAL|TGL_LAHIR|UMUR|SEX|DPJP|ROOM_NAME|NO_KTP|REGPID|RS_NAMA|RS_ALAMAT|RS_TELEPON|RS_FAX|RS_EMAIL|V_PETH|VLOGO|TGL_CETAK)\}/;

export const CONTROL = "input, select, textarea";

/* --------------------------------------------------------------------------
   Membaca dokumen & membuang yang tidak dipakai
   -------------------------------------------------------------------------- */
/* opts.keepStyle = true dipakai HANYA oleh geometry.js untuk merender dokumen
   ukur di iframe — CSS asli dibutuhkan agar posisi elemen terukur benar.
   Pipeline pindaian normal tetap membuang <style> seperti biasa. */
export function parseDocument(html, opts = {}) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Skrip dibuang TOTAL sesuai keputusan: tidak diimpor, tidak disimpan.
    const buang = opts.keepStyle
        ? "script, noscript, link, meta"
        : "script, style, noscript, link, meta";
    doc.querySelectorAll(buang).forEach((el) => el.remove());
    stripComments(doc.body);

    // Navigasi halaman bawaan aplikasi tidak perlu ikut — builder membuatnya sendiri.
    doc.querySelectorAll("ul.pagination, .pagination").forEach((el) => {
        const bungkus = el.closest("div");
        (bungkus && bungkus.textContent.trim() === el.textContent.trim() ? bungkus : el).remove();
    });

    return doc;
}

function stripComments(root) {
    if (!root) return;
    const jalan = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const buang = [];
    while (jalan.nextNode()) buang.push(jalan.currentNode);
    buang.forEach((n) => n.remove());
}

/* --------------------------------------------------------------------------
   Daftar seluruh field — dipakai untuk membuktikan tidak ada yang hilang
   -------------------------------------------------------------------------- */
export function fieldInventory(root) {
    return [...root.querySelectorAll("[name]")]
        .filter((el) => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))
        .map((el) => ({
            name: el.getAttribute("name") || "",
            id: el.getAttribute("id") || "",
            type: el.tagName === "INPUT" ? (el.getAttribute("type") || "text").toLowerCase()
                : el.tagName.toLowerCase(),
        }));
}

export function duplicateIds(root) {
    const semua = [...root.querySelectorAll("[id]")].map((el) => el.id);
    const hitung = {};
    semua.forEach((i) => { hitung[i] = (hitung[i] || 0) + 1; });
    return Object.keys(hitung).filter((i) => hitung[i] > 1).sort();
}

/* --------------------------------------------------------------------------
   Wadah utama formulir
   -------------------------------------------------------------------------- */
/* Sebuah berkas bisa memuat LEBIH DARI SATU <form> (mis. formulir utama +
   formulir obat). Semuanya harus dipindai, kalau tidak field form kedua hilang. */
export function findContainers(doc) {
    const smart = [...doc.querySelectorAll("form.smart-form")];
    if (smart.length) return smart;
    const semua = [...doc.querySelectorAll("form")];
    if (semua.length) return semua;
    return [doc.body];
}

/* Halaman: <fieldset id="dokumen_page_N"> — pola aplikasi rumah sakit. */
export function findPages(scope) {
    const hal = [...scope.querySelectorAll('[id^="dokumen_page"], fieldset[id*="page"]')]
        .filter((el) => /page[_-]?\d+$/i.test(el.id));
    if (hal.length < 2) return null;
    return hal.sort((a, b) => pageNumberOf(a) - pageNumberOf(b));
}

export function pageNumberOf(el) {
    const m = /(\d+)$/.exec(el.id || "");
    return m ? Number(m[1]) : 1;
}

/* --------------------------------------------------------------------------
   Pembantu teks
   -------------------------------------------------------------------------- */
export const tidyText = (t = "") => t.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

export function textWithoutControls(el) {
    const salinan = el.cloneNode(true);
    salinan.querySelectorAll(CONTROL + ", button, a.btn").forEach((n) => n.remove());
    return tidyText(salinan.textContent);
}

export function hasControls(el) {
    return !!el.querySelector(CONTROL);
}

/* <td>/<th> langsung milik sebuah baris (bukan milik tabel bersarang) */
export function directCells(tr) {
    return [...tr.children].filter((c) => /^(TD|TH)$/.test(c.tagName));
}

/* <tr> langsung milik sebuah tabel (bukan milik tabel bersarang) */
export function directRows(table) {
    const out = [];
    [...table.children].forEach((child) => {
        if (child.tagName === "TR") out.push(child);
        else if (/^(THEAD|TBODY|TFOOT)$/.test(child.tagName)) {
            [...child.children].forEach((tr) => { if (tr.tagName === "TR") out.push(tr); });
        }
    });
    return out;
}

const GRID_MAX_COLS = 60;

/* --------------------------------------------------------------------------
   Header multi-baris (rowspan/colspan)
   ==========================================================================
   Tabel lama kerap menulis header dalam BEBERAPA <tr> lewat rowspan/colspan
   (mis. grafik keseimbangan cairan: "Tanggal Pukul" rowspan=4, "Urine"
   rowspan=3, "Jenis"/"Jumlah" rowspan=2, dst). Kode lama menganggap header
   selalu satu <tr> (rows[0]) lalu men-zip posisinya begitu saja terhadap
   baris berikutnya — salah untuk pola ini. splitTableHeader() meratakan
   rowspan/colspan header ke grid kolom yang benar (satu sel per kolom NYATA,
   memakai judul PALING DALAM/spesifik bila kolom itu dipecah lagi di baris
   header berikutnya), lalu memisahkan baris header dari baris isi.

   Tabel TANPA rowspan/colspan sama sekali mengembalikan hasil IDENTIK dengan
   perilaku lama (headerCells = directCells(rows[0]), bodyRows = rows.slice(1))
   — supaya tabel yang sudah bekerja hari ini tidak berubah sama sekali. */
export function splitTableHeader(table) {
    const rows = directRows(table);
    if (rows.length < 2) {
        return { headerCells: directCells(rows[0] || table).filter(Boolean), headerRows: rows.slice(0, 1), bodyRows: [] };
    }

    const hasSpan = rows.some((tr) => directCells(tr).some((td) =>
        numFrom(td.getAttribute("rowspan"), 1) > 1 || numFrom(td.getAttribute("colspan"), 1) > 1));
    if (!hasSpan) {
        return { headerCells: directCells(rows[0]), headerRows: rows.slice(0, 1), bodyRows: rows.slice(1) };
    }

    /* baris header = deretan awal baris yang SAMA SEKALI tanpa kontrol —
       baris isi sungguhan pasti mengandung input/select/textarea. */
    let headerRowCount = 0;
    while (headerRowCount < rows.length - 1 && !hasControls(rows[headerRowCount])) headerRowCount += 1;
    if (headerRowCount < 1) headerRowCount = 1;

    const colHeader = new Map();      // kolom -> <td> judul paling spesifik (baris terdalam menimpa)
    const reservedThrough = new Map();  // kolom -> indeks baris TERAKHIR yang masih ditahan sel rowspan

    for (let r = 0; r < headerRowCount; r += 1) {
        const cells = directCells(rows[r]);
        let col = 0;
        for (const td of cells) {
            while ((reservedThrough.get(col) ?? -1) >= r) col += 1;   // masih ditahan rowspan baris sebelumnya
            const span = numFrom(td.getAttribute("colspan"), 1);
            const rspan = numFrom(td.getAttribute("rowspan"), 1);
            /* sel kosong (padding/perataan visual, kerap dipakai baris header
               terakhir) tidak boleh menimpa judul yang sudah ada di kolom itu */
            const isi = tidyText(td.textContent);
            for (let k = 0; k < span; k += 1) {
                if (isi) colHeader.set(col + k, td);
                reservedThrough.set(col + k, r + rspan - 1);
            }
            col += span;
            if (col > GRID_MAX_COLS) break;
        }
    }

    const totalCols = colHeader.size ? Math.max(...[...colHeader.keys()].map((k) => k + 1)) : 0;
    if (!totalCols || totalCols > GRID_MAX_COLS) {
        // pola tak wajar -> heuristik lama (satu baris header)
        return { headerCells: directCells(rows[0]), headerRows: rows.slice(0, 1), bodyRows: rows.slice(1) };
    }
    const headerCells = [];
    for (let c = 0; c < totalCols; c += 1) headerCells.push(colHeader.get(c) || null);
    return { headerCells, headerRows: rows.slice(0, headerRowCount), bodyRows: rows.slice(headerRowCount) };
}

export const numFrom = (v, baku = 1) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : baku;
};

/* --------------------------------------------------------------------------
   Model yang disematkan generateHtml pada ekspor builder sendiri.
   Dipanggil pada STRING MENTAH sebelum parseDocument (skrip dibuang oleh
   pembersihan). Mengembalikan objek formulir, atau null bila tidak ada.
   -------------------------------------------------------------------------- */
export function extractEmbeddedModel(html) {
    const re = /<script\b(?=[^>]*\bid="askep-model")[^>]*>([\s\S]*?)<\/script>/i;
    const m = re.exec(String(html || ""));
    if (!m) return null;
    try {
        const obj = JSON.parse(m[1]);          /* \/ adalah escape JSON yang sah */
        return obj && Array.isArray(obj.sections) && obj.sections.length ? obj : null;
    } catch { return null; }
}
