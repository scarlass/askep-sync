/* ==========================================================================
   import/build.js — menyusun hasil pindaian menjadi model formulir builder
   ==========================================================================
   scanHtml()   : HTML lama  -> daftar section terdeteksi + laporan mutu
                  (async: dokumen dirender & diukur di iframe tersembunyi
                  oleh geometry.js sebelum dikenali);
   buildForm()  : daftar section + pilihan pengguna -> model formulir;
   buildReport(): laporan mutu impor (field sebelum/sesudah dsb.).
   ========================================================================== */

import { makeForm, makeRow, uid } from "../model.js";
import {
    parseDocument, findContainers, findPages, pageNumberOf,
    fieldInventory, duplicateIds,
} from "./read.js";
import { measureDocument, stripMarks } from "./geometry.js";
import { extractLetterhead, extractSignatures } from "./extract.js";
import { createTraverser } from "./traverse.js";
import { mergeMarkedRows } from "./listify.js";
import { comp } from "./shared.js";

/* ==========================================================================
   4. PINDAI
   ==========================================================================
   Kini async: sebelum pindaian, dokumen lama dirender di iframe tersembunyi
   (geometry.js) supaya baris/kolom VISUAL terukur. Skema CSS lama hanya hidup
   di iframe ukur dan tidak pernah ikut ke hasil. Bila pengukuran gagal,
   geo kosong dan pipeline jatuh kembali ke heuristik markup lama. */
