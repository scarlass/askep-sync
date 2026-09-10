/* ==========================================================================
   import/extract.js — pengambilan kop & tanda tangan dari dokumen lama
   ==========================================================================
   Dua pengekstrak yang berjalan SEBELUM penelusuran isi:
   - extractLetterhead : kop (logo, nama RS, judul, identitas) -> meta.header
     sekaligus menyelamatkan isian di dalam kop menjadi baris identitas;
   - extractSignatures : blok paraf/CreateTTD -> kartu tanda tangan footer;
     field template dibangun ulang, field lain diselamatkan sebagai hidden.
   Blok aslinya dihapus dari dokumen agar tidak ikut dipindai dua kali.
   ========================================================================== */

import { makeSign, defaultHeader } from "../model.js";
import { CONTROL, tidyText, textWithoutControls } from "./read.js";
import { cleanLabel } from "./detect.js";

/* ==========================================================================
   1. KOP
   ========================================================================== */
export function extractLetterhead(scope, doc) {
    const h = defaultHeader();
    let found = false;

    /* judul & kode dokumen dari <title> / <h1..h3> / teks berpola */
    let title = "";
    const tag = doc.querySelector("h1, h2, h3");
    if (tag) title = tidyText(tag.textContent);
    if (!title && doc.title) title = tidyText(doc.title);
    title = title.replace(/^formulir\s+RM[\d.]*\s*/i, "").trim();

    const kodeCocok = /RM\.?\s?[\d.]+\d/.exec(doc.body.textContent || "");
    const kode = kodeCocok ? tidyText(kodeCocok[0]).replace(/^RM\.?\s?/, "RM.") : "";

    /* daerah kop: elemen terkecil yang memuat logo ATAU placeholder identitas.
       Dua rupa kop yang dikenali:
       - gaya aplikasi lama: tabel dengan logo + teks {NO_RM};
       - gaya ekspor builder/tema sendiri: div.askep-kop (logo, {RS_NAMA}, judul,
         identitas berupa input bernilai placeholder). */
    const logo = scope.querySelector('img[src*="VLOGO"], img[src*="logo" i]');
    const candidates = [];
    const letterheadEl = scope.querySelector('[class*="askep-kop"]');
    if (letterheadEl) candidates.push(letterheadEl);
    if (logo && !letterheadEl) candidates.push(logo.closest("thead") || logo.closest("tr") || logo.parentElement);
    const identNode = [...scope.querySelectorAll("td, div, span")]
        .find((el) => /\{NO_RM\}|\{NAME_REAL\}/.test(el.textContent) &&
            el.querySelectorAll("td, div").length <= 6)
        || scope.querySelector('input[value*="{NO_RM}"], input[value*="{NAME_REAL}"]')
            ?.closest('[class*="ident"], td, div');
    if (identNode && !letterheadEl) candidates.push(identNode.closest("thead") || identNode.closest("tr") || identNode);

    const regions = candidates.filter(Boolean)
        .map((el) => (el.tagName === "TR" && el.parentElement?.tagName === "THEAD"
            ? el.parentElement : el));
    const unique = [...new Set(regions)];
    if (!unique.length) {
        return { header: h, title, kode, found: false };
    }

    /* batasi: kop tidak boleh lebih dari 30% isi dokumen */
    const totalText = (scope.textContent || "").length || 1;
    const used = unique.filter((el) => (el.textContent || "").length / totalText < 0.3);
    if (!used.length) return { header: h, title, kode, found: false };

    const joined = used.map((el) => el.textContent).join(" ");
    found = true;

    if (logo && used.some((el) => el.contains(logo))) {
        h.showLogo = true;
        h.logoSrc = logo.getAttribute("src") || h.logoSrc;
    }

    /* nama & alamat rumah sakit */
    const textLines = [];
    used.forEach((el) => {
        el.querySelectorAll("td, div, p, span, h1, h2, h3, b, strong").forEach((n) => {
            if (n.querySelector("td, div, p")) return;
            const t = tidyText(n.textContent);
            if (t && !textLines.includes(t)) textLines.push(t);
        });
    });
    const hospitalLine = textLines.find((t) => /\{RS_NAMA\}/.test(t))
        || textLines.find((t) => /rumah sakit|rsud|rsu\b|klinik/i.test(t));
    if (hospitalLine) h.hospitalName = hospitalLine;
    const alamat = textLines.filter((t) =>
        /\{RS_ALAMAT\}|\{RS_TELEPON\}|jl\.|jalan|telp|fax|email/i.test(t) && t !== hospitalLine);
    if (alamat.length) h.addressLines = alamat.join("\n");

    /* baris identitas: label + placeholder */
    const ident = [];
    const IDENT_RE = /([A-Za-z./ ]{2,20}?)\s*[:：]?\s*(\{[A-Z_]+\})/g;
    let m;
    while ((m = IDENT_RE.exec(tidyText(joined))) !== null) {
        const label = cleanLabel(m[1]);
        const value = m[2];
        if (!label || ident.some((i) => i.value === value)) continue;
        ident.push({
            key: label, type: "static", value: value, field: "",
            options: [], multi: false, full: false, width: ""
        });
    }
    if (ident.length) h.ident = ident;

    /* judul formulir dari dalam kop bila ada yang lebih meyakinkan */
    const titleInHead = textLines.find((t) =>
        /^(formulir|form|asesmen|assesmen|asuhan|catatan|surat|persetujuan|lembar|pengkajian)/i.test(t)
        && t.length > 8 && t.length < 120);
    if (titleInHead) title = titleInHead.replace(/^formulir\s+/i, "").trim();

    /* Isian yang berada DI DALAM kop tidak boleh ikut terhapus: teks/tanggal
       menjadi baris identitas bertipe isian, hidden disimpan terpisah. */
    const tersembunyi = [];
    const controlRows = [];
    const seen = new Set();
    used.forEach((el) => {
        el.querySelectorAll(CONTROL).forEach((c) => {
            const name = (c.getAttribute("name") || "").replace(/\[\]$/, "");
            if (!name || seen.has(name)) return;
            seen.add(name);
            const jenis = (c.getAttribute("type") || c.tagName).toLowerCase();
            if (jenis === "hidden") {
                tersembunyi.push({ field: name, value: c.getAttribute("value") || "" });
                return;
            }
            /* label: sel kiri (tabel lama) atau span kunci identitas di kiri input */
            const labelBox = c.closest("td") || c.closest('[class*="ident"]') || c.parentElement;
            const label = cleanLabel(labelBox?.previousElementSibling?.textContent || "") ||
                cleanLabel(c.getAttribute("placeholder") || "") || name;
            const cls = c.getAttribute("class") || "";
            /* nilai placeholder sistem ({NO_RM} dsb.) dipertahankan sebagai nilai
               awal baris identitas — sama seperti formulir aslinya */
            const initialValue = c.getAttribute("value") || "";
            const tipe = /datepicker/i.test(cls) ? "date"
                : c.tagName === "SELECT" || /^(checkbox|radio)$/.test(jenis) ? "options"
                    : "input";
            const options = c.tagName === "SELECT"
                ? [...c.querySelectorAll("option")].map((o) => tidyText(o.textContent)).filter(Boolean)
                : [];
            controlRows.push({
                key: label, type: tipe, value: initialValue, field: name,
                options: options, multi: jenis === "checkbox", full: false, width: ""
            });
        });
    });
    if (controlRows.length) h.ident = [...(h.ident || []), ...controlRows];

    used.forEach((el) => el.remove());
    return { header: h, title, kode, found, hidden: tersembunyi };
}

