/* ==========================================================================
   import/listify.js — pengenalan pola list ber-isian
   ==========================================================================
   Formulir lama membuat "list + isian" memakai tabel: baris berawalan
   "- Obat", "a. Nadi", "2. Kepala" diikuti isian/pilihan, atau sel kalimat
   isian ("Hb: ___ , Leukosit: ___"). Modul ini menyediakan:
   - rowMarker / rowMarkerInfo : pembaca penanda baris;
   - segsFromRow               : hasil baris -> segmen butir list;
   - sentenceListItem          : sel kalimat isian -> satu butir list;
   - mergeMarkedRows           : POST-PASS penggabung baris berlabel
                                 bertanda berurutan menjadi satu list.
   ========================================================================== */

import { makeRow, makeListSeg } from "../model.js";
import {
    CONTROL, tidyText, hasControls, directCells,
} from "./read.js";
import { comp } from "./shared.js";

/* ==========================================================================
   LIST BER-ISIAN: penanda baris & kalimat isian
   ==========================================================================
   Formulir lama membuat "list + isian" memakai tabel: baris berawalan
   "- Obat", "a. Nadi", "2. Kepala" diikuti isian/pilihan. Deretan baris
   bertanda seperti ini disatukan menjadi SATU komponen list ber-isian
   supaya penandanya tidak hilang. Sel "kalimat isian" (teks dan isian
   bergantian, mis. "Hb: ___ , Leukosit: ___") juga dipetakan ke butir list.
   ========================================================================== */

const MARK_DASH_RE = /^[-\u2013\u2014\u2022]\s+(.+)$/;
const MARK_ALPHA_RE = /^([a-z])[.)]\s+(.+)$/;
const MARK_NUM_RE = /^(\d{1,2})[.)]\s+(.+)$/;
const MARK_PREFIX_RE = /^(?:[-\u2013\u2014\u2022]\s+|(?:[a-z]|\d{1,2})[.)]\s+)/;

/* Baca penanda di depan baris tabel; null bila baris tidak bertanda.
   Label harus berada di sel tanpa kontrol, sebelum sel isian. */
export function rowMarker(tr) {
    for (const td of directCells(tr)) {
        if (hasControls(td)) return null;
        const t = tidyText(td.textContent);
        if (!t) continue;
        let m;
        if ((m = t.match(MARK_DASH_RE))) return { jenis: "strip", urut: 0, label: m[1] };
        if ((m = t.match(MARK_ALPHA_RE))) return { jenis: "alpha", urut: m[1].charCodeAt(0), label: m[2] };
        if ((m = t.match(MARK_NUM_RE))) return { jenis: "num", urut: Number(m[1]), label: m[2] };
        return null;
    }
    return null;
}

/* Deretan hasil buatBaris -> segmen butir list. null bila ada komponen yang
   tidak bisa dipetakan (pemanggil membatalkan pengelompokan). */
export function segsFromRow(content, info) {
    const segs = [];
    let labelRun = info ? info.label.replace(MARK_PREFIX_RE, "").trim() : "";
    for (const x of content) {
        const c = x.comp;
        let label = (c.label || "").replace(MARK_PREFIX_RE, "").trim();
        if (!label && labelRun) { label = labelRun; labelRun = ""; }
        const lebar = /^\d+%$/.test(x.width || "") ? x.width
            : (x.rect ? Math.max(20, Math.round(x.rect.w / 3.78)) + "mm" : "");
        if (c.type === "checkbox" || c.type === "radio") {
            /* label ("Kepala", "Hasil Laboratorium") tetap jadi teks butir */
            if (label) segs.push(makeListSeg("text", { text: label }));
            segs.push(makeListSeg("choice", {
                field: c.field, choice: c.type === "radio" ? "radio" : "check",
                options: c.options && c.options.length ? c.options : ["Ya", "Tidak"],
            }));
        } else if (c.type === "text" || c.type === "textarea") {
            if (label) segs.push(makeListSeg("text", { text: label + (c.unit ? " (" + c.unit + ")" : "") }));
            segs.push(makeListSeg("field", { field: c.field, width: lebar || "50mm", inputStyle: "garis" }));
        } else if (c.type === "select") {
            if (label) segs.push(makeListSeg("text", { text: label }));
            segs.push(makeListSeg("select", { field: c.field, options: c.options, width: lebar || "50mm" }));
        } else if (c.type === "date" || c.type === "time") {
            if (label) segs.push(makeListSeg("text", { text: label }));
            segs.push(makeListSeg(c.type, { field: c.field, width: c.type === "date" ? "28mm" : "18mm" }));
        } else if (c.type === "static" || c.type === "paragraph" || c.type === "subtitle") {
            const t = tidyText(c.value || c.text || String(c.html || "").replace(/<[^>]+>/g, " "));
            if (t) segs.push(makeListSeg("text", { text: t }));
        } else {
            return null;   // tabel/matrix/html dsb. -> pengelompokan dibatalkan
        }
    }
    return segs.length ? segs : null;
}