export async function scanHtml(html, opts = {}) {
    const measurement = await measureDocument(html, opts);
    const geo = measurement.geo;

    /* Dokumen pindai = dokumen yang SUDAH diukur (bertanda data-geo-i), bukan
       parse ulang — supaya kunci peta geometri tetap cocok meski ekstrakKop /
       ekstrakTtd menghapus blok kop & tanda tangan. CSS lama dibuang BARU di
       sini setelah pengukuran selesai. */
    const doc = measurement.doc || parseDocument(html);
    doc.querySelectorAll("style").forEach((el) => el.remove());
    const containers = findContainers(doc);

    // inventaris diambil dari SELURUH dokumen supaya form kedua ikut terhitung
    const before = fieldInventory(doc.body);
    const duplikat = duplicateIds(doc.body);

    const head = extractLetterhead(containers[0], doc);
    const sigs = extractSignatures(doc.body);
    const signs = sigs.signs;
    const rescued = [...(head.hidden || []), ...sigs.hidden];

    const pages = findPages(doc.body);
    const cakupan = pages
        ? pages.map((el) => ({ el, page: pageNumberOf(el) }))
        : containers.map((el) => ({ el, page: 1 }));

    let sections = [];
    cakupan.forEach(({ el, page }) => {
        const ctx = {
            page,
            dateClass: opts.dateClass || "datepickerBoots",
            geo,                                    // peta jalur -> rect hasil ukur iframe
            baseFs: measurement.baseFs,                    // font dasar dokumen (patokan judul)
        };
        const jalan = createTraverser(ctx);
        [...el.children].forEach((kids) => { if (kids.nodeType === 1) jalan.walkElement(kids); });
        sections = sections.concat(jalan.sections);
    });

    /* buang section kosong & beri judul cadangan */
    sections = sections.filter((s) => s.rows.length);

    /* POST-PASS: deretan baris berlabel bertanda (a. / 1.) disatukan menjadi
       komponen list ber-isian — mencakup baris hasil pecahan geometry. */
    sections.forEach((s) => { s.rows = mergeMarkedRows(s.rows); });

    /* Judul formulir sering hanya ada sebagai judul blok pertama. */
    if (!head.title || /hasil impor/i.test(head.title)) {
        const candidates = sections.slice(0, 3).map((s) => s.title)
            .find((t) => t && t.length > 8 && t.length < 90 && t === t.toUpperCase());
        if (candidates) head.title = candidates;
    }
    sections.forEach((s, i) => {
        if (!s.title) s.title = `Part ${i + 1}`;
        s.html = stripMarks(s.html.join("\n"));
        const total = s.stat.high + s.stat.medium + s.stat.low + s.stat.raw;
        s.confidence = s.stat.raw + s.stat.low === 0 ? "high"
            : (s.stat.raw + s.stat.low) / Math.max(total, 1) < 0.34 ? "medium" : "low";
        s.action = "take";
    });

    /* JARING PENGAMAN: setiap `name` di berkas asli yang belum terwakili oleh
       komponen mana pun disimpan sebagai field tersembunyi. Dengan begini tidak
       ada satu pun field yang hilang, sekalipun strukturnya tidak dikenali. */
    const covered = namesInSections(sections);
    (head.header.ident || []).forEach((it) => { if (it.field) covered.add(it.field); });
    signs.forEach((g, i) => {
        const n = i + 1;
        ["paraf_" + n, "paraf_txt_" + n, "data_id"].forEach((x) => covered.add(x));
        if (g.withDate) { covered.add("tgl_ttd_" + n); covered.add("jam_ttd_" + n); }
        if (g.withSelect) {
            const sf = g.selectField || "dokter" + n;
            covered.add(sf); covered.add(sf + "_txt");
        }
    });

    const originalNames = [...new Set(before.map((f2) => f2.name.replace(/\[\]$/, "")))].filter(Boolean);
    const origValues = {};
    before.forEach((f2) => { origValues[f2.name.replace(/\[\]$/, "")] = ""; });
    rescued.forEach((f2) => { origValues[f2.field] = f2.value || ""; });

    const missing = originalNames.filter((n) => !covered.has(n))
        .map((n) => ({ field: n, value: origValues[n] || "" }));
    if (missing.length) {
        const rows = missing.map((f2) => {
            const r = makeRow(1);
            r.cells = [comp("hidden", { field: f2.field, value: f2.value })];
            return r;
        });
        sections.push({
            key: uid("imp"), title: "Field tersembunyi (tidak dikenali)", page: 1, rows,
            html: missing.map((f2) =>
                `<input type="hidden" name="${f2.field}" value="${f2.value}">`).join(""),
            stat: { high: 0, medium: missing.length, low: 0, raw: 0, fields: missing.length },
        });
    }
    const keptHiddenNames = missing.map((f2) => f2.field);

    return {
        sections,
        meta: {
            title: head.title || "Formulir Hasil Impor",
            docCode: head.kode || "",
            header: head.header,
            headerFound: head.found,
            signs,
            rebuilt: sigs.rebuilt,
            keptHidden: keptHiddenNames,
            pages: pages ? pages.length : 1,
            geometry: {
                active: geo.size > 0,               // pengukuran iframe berhasil/tidak
                elements: geo.size,
            },
        },
        /* HTML asli (tanpa skrip, CSS asli dipertahankan) — dipakai panel
           "Wireframe check" untuk membandingkan tampilan asli vs hasil. */
        sourceHtml: measurement.sourceHtml,
        inventory: before,
        duplicates: duplikat,
    };
}

/* Semua `name` yang dihasilkan sekumpulan section. */
function namesInSections(sections) {
    const name = new Set();
    const addName = (n) => { if (n) name.add(String(n).replace(/\[\]$/, "")); };
    sections.forEach((s) => s.rows.forEach((r) => r.cells.forEach((c) => {
        if (!c) return;
        addName(c.field); addName(c.fieldTo); addName(c.otherField);
        (c.columns || []).forEach((k) => addName(k.field));
        (c.items || []).forEach((k) => {
            addName(k.field);
            addName(k.noteField || (k.field ? `${k.field}_ket` : ""));
        });
        /* segmen butir list ber-isian juga membawa name */
        (c.items || []).forEach((it) => (it.segs || []).forEach((sg) => addName(sg.field)));
        if (c.type === "date" && c.field && c.withTime) addName(`${c.field}_jam`);
        if (c.type === "html" && c.html) {
            const re = /name="([^"]+)"/g;
            let m;
            while ((m = re.exec(c.html)) !== null) addName(m[1]);
        }
    })));
    return name;
}