/* ==========================================================================
   2. TANDA TANGAN / FOOTER
   ========================================================================== */
const TTD_NAME_RE = /^(paraf|paraf_txt|tgl_ttd|jam_ttd|waktu_ttd|data_id|image_paraf|back_img)/i;
const ROLE_KEYWORD_RE = /\b(dokter|dpjp|perawat|bidan|petugas|pasien|keluarga|apoteker|ahli gizi|penanggung jawab)[^,\n]{0,30}/i;
/* teks murni "tanda tangan"/tombol pentablet: bukan nama peran, dibuang dari kandidat */
const SIGN_PLACEHOLDER_RE = /^(tanda tangan|ttd|pentablet|signature)$/i;

/* Nama peran tanda tangan diambil dari label pendek yang PALING DEKAT dengan
   area tanda tangan (bukan daftar kata kunci yang selalu ketinggalan satu
   formulir) — mis. "Yang Menyerahkan"/"Yang Menerima" pada blok serah-terima
   spesimen, yang tidak memuat kata "dokter/perawat/…" sama sekali. Label
   administratif berakhiran ":" (mis. "Keterangan:") dan teks penampung
   ("Tanda Tangan") disingkirkan dari kandidat. Kembali ke pencocokan kata
   kunci lama bila tidak ada label yang cocok, supaya hasil yang sudah benar
   hari ini tidak berubah. */
