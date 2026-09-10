/* ==========================================================================
   import/detect.js — aturan pengenalan: potongan HTML lama -> komponen builder
   ==========================================================================
   Setiap fungsi mengembalikan objek komponen (lihat model.js) beserta tingkat
   keyakinan:  "high" | "medium" | "low".
   Yang tidak dikenali TIDAK dibuang — pemanggil menyimpannya sebagai komponen
   "html" (Raw HTML) supaya tidak ada isi yang hilang.
   ========================================================================== */

import { makeComponent } from "../model.js";
import {
    CONTROL, PLACEHOLDER_RE, tidyText, textWithoutControls, hasControls,
    directCells, directRows, numFrom, splitTableHeader,
} from "./read.js";
import { markOf, stripMarks } from "./geometry.js";

const UNIT_RE_BASE = /^(kg|g|gr|cm|mm|m|mmhg|mg|ml|cc|l|%|°c|c|x\/menit|kali\/menit|kg\/m2|kg\/m²|jam|menit|hari|minggu|bulan|tahun|wib|wita|wit)$/i;
/* Dipakai juga build.js saat menyerap teks satuan di belakang isian hasil
   pecahan geometri (contoh flex lama: "BB : ___ kg"). */
export const UNIT_RE = UNIT_RE_BASE;

const comp = (type, patch) => ({ ...makeComponent(type), ...patch });

/* --------------------------------------------------------------------------
   Pembantu teks di sekitar kontrol
   -------------------------------------------------------------------------- */
/* Berhenti di isian lain: teks sebelum/sehabis sebuah kontrol tidak boleh
   meluber melewati kontrol tetangga, supaya label tiap isian tetap bersih
   (penting untuk pola kalimat isian "Hb: __ , Leukosit: __ , …"). */
function textBefore(controls, boundary) {
    const words = [];
    let node = controls;
    while (node && node !== boundary) {
        let prev = node.previousSibling;
        while (prev) {
            if (prev.nodeType === 3) words.unshift(prev.textContent);
            else if (prev.nodeType === 1) {
                if (prev.matches?.(CONTROL) || prev.querySelector?.(CONTROL)) break;
                words.unshift(prev.textContent);
            }
            prev = prev.previousSibling;
        }
        node = node.parentElement;
    }
    return tidyText(words.join(" "));
}

function textAfter(controls, boundary) {
    const words = [];
    let node = controls;
    while (node && node !== boundary) {
        let next = node.nextSibling;
        while (next) {
            if (next.nodeType === 3) words.push(next.textContent);
            else if (next.nodeType === 1) {
                if (next.matches?.(CONTROL) || next.querySelector?.(CONTROL)) break;
                words.push(next.textContent);
            }
            next = next.nextSibling;
        }
        node = node.parentElement;
    }
    return tidyText(words.join(" "));
}

export function cleanLabel(t = "") {
    return tidyText(t).replace(/^[-•·\s]+/, "").replace(/\s*[:：,;]\s*$/, "").trim();
}

const nameOf = (el) => (el.getAttribute("name") || "").replace(/\[\]$/, "");

/* --------------------------------------------------------------------------
   Satu kontrol -> satu komponen
   -------------------------------------------------------------------------- */
function fromTextarea(el, cell) {
    const c = comp("textarea", {
        label: cleanLabel(textBefore(el, cell)),
        field: nameOf(el),
        rows: numFrom(el.getAttribute("rows"), 3),
        placeholder: el.getAttribute("placeholder") || "",
    });
    return { comp: c, confidence: c.field ? "high" : "medium" };
}

function fromSelect(el, cell) {
    const options = [...el.querySelectorAll("option")]
        .map((o) => tidyText(o.textContent))
        .filter((t) => t && !/^-?\s*(pilih|choose|select)\b/i.test(t));
    const blank = [...el.querySelectorAll("option")][0];
    const c = comp("select", {
        label: cleanLabel(textBefore(el, cell)),
        field: nameOf(el),
        options: options,
        firstBlank: blank && !options.includes(tidyText(blank.textContent))
            ? tidyText(blank.textContent) || "- Pilih -" : "- Pilih -",
    });
    return { comp: c, confidence: "high" };
}