/* ==========================================================================
   5. BANGUN FORMULIR
   ========================================================================== */
export function buildForm(scan, aksi = {}) {
    const f = makeForm();
    f.meta.title = scan.meta.title;
    f.meta.docCode = scan.meta.docCode;
    f.meta.header = { ...f.meta.header, ...scan.meta.header };
    f.meta.showHeader = true;
    if (scan.meta.signs.length) {
        f.meta.footer.signs = scan.meta.signs;
        f.meta.showFooter = true;
    }
    if (scan.meta.pages > 1) {
        f.meta.paging = { ...f.meta.paging, enabled: true };
    }

    f.sections = [];
    scan.sections.forEach((s) => {
        const pilih = aksi[s.key] || s.action || "take";
        if (pilih === "skip") return;
        if (pilih === "raw") {
            const row = makeRow(1);
            row.cells = [comp("html", { html: s.html })];
            f.sections.push({ id: uid("s"), title: s.title, page: s.page, rows: [row] });
            return;
        }
        f.sections.push({ id: uid("s"), title: s.title, page: s.page, rows: s.rows });
    });
    if (!f.sections.length) f.sections = makeForm().sections;
    return f;
}

/* ==========================================================================
   6. LAPORAN MUTU
   ========================================================================== */
export function namesInForm(form) {
    const name = new Set();
    const addName = (n) => { if (n) name.add(String(n).replace(/\[\]$/, "")); };

    (form.meta.header?.ident || []).forEach((it) => addName(it.field));
    (form.meta.footer?.signs || []).forEach((g, i) => {
        const n = i + 1;
        addName(`paraf_${n}`); addName(`paraf_txt_${n}`); addName("data_id");
        if (g.withDate) { addName(`tgl_ttd_${n}`); if (g.withTime !== false) addName(`jam_ttd_${n}`); }
        if (g.withSelect) {
            const sf = g.selectField || `dokter${n}`;
            addName(sf); addName(`${sf}_txt`);
        }
    });

    form.sections.forEach((s) => s.rows.forEach((r) => r.cells.forEach((c) => {
        if (!c) return;
        addName(c.field); addName(c.fieldTo); addName(c.otherField);
        (c.columns || []).forEach((k) => addName(k.field));
        (c.items || []).forEach((k) => addName(k.field));
        (c.items || []).forEach((it) => (it.segs || []).forEach((sg) => addName(sg.field)));
        if (c.type === "html" && c.html) {
            const re = /name="([^"]+)"/g;
            let m;
            while ((m = re.exec(c.html)) !== null) addName(m[1]);
        }
        if (c.type === "date" && c.field && c.withTime) addName(`${c.field}_jam`);
    })));
    return name;
}

export function buildReport(scan, form) {
    const before = [...new Set(scan.inventory.map((f2) => f2.name.replace(/\[\]$/, "")))]
        .filter(Boolean);
    const after = namesInForm(form);
    const rebuiltNames = new Set(scan.meta.rebuilt || []);
    const allLost = before.filter((n) => !after.has(n));
    const lost = allLost.filter((n) => !rebuiltNames.has(n));
    const ditulisUlang = allLost.filter((n) => rebuiltNames.has(n));

    let high = 0, medium = 0, low = 0, raw = 0;
    scan.sections.forEach((s) => {
        high += s.stat.high; medium += s.stat.medium;
        low += s.stat.low; raw += s.stat.raw;
    });

    return {
        fieldsBefore: before.length,
        fieldsAfter: after.size,
        missing: lost,
        rebuilt: ditulisUlang,
        keptHidden: scan.meta.keptHidden || [],
        duplicates: scan.duplicates,
        components: { high, medium, low, raw },
        sections: scan.sections.length,
        pages: scan.meta.pages,
        headerFound: scan.meta.headerFound,
        signs: scan.meta.signs.length,
    };
}