function roleOf(block, text) {
    const candidates = [...block.querySelectorAll("label, span, b, strong")]
        .map((el) => tidyText(textWithoutControls(el)))
        .filter((t) => t && t.length >= 3 && t.length <= 40 &&
            !/[:：]\s*$/.test(t) && !SIGN_PLACEHOLDER_RE.test(t));
    if (candidates.length) return candidates[candidates.length - 1];
    return (text.match(ROLE_KEYWORD_RE) || [])[0] || "";
}

export function extractSignatures(scope) {
    const signs = [];
    const tersembunyi = [];
    const rebuiltNames = [];
    const containers = new Set();

    scope.querySelectorAll('input[name^="paraf"], a[id="CreateTTD"], img[id^="image_paraf"]')
        .forEach((el) => {
            const block = el.closest("td") || el.closest("div") || el.parentElement;
            if (block) containers.add(block);
        });

    /* gabungkan wadah yang saling bersarang */
    const daftar = [...containers].filter((a) => ![...containers].some((b) => b !== a && b.contains(a)));

    daftar.forEach((block, i) => {
        const text = textWithoutControls(block);
        const role = roleOf(block, text);
        const city = (text.match(/^([A-Z][a-zA-Z ]{2,20}),/) || [])[1];
        const num = /paraf_(\d+)/.exec(block.innerHTML);
        block.querySelectorAll(CONTROL).forEach((c) => {
            const name = (c.getAttribute("name") || "").replace(/\[\]$/, "");
            if (!name) return;
            if (TTD_NAME_RE.test(name) || c.tagName === "SELECT" || /_txt$/.test(name)) {
                rebuiltNames.push(name);        // dibuat ulang oleh template tanda tangan
                return;
            }
            if ((c.getAttribute("type") || "").toLowerCase() === "hidden") {
                tersembunyi.push({ field: name, value: c.getAttribute("value") || "" });
            } else {
                tersembunyi.push({ field: name, value: "" });
            }
        });

        signs.push({
            ...makeSign(cleanLabel(role || "Petugas")),
            place: city || "Bandung",
            withDate: /,\s*$|tanggal|tgl/i.test(text) || !!block.querySelector('input[name^="tgl"]'),
            withSelect: !!block.querySelector("select"),
            selectField: block.querySelector("select")?.getAttribute("name") || "",
            withPentablet: !!block.querySelector('a[id="CreateTTD"]'),
            urutanAsli: num ? Number(num[1]) : i + 1,
        });
        block.remove();
    });

    signs.sort((a, b) => a.urutanAsli - b.urutanAsli);
    signs.forEach((s) => { delete s.urutanAsli; });
    return { signs, hidden: tersembunyi, rebuilt: [...new Set(rebuiltNames)] };
}