function fromTextInput(el, cell, dateCls) {
    const cls = el.getAttribute("class") || "";
    const name = nameOf(el);
    const after = textAfter(el, cell);
    const satuan = UNIT_RE_BASE.test(after) ? after : "";
    const label = cleanLabel(textBefore(el, cell));

    if (dateCls && cls.includes(dateCls)) {
        return {
            comp: comp("date", {
                label: label || "Tanggal", field: name,
                placeholder: el.getAttribute("placeholder") || "dd-mm-yy"
            }),
            confidence: "high",
        };
    }
    if (/^(jam|pukul|waktu)/i.test(label) || /^jam_/.test(name)) {
        return {
            comp: comp("time", {
                label: label || "Jam", field: name,
                suffix: /wib|wita|wit/i.test(after) ? after : ""
            }),
            confidence: "medium",
        };
    }
    const c = comp("text", {
        label, field: name, unit: satuan,
        placeholder: el.getAttribute("placeholder") || "",
        value: PLACEHOLDER_RE.test(el.getAttribute("value") || "") ? el.getAttribute("value") : "",
        readOnly: el.hasAttribute("readonly"),
    });
    return { comp: c, confidence: name ? (label ? "high" : "medium") : "low" };
}

function fromChoiceGroup(list, cell) {
    const first = list[0];
    const kind = (first.getAttribute("type") || "").toLowerCase();
    const name = nameOf(first);
    const options = list.map((el) => {
        const near = tidyText(textAfter(el, el.closest("label") || el.parentElement));
        return near || el.getAttribute("value") || "";
    }).filter(Boolean);

    /* label grup = teks sel dikurangi teks semua opsinya */
    let label = textWithoutControls(cell);
    options.forEach((o) => { label = label.replace(o, " "); });
    label = cleanLabel(label);

    const c = comp(kind === "radio" ? "radio" : "checkbox", {
        label, field: name, options: options.length ? options : ["Ya", "Tidak"],
    });
    return { comp: c, confidence: options.length && name ? "high" : "medium" };
}

/* --------------------------------------------------------------------------
   Satu sel <td> -> komponen
   `sel` boleh juga elemen hasil pecahan geometri (div/span), BAHKAN kontrol
   telanjang (input langsung sebagai anak wadah) — kontrol itu dihitung
   sebagai isi selnya sendiri. `opsi.boundary` = boundary merambat teks label:
   garis visual tempat sel itu berada, supaya label diambil dari teks
   sekotak baris ("Hb:") dan tidak meluber ke baris lain.
   -------------------------------------------------------------------------- */
export function detectCell(cell, options = {}) {
    const dateCls = options.dateClass || "datepickerBoots";
    const boundary = options.boundary && options.boundary !== cell && options.boundary.contains(cell)
        ? options.boundary : cell;
    const controls = [...cell.querySelectorAll(CONTROL)];
    /* kontrol telanjang: elemen sel INI sendiri adalah isian */
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(cell.tagName)) controls.unshift(cell);
    const visible = controls.filter((el) => (el.getAttribute("type") || "").toLowerCase() !== "hidden");
    const hiddenCtrls = controls.filter((el) => (el.getAttribute("type") || "").toLowerCase() === "hidden");
    const text = textWithoutControls(cell);

    /* --- tanpa kontrol: teks saja --- */
    if (!visible.length) {
        if (hiddenCtrls.length === 1 && !text) {
            const el = hiddenCtrls[0];
            return {
                comp: comp("hidden", { field: nameOf(el), value: el.getAttribute("value") || "" }),
                confidence: "high"
            };
        }
        if (!text) return null;
        if (PLACEHOLDER_RE.test(text) && text.length < 80) {
            return { comp: comp("static", { label: "", value: text }), confidence: "medium" };
        }
        const boldTag = cell.querySelector("b, strong, h1, h2, h3, h4");
        if (boldTag && tidyText(boldTag.textContent) === text && text.length < 90) {
            return { comp: comp("subtitle", { text: text }), confidence: "medium" };
        }
        /* judul ditebalkan/diperbesar lewat CSS (bukan <b>) -> subtitle;
           hanya aktif bila pengukuran geometry tersedia */
        if (looksLikeTitle(cell, options) && text.length < 90) {
            return { comp: comp("subtitle", { text: text }), confidence: "high" };
        }
        return { comp: comp("paragraph", { html: stripMarks(cell.innerHTML.trim()) }), confidence: "medium" };
    }

    /* --- satu kontrol --- */
    if (visible.length === 1) {
        const el = visible[0];
        if (el.tagName === "TEXTAREA") return fromTextarea(el, boundary);
        if (el.tagName === "SELECT") return fromSelect(el, boundary);
        const kind = (el.getAttribute("type") || "text").toLowerCase();
        if (kind === "checkbox" || kind === "radio") return fromChoiceGroup([el], el);
        return fromTextInput(el, boundary, dateCls);
    }

    /* --- banyak kontrol sejenis dengan nama sama -> satu grup pilihan --- */
    const allChoices = visible.every((el) =>
        /^(checkbox|radio)$/i.test(el.getAttribute("type") || ""));
    const sameName = new Set(visible.map(nameOf));
    if (allChoices && sameName.size === 1) return fromChoiceGroup(visible, cell);

    /* --- pola "isian + isian" (mis. tanggal + jam) --- */
    if (visible.length === 2 && visible.every((el) => el.tagName === "INPUT")) {
        const [a, b] = visible;
        const clsA = a.getAttribute("class") || "";
        if (clsA.includes(dateCls) && /jam|pukul/i.test(textBefore(b, cell) + text)) {
            return {
                comp: comp("date", {
                    label: cleanLabel(textBefore(a, cell)) || "Tanggal",
                    field: nameOf(a), withTime: true
                }),
                confidence: "medium",
            };
        }
    }

    return null;   // biar pemanggil menjadikannya Raw HTML
}

