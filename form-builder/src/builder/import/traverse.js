/* ==========================================================================
   import/traverse.js — penelusur isi dokumen lama
   ==========================================================================
   createTraverser(ctx) membalikkan mesin penelusuran:
   - walkTable  : tabel data/matriks -> komponen; tabel tata letak -> per
                  baris; deretan baris bertanda -> satu list ber-isian
                  (recordMarkedList), termasuk run lintas tabel satu-baris;
   - walkRow    : satu <tr> -> baris model (judul section / isi biasa);
   - walkElement: elemen non-tabel (div kop gaya baru, grid, dsb.).
   ========================================================================== */

import { makeRow, uid } from "../model.js";
import {
    CONTROL, tidyText, textWithoutControls, hasControls,
    directCells, directRows,
} from "./read.js";
import {
    tableKind, readDataTable, readMatrix, sectionTitleOf, cleanLabel,
    looksLikeTitle,
} from "./detect.js";
import { stripMarks } from "./geometry.js";
import { rowMarker, segsFromRow } from "./listify.js";
import { describeCell, absorbLabels, buildRows } from "./rows.js";
import { comp } from "./shared.js";

/* ==========================================================================
   Penelusuran isi
   ========================================================================== */
export function createTraverser(ctx) {
    const sections = [];
    let kini = null;

    const startSection = (title) => {
        kini = {
            key: uid("imp"), title: title || "", page: ctx.page, rows: [],
            html: [], stat: { high: 0, medium: 0, low: 0, raw: 0, fields: 0 }
        };
        sections.push(kini);
        return kini;
    };
    const ensureSection = () => kini || startSection("");

    const record = (hasil, sumberHtml) => {
        const s = ensureSection();
        hasil.rows.forEach((r) => s.rows.push(r));
        if (sumberHtml) s.html.push(sumberHtml);
        hasil.content.forEach((x) => {
            s.stat[x.raw ? "raw" : x.confidence] += 1;
            if (x.comp.field) s.stat.fields += 1;
        });
    };

    /* Deretan baris bertanda ("- Obat", "a. Nadi", "2. Kepala" + isian)
       disatukan menjadi SATU komponen list ber-isian. Dipanggil prosesTabel
       (run dalam satu tabel) maupun prosesElemen (run lintas tabel
       satu-baris — pola lama: satu tabel per butir). */
    const recordMarkedList = (trs, markerKind) => {
        const items = [];
        const sumber = [];
        for (const tr of trs) {
            const info = rowMarker(tr);
            const hasil = buildRows(absorbLabels(directCells(tr).map((td) => describeCell(td, ctx))), ctx);
            if (!hasil) return false;
            const segs = segsFromRow(hasil.content, info);
            if (!segs) return false;
            items.push({ segs });
            sumber.push(tr.outerHTML);
        }
        const listComp = comp("list", {
            marker: markerKind === "alpha" ? "alpha" : markerKind === "num" ? "decimal" : "disc",
            items,
        });
        const row = makeRow(1);
        row.cells = [listComp];
        record({ rows: [row], content: [{ comp: listComp, confidence: "medium", raw: false }] },
            stripMarks(sumber.join("\n")));
        return true;
    };

    const walkTable = (table) => {
        const jenis = tableKind(table);
        if (jenis === "data" || jenis === "matrix") {
            const hasil = jenis === "data" ? readDataTable(table) : readMatrix(table);
            const row = makeRow(1);
            row.cells = [hasil.comp];
            record({ rows: [row], content: [{ comp: hasil.comp, confidence: hasil.confidence, raw: false }] },
                table.outerHTML);
            return;
        }

        /* run bertanda DALAM satu tabel */
        const trs = directRows(table);
        let i = 0;
        while (i < trs.length) {
            const info = hasControls(trs[i]) ? rowMarker(trs[i]) : null;
            if (!info) { walkRow(trs[i]); i += 1; continue; }

            const run = [trs[i]];
            let harap = info.jenis === "strip" ? null : info.urut + 1;
            let j = i + 1;
            while (j < trs.length) {
                const info2 = hasControls(trs[j]) ? rowMarker(trs[j]) : null;
                if (!info2 || info2.jenis !== info.jenis) break;
                if (harap != null && info2.urut !== harap) break;
                run.push(trs[j]);
                harap = info2.jenis === "strip" ? null : info2.urut + 1;
                j += 1;
            }
            const minRun = info.jenis === "strip" ? 3 : 2;
            if (run.length >= minRun && recordMarkedList(run, info.jenis)) {
                i = j;
            } else {
                walkRow(trs[i]);
                i += 1;
            }
        }
    };

    const walkRow = (tr) => {
        const title = sectionTitleOf(tr, ctx);
        if (title) { startSection(title); return; }

        const sel = directCells(tr);
        if (!sel.length) return;

        /* sel yang isinya hanya tabel tata letak -> telusuri ke dalam */
        if (sel.length === 1) {
            const dalam = [...sel[0].children].filter((c) => c.tagName === "TABLE");
            if (dalam.length && !textWithoutControls(sel[0]).length === false) {
                const outerText = textWithoutControls(sel[0]);
                const innerText = dalam.map((t) => textWithoutControls(t)).join(" ");
                if (tidyText(outerText) === tidyText(innerText)) {
                    dalam.forEach((t) => walkTable(t));
                    return;
                }
            }
        }

        const hasil = buildRows(absorbLabels(sel.map((td) => describeCell(td, ctx))), ctx);
        if (hasil) record(hasil, tr.outerHTML);
    };

    const walkElement = (el) => {
        if (el.tagName === "TABLE") { walkTable(el); return; }
        if (el.querySelector("table")) {
            /* Pola lama: satu tabel per butir bernomor ("2. Kepala …", "3. Wajah …").
               Tabel yang seluruhnya baris bertanda dan BERURUTAN disatukan. */
            const kids = [...el.children].filter((c) => c.nodeType === 1);
            let i = 0;
            while (i < kids.length) {
                if (kids[i].tagName !== "TABLE") { walkElement(kids[i]); i += 1; continue; }

                const runTrs = [];
                let jenisRun = null, harap = null;
                let j = i;
                while (j < kids.length && kids[j].tagName === "TABLE") {
                    const tableRows = directRows(kids[j]);
                    const withCtrls = tableRows.filter((tr) => hasControls(tr));
                    const marked = withCtrls.filter((tr) => rowMarker(tr));
                    if (!marked.length || marked.length !== withCtrls.length) break;
                    let ok = true;
                    for (const tr of marked) {
                        const info = rowMarker(tr);
                        if (jenisRun == null) {
                            jenisRun = info.jenis;
                            harap = info.jenis === "strip" ? null : info.urut;
                        }
                        if (info.jenis !== jenisRun) { ok = false; break; }
                        if (harap != null && info.urut !== harap) { ok = false; break; }
                        harap = info.jenis === "strip" ? null : info.urut + 1;
                        runTrs.push(tr);
                    }
                    if (!ok) break;
                    j += 1;
                }
                const minRun = jenisRun === "strip" ? 3 : 2;
                if (runTrs.length >= minRun && recordMarkedList(runTrs, jenisRun)) {
                    i = j;
                } else {
                    walkElement(kids[i]);
                    i += 1;
                }
            }
            return;
        }
        const text = textWithoutControls(el);
        if (!text && !hasControls(el)) return;

        const title = el.querySelector("h1, h2, h3, h4");
        if (title && tidyText(title.textContent) === text && !hasControls(el)) {
            startSection(cleanLabel(text));
            return;
        }

        /* Pola [judul, isi]: blok anak pertama teks tebal/kelas "judul" tanpa
           kontrol, disusul anak lain yang berisi kontrol -> mulai section baru.
           Menangkap hasil ekspor builder (askep-section/askep-judul) dan blok
           judul gaya lama (judul-romawi). */
        const kids = [...el.children].filter((c) => c.nodeType === 1);
        const titleCandidate = kids.find((c) => {
            if (hasControls(c)) return false;
            const t = textWithoutControls(c);
            if (!t || t.length > 90) return false;
            if (/(judul|title|heading)/i.test(c.className || "")) return true;      // kelas eksplisit
            return looksLikeTitle(c, ctx);                                            // tebal/besar via CSS
        });
        if (titleCandidate && kids.some((c) => c !== titleCandidate && hasControls(c))) {
            startSection(cleanLabel(textWithoutControls(titleCandidate)));
            kids.forEach((c) => { if (c !== titleCandidate) walkElement(c); });
            return;
        }

        const hasil = buildRows(absorbLabels([describeCell(el, ctx)]), ctx);
        if (hasil) record(hasil, el.outerHTML);
    };

    return { sections, walkElement, walkTable, startSection };
}
