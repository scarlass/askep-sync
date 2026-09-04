/* ==========================================================================
   import/rows.js — menyusun baris model dari sel/baris dokumen lama
   ==========================================================================
   describeCell     : satu sel -> deskripsi netral (teks, kontrol, rect);
   absorbLabels     : pola <td>Nama</td><td>:</td><td><input></td>;
   buildRows        : satu baris <tr>/wadah -> satu/beberapa baris model,
                      termasuk pecahan geometry (splitByGeometry) untuk sel
                      berisi kontrol campuran, dan kalimat isian;
   assembleRow      : kumpulan komponen -> baris model + lebar kolom
                      (atribut width % dokumen lama, atau ukuran iframe).
   ========================================================================== */

import { makeRow, makeListSeg } from "../model.js";
import {
    CONTROL, tidyText, textWithoutControls, hasControls, numFrom,
} from "./read.js";
import { detectCell, cleanLabel, UNIT_RE } from "./detect.js";
import { visualLines, mergeRect, markOf, stripMarks } from "./geometry.js";
import { sentenceListItem } from "./listify.js";
import { comp, MAX_COLS } from "./shared.js";

/* ==========================================================================
   3. BARIS & SECTION
   ========================================================================== */
export function describeCell(td, ctx) {
    return {
        el: td,
        text: textWithoutControls(td),
        controls: [...td.querySelectorAll(CONTROL)].filter(
            (c) => (c.getAttribute("type") || "").toLowerCase() !== "hidden"),
        colspan: numFrom(td.getAttribute("colspan"), 1),
        width: td.getAttribute("width") || "",
        /* ukuran nyata hasil pengukuran iframe (null bila geometry nonaktif) */
        rect: ctx?.geo?.size ? (ctx.geo.get(markOf(td)) || null) : null,
    };
}

/* Pola umum: <td>Nama</td><td>:</td><td><input></td>
   Sel label digabungkan ke komponen di sebelah kanannya. */
export function absorbLabels(sel) {
    const out = [];
    for (let i = 0; i < sel.length; i += 1) {
        const s = sel[i];
        if (/^[:：]$/.test(s.text) && !s.controls.length) continue;          // sel titik dua
        if (!s.controls.length && s.text && s.text.length <= 60) {
            // cari sel berikutnya yang berisi kontrol (boleh melewati sel ":")
            let j = i + 1;
            while (j < sel.length && /^[:：]?$/.test(sel[j].text) && !sel[j].controls.length) j += 1;
            const right = sel[j];
            if (right && right.controls.length && !hasLeadingText(right)) {
                right.labelPaksa = cleanLabel(s.text);
                right.colspan += s.colspan;
                right.rect = mergeRect(s.rect, right.rect);   // rect label + isian jadi satu
                continue;                                                       // sel label diserap
            }
        }
        out.push(s);
    }
    return out;
}

function hasLeadingText(s) {
    const t = s.text.replace(/[:：]/g, "").trim();
    return t.length > 0 && s.controls.length === 1 &&
        t !== (s.controls[0].getAttribute("value") || "");
}

/* ==========================================================================
   GEOMETRY: pecah elemen kompleks mengikuti tata letak nyata
   ==========================================================================
   Sel/div lama dengan banyak kontrol campuran (input + select, dua input
   beda nama, checkbox + isian …) dulunya langsung jatuh ke Raw HTML. Kini
   anak-anaknya dikelompokkan menurut posisi hasil ukur iframe: sejajar
   mendatar = satu baris, lalu tiap potongan dikenali sebagai komponen.
   ========================================================================== */

/* Mirip gabungLabel, tetapi untuk node hasil pecahan geometri (bukan <td>):
   teks pendek di depan isian diserap jadi label, teks satuan di belakang
   isian diserap jadi unit ("BB" ":" [input] "kg" -> label BB + unit kg). */
function absorbLabelUnit(item, ctx, containers) {
    const nodes = item.map((n) => describeCell(n, ctx));
    nodes.forEach((d) => { d.boundary = containers || null; });   // boundary teks = garis visual ini
    const out = [];
    for (let i = 0; i < nodes.length; i += 1) {
        const s = nodes[i];
        if (/^[:：]$/.test(s.text) && !s.controls.length) continue;          // node ":"
        if (!s.controls.length && s.text && s.text.length <= 60) {
            let j = i + 1;
            while (j < nodes.length && /^[:：]?$/.test(nodes[j].text) && !nodes[j].controls.length) j += 1;
            const right = nodes[j];
            if (right && right.controls.length && !hasLeadingText(right)) {
                right.labelPaksa = cleanLabel(s.text);
                right.rect = mergeRect(s.rect, right.rect);
                continue;                                                     // node label diserap
            }
            const left = out[out.length - 1];
            if (left && left.controls.length === 1 && UNIT_RE.test(s.text)) {
                left.unitPaksa = s.text;
                left.rect = mergeRect(left.rect, s.rect);
                continue;                                                     // node satuan diserap
            }
        }
        out.push(s);
    }
    return out;
}