/* --------------------------------------------------------------------------
   Tabel: data / matriks / tata letak
   -------------------------------------------------------------------------- */
export function tableKind(table) {
    const rows = directRows(table);
    if (rows.length < 2) return "layout";

    /* rowspan/colspan bisa membuat header terdiri dari beberapa <tr> —
       splitTableHeader() meratakannya; tabel tanpa span mengembalikan
       persis rows[0]/rows.slice(1) seperti sebelumnya. */
    const head = splitTableHeader(table);
    const headCells = head.headerCells;
    const headIsText = headCells.length >= 2 && !head.headerRows.some((tr) => hasControls(tr));
    const isi = head.bodyRows;

    /* matriks: tiap baris = teks + beberapa sel berisi satu ceklis */
    const matrixRows = isi.filter((tr) => {
        const cell = directCells(tr);
        if (cell.length < 3) return false;
        const checkCells = cell.filter((td) => {
            const c = [...td.querySelectorAll(CONTROL)];
            return c.length === 1 && /^(checkbox|radio)$/i.test(c[0].getAttribute("type") || "");
        });
        return checkCells.length >= 2 && !hasControls(cell[0]) && textWithoutControls(cell[0]);
    });
    if (headIsText && matrixRows.length >= 2 && matrixRows.length >= isi.length * 0.6) {
        return "matrix";
    }

    /* tabel data: baris isi berulang dengan jumlah isian teks yang sama */
    const inputCounts = isi.map((tr) => directCells(tr)
        .filter((td) => td.querySelector('input[type="text"], input:not([type]), select, textarea')).length);
    const uniform = inputCounts.length >= 2 && inputCounts.every((n) => n === inputCounts[0]) && inputCounts[0] >= 1;
    if (headIsText && uniform && headCells.length >= 2) return "data";

    return "layout";
}

export function readDataTable(table) {
    const head = splitTableHeader(table);
    const headRow = head.headerCells.map((td) => (td ? tidyText(td.textContent) : ""));
    const firstBody = directCells(head.bodyRows[0]);

    const numbered = /^(no|no\.|nomor)$/i.test(headRow[0] || "");
    const kolom = [];
    headRow.forEach((title, i) => {
        if (numbered && i === 0) return;
        const td = firstBody[i];
        const controls = td ? td.querySelector(CONTROL) : null;
        kolom.push({
            head: title,
            field: controls ? (controls.getAttribute("name") || "").replace(/\[\]$/, "") : "",
            width: td?.getAttribute("width") || "",
        });
    });

    return {
        comp: comp("table", {
            columns: kolom.length ? kolom : [{ head: "Kolom", field: "", width: "" }],
            rows: Math.max(1, head.bodyRows.length),
            numbered: numbered,
        }),
        confidence: kolom.some((k) => k.field) ? "high" : "medium",
    };
}