/* Sel "kalimat isian": teks dan isian bergantian dalam satu alur. Menghasilkan
   SATU butir list, atau null bila polanya tidak meyakinkan. Wadah blok besar
   (div grid/section) ditolak supaya grid isian tidak salah dianggap kalimat. */
export function sentenceListItem(el) {
    const controls = [...el.querySelectorAll(CONTROL)].filter(
        (c) => (c.getAttribute("type") || "").toLowerCase() !== "hidden");
    if (controls.length < 2) return null;

    /* tolak bila sebuah kontrol dibungkus wadah blok (div/tabel/section) di
       bawah el — itu struktur berkolom, bukan kalimat; li/ul/p boleh */
    const BLOK = /^(DIV|TABLE|THEAD|TBODY|TR|TD|SECTION|FIELDSET|FORM|BLOCKQUOTE|PRE|H[1-6])$/;
    for (const k of controls) {
        let n = k.parentElement;
        while (n && n !== el) {
            if (BLOK.test(n.tagName) && n.tagName !== "LI") return null;
            n = n.parentElement;
        }
        if (!n) return null;   // kontrol di luar el? seharusnya tidak
    }

    /* kumpulkan token teks & kontrol menurut urutan dokumen */
    const jalan = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode(n) {
            if (n.nodeType === 3) return tidyText(n.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            if (n.matches?.(CONTROL)) {
                return (n.getAttribute("type") || "").toLowerCase() === "hidden"
                    ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;   // elemen lain: anak-anaknya tetap ditelusuri
        },
    });
    const toks = [];
    while (jalan.nextNode()) {
        const n = jalan.currentNode;
        toks.push(n.nodeType === 3 ? { text: tidyText(n.textContent) } : { ctrl: n });
    }

    /* harus ada teks di antara isian (kalimat), bukan label grid murni */
    const antar = toks.filter((t, i) =>
        t.text && i > 0 && i < toks.length - 1 &&
        toks[i - 1].ctrl && toks[i + 1] && toks[i + 1].ctrl);
    if (!antar.length) return null;

    /* susun segmen: teks beruntun digabung, pilihan segrupnama digabung */
    const segs = [];
    let choices = null;   // grup checkbox/radio bernama sama yang sedang berjalan
    const closeChoice = () => { if (choices) { segs.push(choices); choices = null; } };
    const ctrlName = (c) => (c.getAttribute("name") || "").replace(/\[\]$/, "");

    toks.forEach((t) => {
        if (t.text) {
            /* teks menjadi label opsi: opsi pertama grup diterima apa pun
               panjangnya (checkbox bernama-unik punya label panjang), opsi
               berikutnya hanya yang pendek agar kalimat tidak tertelan */
            if (choices && !MARK_DASH_RE.test(t.text) &&
                (choices.options.length === 0 ||
                    (t.text.length <= 40 && !/[,;:]$/.test(t.text)))) {
                choices.options.push(t.text);          // teks = label opsi terakhir
                return;
            }
            closeChoice();
            const akhir = segs[segs.length - 1];
            if (akhir && akhir.type === "text") akhir.text = tidyText(akhir.text + " " + t.text);
            else segs.push(makeListSeg("text", { text: t.text }));
            return;
        }
        const c = t.ctrl;
        const jenis = (c.getAttribute("type") || "").toLowerCase();
        const cls = c.getAttribute("class") || "";
        if (/^(checkbox|radio)$/.test(jenis)) {
            const nm = ctrlName(c);
            if (choices && choices.field === nm && (choices.choice === "check") === (jenis === "checkbox")) {
                return;   // opsi berikutnya dari grup yang sama (label diambil dari teks)
            }
            closeChoice();
            choices = makeListSeg("choice", { field: nm, choice: jenis === "radio" ? "radio" : "check", options: [] });
            return;
        }
        closeChoice();
        if (c.tagName === "SELECT") {
            const options = [...c.querySelectorAll("option")]
                .map((o) => tidyText(o.textContent)).filter((x) => x && !/^-\s*(pilih|choose|select)/i.test(x));
            segs.push(makeListSeg("select", { field: ctrlName(c), options: options.length ? options : ["- Pilih -"], width: "50mm" }));
        } else if (/datepicker/i.test(cls)) {
            segs.push(makeListSeg("date", { field: ctrlName(c), width: "28mm" }));
        } else {
            segs.push(makeListSeg("field", { field: ctrlName(c), width: "40mm", inputStyle: "garis" }));
        }
    });
    closeChoice();

    const adaField = segs.some((x) => x.type !== "text");
    if (!adaField) return null;
    return { segs };
}