/* Pecah el menjadi baris-baris visual. Mengembalikan array baris; tiap baris
   = array item { comp, yakin, rect, labelPaksa, unitPaksa, raw }.
   null bila geometri tidak membantu -> pemanggil memakai Raw HTML. */
function splitByGeometry(el, ctx, kedalaman = 0) {
    if (!ctx.geo || !ctx.geo.size || kedalaman > 3) return null;
    const rows = visualLines(el, ctx.geo);
    if (!rows.length) return null;

    const out = [];
    let recognized = 0;
    rows.forEach((item) => {
        const comps = [];
        const tambahan = [];
        absorbLabelUnit(item, ctx, el).forEach((d) => {
            if (!d.text && !d.controls.length && !d.el.querySelector("img")) return;
            const hasil = detectCell(d.el, { ...ctx, boundary: d.boundary });
            if (hasil) {
                comps.push({
                    comp: hasil.comp, confidence: hasil.confidence, rect: d.rect,
                    labelPaksa: d.labelPaksa, unitPaksa: d.unitPaksa, raw: false
                });
                recognized += 1;
                return;
            }
            if (hasControls(d.el)) {
                const dalam = splitByGeometry(d.el, ctx, kedalaman + 1);
                if (dalam) {
                    tambahan.push(...dalam);
                    /* label grup (mis. "Laboratorium") ikut menempel pada isian pertama
                       hasil pecahan, supaya konteksnya tidak hilang */
                    if (d.labelPaksa && dalam[0]?.length) {
                        const first = dalam[0][0];
                        if (first && !first.raw && "label" in first.comp) {
                            first.comp.label = first.comp.label
                                ? `${d.labelPaksa} — ${first.comp.label}` : d.labelPaksa;
                        }
                    }
                    /* hasil pecahan bersarang ikut dihitung dikenali — tanpa ini sel
                       induk bercabang satu (wadah > grid) salah dianggap gagal */
                    recognized += dalam.reduce((n, l) => n + l.filter((x) => !x.raw).length, 0);
                }
                else {
                    /* tidak terpecahkan: simpan apa adanya supaya field tidak hilang */
                    comps.push({
                        comp: comp("html", { html: stripMarks(d.el.innerHTML.trim()) }),
                        confidence: "low", rect: d.rect, raw: true
                    });
                }
            }
        });
        if (comps.length) out.push(comps);
        out.push(...tambahan);
    });

    if (!out.length || recognized < 1) return null;
    return out;
}

/* Menyusun sekumpulan item menjadi satu baris model: gabung pilihan bertetangga
   bernama sama, buang komponen kosong, hitung lebar kolom.
   Lebar diutamakan dari atribut width (%) dokumen lama; bila tidak ada,
   dipakai proporsi hasil ukur iframe (wireframe asli). */
function assembleRow(items) {
    if (!items.length) return null;
    items.forEach((x) => {
        const c = x.comp;
        if (x.labelPaksa && "label" in c && !c.label) c.label = x.labelPaksa;
        if (x.unitPaksa && c.type === "text" && !c.unit) c.unit = x.unitPaksa;
    });

    /* Formulir lama sering menaruh satu checkbox per sel padahal namanya sama.
       Digabung menjadi satu komponen pilihan supaya tidak muncul "nama ganda". */
    const merged = [];
    items.forEach((x) => {
        const c = x.comp;
        const choices = c.type === "checkbox" || c.type === "radio";
        const sama = merged[merged.length - 1];
        if (choices && sama && sama.comp.type === c.type && sama.comp.field &&
            sama.comp.field === c.field) {
            sama.comp.options = [...sama.comp.options, ...(c.options || [])];
            if (!sama.comp.label && c.label) sama.comp.label = c.label;
            sama.rect = mergeRect(sama.rect, x.rect);
            return;
        }
        merged.push(x);
    });

    /* buang komponen kosong (sisa sel dekoratif) */
    const kept = merged.filter((x) => {
        const c = x.comp;
        if (c.type === "static") return !!(c.value || c.label);
        if (c.type === "paragraph") return !!tidyText(c.html || "").length;
        if (c.type === "subtitle") return !!tidyText(c.text || "").length;
        if (c.type === "html") return !!tidyText((c.html || "").replace(/<[^>]+>/g, "")).length
            || /<(input|select|textarea|img)/i.test(c.html || "");
        return true;
    });
    if (!kept.length) return null;

    const used = kept.slice(0, MAX_COLS);
    const row = makeRow(used.length);
    row.cells = used.map((x) => x.comp);
    if (used.length > 1) {
        if (used.every((x) => /^\d+%$/.test(x.width || ""))) {
            row.widths = used.map((x) => x.width).join(" ");
        } else if (used.every((x) => x.rect)) {
            /* proporsi wireframe asli dari hasil ukur iframe */
            const left = Math.min(...used.map((x) => x.rect.x));
            const right = Math.max(...used.map((x) => x.rect.x + x.rect.w));
            const total = right - left;
            if (total > 40) {
                const p = used.map((x) => Math.round(((x.rect.x + x.rect.w) - left) / total * 100));
                p[p.length - 1] += 100 - p.reduce((a, b) => a + b, 0);   // koreksi pembulatan
                if (p.every((v) => v >= 8)) row.widths = p.map((v) => v + "%").join(" ");
            }
        }
    }
    return { row, content: used };
}