export function readMatrix(table) {
    const head = splitTableHeader(table);
    const headRow = head.headerCells.map((td) => (td ? tidyText(td.textContent) : ""));
    const isi = head.bodyRows;

    const sample = directCells(isi[0]);
    const checkCols = sample.filter((td) => {
        const c = [...td.querySelectorAll(CONTROL)];
        return c.length === 1 && /^(checkbox|radio)$/i.test(c[0].getAttribute("type") || "");
    }).length;

    const choices = headRow.slice(1, 1 + checkCols).filter(Boolean);
    const hasNote = headRow.length > 1 + checkCols;

    const items = isi.map((tr) => {
        const cell = directCells(tr);
        const checkCells = cell.find((td) => td.querySelector('input[type="checkbox"], input[type="radio"]'));
        const controls = checkCells ? checkCells.querySelector(CONTROL) : null;
        // kolom keterangan memakai nama bebas pada formulir lama -> ikut disalin
        const noteCell = cell.slice(1).find((td) =>
            td.querySelector('input[type="text"], textarea, input:not([type])'));
        const noteCtrl = noteCell ? noteCell.querySelector(CONTROL) : null;
        return {
            text: textWithoutControls(cell[0]),
            field: controls ? (controls.getAttribute("name") || "").replace(/\[\]$/, "") : "",
            noteField: noteCtrl ? (noteCtrl.getAttribute("name") || "").replace(/\[\]$/, "") : "",
        };
    }).filter((it) => it.text);

    const kind = sample.find((td) => td.querySelector('input[type="radio"]')) ? true : false;

    return {
        comp: comp("matrix", {
            itemHeader: headRow[0] || "Item",
            choices: choices.length ? choices : ["Ya", "Tidak"],
            noteColumn: hasNote ? headRow[headRow.length - 1] : "",
            items: items.length ? items : [{ text: "Item", field: "", noteField: "" }],
            single: kind,
        }),
        confidence: items.every((i) => i.field) ? "high" : "medium",
    };
}

/* --------------------------------------------------------------------------
   Judul section
   -------------------------------------------------------------------------- */
const TITLE_RE = /^((?:[IVXLC]+|[A-Z]|\d{1,2})\s*[.)]\s+)?[A-Z0-9][^a-z]{2,}$/;

/* Sinyal geometry: seluruh sel baris ini tampak "seperti judul" menurut
   computed style — tebal (>=600) atau lebih besar dari font dasar dokumen.
   Menangkap judul yang ditebalkan lewat CSS, bukan <b>. */
function titleFromStyle(tr, ctx) {
    if (!ctx?.geo || !ctx.geo.size) return false;
    const cell = directCells(tr);
    if (!cell.length) return false;
    return cell.every((td) => looksLikeTitle(td, ctx));
}

/* Versi umum untuk satu elemen apa pun (td, div, span …): gaya computed
   menyerupai judul — tebal, atau lebih besar dari font dasar, dan tidak
   terlalu tinggi (bukan paragraf panjang). */
export function looksLikeTitle(el, ctx) {
    if (!ctx?.geo || !ctx.geo.size) return false;
    const g = ctx.geo.get(markOf(el));
    if (!g) return false;
    if (g.h > 60) return false;                       // terlalu tinggi untuk judul
    return g.fw >= 600 || g.fs >= (ctx.baseFs || 13) + 1.5;
}

export function sectionTitleOf(tr, ctx = null) {
    const cell = directCells(tr);
    if (!cell.length || hasControls(tr)) return null;
    const text = tidyText(tr.textContent);
    if (!text || text.length > 110) return null;

    const satuSel = cell.length === 1;
    const lebar = satuSel && numFrom(cell[0].getAttribute("colspan"), 1) >= 1;
    const boldTag = !!tr.querySelector("b, strong, h1, h2, h3, h4");
    const numbered = /^((?:[IVXLC]+|[A-Z]|\d{1,2})\s*[.)])\s+\S/.test(text);
    const kapital = TITLE_RE.test(text);

    if (lebar && (boldTag || numbered || kapital)) {
        return cleanLabel(text);
    }
    /* sinyal tambahan dari pengukuran iframe: ditebalkan/diperbesar via CSS */
    if (lebar && titleFromStyle(tr, ctx) && text.length >= 4) {
        return cleanLabel(text);
    }
    return null;
}