/* ==========================================================================
   POST-PASS: baris berurutan berlabel bertanda -> satu list ber-isian
   ==========================================================================
   Jalur geometry/pecahan menghasilkan baris per komponen dengan label yang
   masih memuat penandanya ("2. Kepala", "a. Nadi"). Deretan baris berurutan
   bernomor/berhurut digabung kembali menjadi SATU komponen list supaya
   penanda tidak tercerai-berai. Bila ada satu saja baris yang tak terpetakan,
   baris asli dikembalikan apa adanya (tidak ada yang berubah).
   ========================================================================== */
const MARKED_LABEL_RE = /^(?:([a-z])[.)]\s+(.+)|(\d{1,2})[.)]\s+(.+))$/;

function rowMarkerInfo(row) {
    const content = row.cells.filter(Boolean);
    if (!content.length) return null;
    /* seluruh sel harus berupa komponen yang bisa jadi segmen; label penanda
       dibaca dari komponen pertama yang berlabel */
    const first = content.find((x) => (x.label || x.text || "").trim());
    if (!first) return null;
    const label = String(first.label || first.text || "").trim();
    const m = label.match(MARKED_LABEL_RE);
    if (!m) return null;
    return {
        jenis: m[1] ? "alpha" : "num",
        urut: m[1] ? m[1].charCodeAt(0) : Number(m[3]),
        label: m[1] ? m[2] : m[4],
    };
}

export function mergeMarkedRows(rows) {
    const out = [];
    let run = [];

    const flush = () => {
        if (run.length >= 2) {
            const firstInfo = rowMarkerInfo(run[0]);
            const items = [];
            let jadi = true;
            for (const r of run) {
                const info = rowMarkerInfo(r);
                const segs = segsFromRow(r.cells.filter(Boolean).map((c) => ({ comp: c })), info || firstInfo);
                if (!segs) { jadi = false; break; }
                items.push({ segs });
            }
            if (jadi) {
                const listComp = comp("list", {
                    marker: firstInfo.jenis === "alpha" ? "alpha" : "decimal",
                    items,
                });
                const row = makeRow(1);
                row.cells = [listComp];
                out.push(row);
                run = [];
                return;
            }
        }
        out.push(...run);
        run = [];
    };

    rows.forEach((row) => {
        const info = rowMarkerInfo(row);
        if (info) {
            const prev = run.length ? rowMarkerInfo(run[run.length - 1]) : null;
            if (prev && prev.jenis === info.jenis &&
                info.urut === (prev.jenis === "strip" ? null : prev.urut + 1)) {
                run.push(row);
                return;
            }
            if (!run.length) { run.push(row); return; }
        }
        flush();
        /* baris tanpa penanda tetap dipertahankan apa adanya; baris bertanda
           yang tidak bersambung memulai run baru */
        if (info && !run.length) run.push(row);
        else if (!info) out.push(row);
    });
    flush();
    return out;
}