/* Satu baris <tr> (atau satu wadah) -> SATU ATAU BEBERAPA baris model.
   Sel yang isinya campuran aduk dan gagal dikenali utuh dicoba dipecah
   dengan geometri dulu; baru jatuh ke Raw HTML. */
export function buildRows(sel, ctx) {
    const plain = [];                       // sel yang langsung jadi komponen
    const splitParts = [];                         // baris visual hasil pecahan sel kompleks
    sel.forEach((s) => {
        if (!s.text && !s.controls.length && !s.el.querySelector("img")) return;   // sel kosong
        const hasil = detectCell(s.el, ctx);
        if (hasil) {
            plain.push({
                comp: hasil.comp, confidence: hasil.confidence, width: s.width,
                rect: s.rect, labelPaksa: s.labelPaksa, raw: false
            });
            return;
        }
        if (hasControls(s.el)) {
            /* label yang diserap gabungLabel ("2. Kepala") harus ikut ke hasil
               pecahan/kalimat — kalau tidak, komponen akhir kehilangan labelnya */
            const teruskanLabel = (first) => {
                if (!s.labelPaksa || !first) return;
                if (first.comp && "label" in first.comp && !first.comp.label) {
                    first.comp.label = s.labelPaksa;
                } else if (first.comp && first.comp.type === "list" && first.comp.items[0]) {
                    const segs = first.comp.items[0].segs || [];
                    if (!segs.length || segs[0].type !== "text") {
                        segs.unshift(makeListSeg("text", { text: s.labelPaksa }));
                        first.comp.items[0].segs = segs;
                    }
                }
            };
            /* kalimat isian ("Hb: ___ , Leukosit: ___") -> satu butir list */
            const item = sentenceListItem(s.el);
            if (item) {
                if (s.labelPaksa && !(item.segs[0] && item.segs[0].type === "text")) {
                    item.segs.unshift(makeListSeg("text", { text: s.labelPaksa }));
                }
                plain.push({
                    comp: comp("list", { marker: "none", items: [item] }),
                    confidence: "medium", width: s.width, rect: s.rect, raw: false
                });
                return;
            }
            const lines = splitByGeometry(s.el, ctx, 0);
            if (lines && lines.length) {
                teruskanLabel(lines[0] && lines[0][0]);
                splitParts.push(lines);
                return;
            }
        }
        plain.push({
            comp: comp("html", { html: stripMarks(s.el.innerHTML.trim()) }),
            confidence: "low", width: s.width, rect: s.rect, raw: true,
        });
    });

    const hasil = [];
    const utama = assembleRow(plain);
    if (utama) hasil.push(utama);
    splitParts.forEach((lines) => lines.forEach((line) => {
        const r = assembleRow(line);
        if (r) hasil.push(r);
    }));

    /* Opsi segrupnama yang terpisah gara-gara pindah garis visual (mis. grid
       4 kolom membungkus ke 2 baris) digabung lagi ke baris sebelumnya supaya
       tidak muncul nama ganda. Hanya bila SELURUH baris lanjutan terserap. */
    for (let i = 0; i < hasil.length - 1; i += 1) {
        const a = hasil[i], b = hasil[i + 1];
        if (!a || !b || !b.content.length) continue;
        const allChoices = b.content.every((x) => x.comp.type === "checkbox" || x.comp.type === "radio");
        if (!allChoices) continue;
        const hasPair = b.content.every((x) =>
            a.content.some((y) => y.comp.type === x.comp.type && y.comp.field && y.comp.field === x.comp.field));
        if (!hasPair) continue;
        b.content.forEach((x) => {
            const t = a.content.find((y) => y.comp.type === x.comp.type && y.comp.field === x.comp.field);
            t.comp.options = [...(t.comp.options || []), ...(x.comp.options || [])];
        });
        hasil[i + 1] = null;                                   // baris lanjutan diserap habis
    }

    const jadi = hasil.filter(Boolean);
    if (!jadi.length) return null;
    return { rows: jadi.map((h) => h.row), content: jadi.flatMap((h) => h.content) };
}
