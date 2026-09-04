/* ==========================================================================
   generate.js — ubah definisi formulir menjadi HTML siap tempel
   ==========================================================================
   Keluaran memakai kelas `askep-*` dari tema, dan selalu menyertakan atribut
   khusus aplikasi (myid, datepickerBoots, smart-form, data-ttd).

   Catatan lebar isian:
   Tema punya lapisan [PENGUNCI] yang memakai `width: 100% !important` supaya
   aturan aplikasi host tidak merusak tampilan. Karena itu lebar khusus dari
   pengguna ditulis sebagai gaya sebaris ber-`!important` — hanya itu yang
   mengalahkan lapisan pengunci.
   ========================================================================== */

import THEME from "./theme/medical-form.css?raw";

const esc = (s = "") =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* -------------------------------------------------------------------------
   pembantu
   ------------------------------------------------------------------------- */
function attr(meta) {
    return meta.fieldAttr ? " " + meta.fieldAttr : "";
}

function nameAttr(field) {
    return field ? ` name="${esc(field)}" id="${esc(field)}"` : "";
}

/* Angka polos dianggap piksel; satuan lain (%, mm, em, fr) dipakai apa adanya. */
export function cssLen(v) {
    if (v === 0) return "0";
    if (v == null || v === "") return "";
    const s = String(v).trim();
    return /^-?\d+(\.\d+)?$/.test(s) ? `${s}px` : s;
}

/* Lebar kolom grid: satuan fr dibungkus minmax(0, …) supaya kolomnya boleh
   menyusut di bawah lebar isinya — tanpa ini kotak identitas melar keluar. */
function trackSize(v) {
    const t = String(v).trim();
    if (/^[\d.]+fr$/.test(t)) return `minmax(0, ${t})`;
    return cssLen(t) || t;
}

function styleAttr(...parts) {
    const s = parts.filter(Boolean).join(";");
    return s ? ` style="${s}"` : "";
}

/* Lebar isian: harus !important agar mengalahkan lapisan [PENGUNCI]. */
function widthCss(w) {
    const v = cssLen(w);
    return v ? `width:${v} !important;flex:0 0 auto !important` : "";
}

function labelTag(c, inline) {
    if (!c.label) return "";
    const req = c.required ? ' <span class="askep-required">*</span>' : "";
    const forAttr = c.field ? ` for="${esc(c.field)}"` : "";
    const cls = "askep-label" + (inline && c.colon !== false ? " askep-label--colon" : "");
    return `<label class="${cls}"${forAttr}>${esc(c.label)}${req}</label>`;
}

/* ==========================================================================
   Segmen butir list (bullet list ber-isian)
   ==========================================================================
   Teks + isian bergantian dalam SATU butir, sebaris, mengalir saat sempit.
   Semua isian tetap menerima atribut aplikasi (myid, datepickerBoots).
   ========================================================================== */
function segList(s, meta, A) {
    if (!s) return "";
    const dc = meta.dateClass ? " " + esc(meta.dateClass) : "";
    const widthAttr = (w) => (cssLen(w) ? ` style="${widthCss(w)}"` : "");
    switch (s.type) {
        case "field": {
            const ph = s.placeholder ? ` placeholder="${esc(s.placeholder)}"` : "";
            const cls = s.inputStyle === "kotak"
                ? "askep-input askep-input--inline"
                : "askep-garis askep-garis--tengah";
            return `<input type="text" class="${cls}"${nameAttr(s.field)}${ph}${widthAttr(s.width)}${A}>`;
        }
        case "select": {
            const op = (s.options || []).map((o) =>
                `<option value="${esc(o)}">${esc(o)}</option>`).join("");
            return `<select class="askep-input askep-input--inline askep-select" aria-label="choices"${nameAttr(s.field)}${widthAttr(s.width)}${A}>` +
                `<option value="">- Pilih -</option>${op}</select>`;
        }
        case "date":
            return `<input type="text" class="askep-garis askep-garis--tengah${dc}"` +
                `${nameAttr(s.field)} placeholder="dd-mm-yy"${widthAttr(s.width)}${A}>`;
        case "time":
            return `<input type="text" class="askep-garis askep-garis--tengah"` +
                `${nameAttr(s.field)} placeholder="hh:mm"${widthAttr(s.width)}${A}>`;
        case "choice": {
            const radio = s.choice !== "check";
            const cls = radio ? "askep-radio" : "askep-check";
            const jenis = radio ? "radio" : "checkbox";
            const nm = s.field ? ` name="${esc(s.field)}"` : "";
            /* jangan pernah render kosong: tanpa opsi tetap ada satu input supaya
               name-nya ikut terekspor (jaring anti hilang) */
            const daftar = s.options && s.options.length ? s.options : ["Ya"];
            const options = daftar.map((o) =>
                `<label class="${cls}"><input type="${jenis}"${nm} value="${esc(o)}"${A}> ${esc(o)}</label>`).join("");
            return `<span class="askep-options askep-options--baseline">${options}</span>`;
        }
        default:
            /* teks: dirender sebagai HTML inline (bisa <b>, <i>, …) seperti list lama */
            return s.text ? `<span class="askep-list-txt">${s.text}</span>` : "";
    }
}

function hintTag(c) {
    return c.hint ? `<div class="askep-hint">${esc(c.hint)}</div>` : "";
}

/* Bungkus baku sebuah field: label di atas (baku) atau "Label : isian". */
function fieldWrap(c, body, extraClass = "") {
    const inline = c.layout === "samping";
    const cls = "askep-field" + (inline ? " askep-field--inline" : "") +
        (extraClass ? " " + extraClass : "");
    const styleStr = inline ? `--askep-kv-width: ${cssLen(c.labelWidth) || "160px"}` : "";
    return `<div class="${cls}"${styleAttr(styleStr)}>${labelTag(c, inline)}${body}${hintTag(c)}</div>`;
}

/* Isian + teks di belakangnya (satuan, "WIB", "s.d.") harus sebaris. */
function withTail(input, ...tails) {
    const tailParts = tails.filter(Boolean).map((t) => (t.startsWith("<") ? t : `<span>${t}</span>`));
    if (!tailParts.length) return input;
    return `<div class="askep-options askep-options--baseline">${input}${tailParts.join("")}</div>`;
}

function inputClass(c, base = "askep-input") {
    return base +
        (c.boxed ? ` ${base}--boxed` : "") +
        (c.unit || c.width || c.suffix ? ` ${base}--inline` : "");
}

/* -------------------------------------------------------------------------
   blok tanda tangan — dipakai footer maupun komponen "Tanda tangan"
   ------------------------------------------------------------------------- */
function signBlock(g, i, meta) {
    const A = attr(meta);
    const dc = meta.dateClass ? " " + esc(meta.dateClass) : "";
    const jam = g.withTime !== false
        ? ` &nbsp;Jam <input type="text" class="askep-line askep-w-50 askep-line--center" name="jam_ttd_${i}" id="jam_ttd_${i}"${A}> WIB`
        : "";
    const tempat = g.withDate
        ? `<div class="askep-sign-place">${esc(g.place || "")}, ` +
        `<input type="text" class="askep-line askep-w-120 askep-line--center${dc}"` +
        ` name="tgl_ttd_${i}" id="tgl_ttd_${i}" placeholder="dd-mm-yy"${A}>${jam}</div>`
        : "";
    const sf = g.selectField || `dokter${i}`;
    const pilih = g.withSelect
        ? `<label class="select askep-no-print" style="display:block;">` +
        `<select class="askep-select" id="${esc(sf)}" name="${esc(sf)}"${A}>` +
        `<option value="">- Pilih -</option></select>` +
        `<input type="hidden" id="${esc(sf)}_txt" name="${esc(sf)}_txt"${A}></label>`
        : "";
    const name = g.withName !== false
        ? `<div class="askep-sign-name askep-print-only">( ................................. )</div>` +
        `<div class="askep-sign-note">Tanda Tangan &amp; Nama Terang</div>`
        : "";
    const tombol = g.withPentablet !== false
        ? `<div class="askep-gap askep-no-print"><a id="CreateTTD" class="askep-btn pointer" data-id="${i}">TTD Pentablet</a></div>`
        : "";
    return `<div class="askep-sign">` +
        tempat +
        (g.role ? `<div class="askep-sign-role">${esc(g.role)}</div>` : "") +
        `<div class="askep-sign-area">` +
        `<div id="back_img_${i}"></div>` +
        `<img id="image_paraf_${i}" src="" alt="" style="display:none;">` +
        `<input type="hidden" name="paraf_${i}" id="paraf_${i}" data-name="paraf" data-id="${i}"${A}>` +
        `<input type="hidden" name="paraf_txt_${i}" id="paraf_txt_${i}"${A}>` +
        `<input type="hidden" name="data_id[]" value="${i}"${A}>` +
        `</div>` +
        pilih + name + tombol +
        `</div>`;
}

/* -------------------------------------------------------------------------
   satu komponen
   ------------------------------------------------------------------------- */
function renderComponent(c, meta) {
    const A = attr(meta);
    const W = widthCss(c.width);

    switch (c.type) {
        /* ---- isian teks ---- */
        case "text": {
            const ph = c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : "";
            const ro = c.readOnly ? " readonly" : "";
            const val = c.value ? ` value="${esc(c.value)}"` : "";
            const input = `<input type="text" class="${inputClass(c)}"${nameAttr(c.field)}${val}${ph}${ro}${styleAttr(W)}${A}>`;
            return fieldWrap(c, withTail(input, c.unit ? esc(c.unit) : ""));
        }

        /* ---- isian angka ---- */
        case "number": {
            const ph = c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : "";
            const ro = c.readOnly ? " readonly" : "";
            const batas = [c.min !== "" && c.min != null ? ` min="${esc(c.min)}"` : "",
            c.max !== "" && c.max != null ? ` max="${esc(c.max)}"` : "",
            c.step !== "" && c.step != null ? ` step="${esc(c.step)}"` : ""].join("");
            const input = `<input type="number" class="${inputClass(c)}"${nameAttr(c.field)}${batas}${ph}${ro}${styleAttr(W)}${A}>`;
            return fieldWrap(c, withTail(input, c.unit ? esc(c.unit) : ""));
        }

        /* ---- isian panjang ---- */
        case "textarea": {
            const cls = "askep-textarea" + (c.ruled ? " askep-textarea--ruled" : "") +
                (c.boxed ? " askep-textarea--boxed" : "");
            const ph = c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : "";
            const styleStr = cssLen(c.width) ? `width:${cssLen(c.width)} !important` : "";
            return fieldWrap(c,
                `<textarea class="${cls}" rows="${c.rows || 3}"${nameAttr(c.field)}${ph}${styleAttr(styleStr)}${A}></textarea>`);
        }

        /* ---- tanggal ---- */
        case "date": {
            const dc = meta.dateClass ? " " + esc(meta.dateClass) : "";
            const ph = c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : "";
            const inline = c.withTime || c.width ? " askep-input--inline" : "";
            const date = `<input type="text" class="askep-input${inline}${dc}"${nameAttr(c.field)}${ph}${styleAttr(W)}${A}>`;
            if (!c.withTime) return fieldWrap(c, withTail(date));
            const jam = `<input type="text" class="askep-line askep-w-60 askep-line--center"` +
                `${nameAttr(c.field ? c.field + "_jam" : "")} placeholder="hh:mm"${A}>`;
            return fieldWrap(c, withTail(date, "Jam", jam, "WIB"));
        }

        /* ---- jam ---- */
        case "time": {
            const ph = c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : "";
            const input = `<input type="text" class="askep-input askep-input--inline askep-line--center"` +
                `${nameAttr(c.field)}${ph}${styleAttr(W || widthCss("70px"))}${A}>`;
            return fieldWrap(c, withTail(input, c.suffix ? esc(c.suffix) : ""));
        }

        /* ---- rentang tanggal ---- */
        case "daterange": {
            const dc = meta.dateClass ? " " + esc(meta.dateClass) : "";
            const styleStr = styleAttr(W || widthCss("120px"));
            const first = `<input type="text" class="askep-input askep-input--inline${dc}"${nameAttr(c.field)} placeholder="dd-mm-yy"${styleStr}${A}>`;
            const second = `<input type="text" class="askep-input askep-input--inline${dc}"${nameAttr(c.fieldTo)} placeholder="dd-mm-yy"${styleStr}${A}>`;
            return fieldWrap(c, withTail(first, esc(c.separator || "s.d."), second));
        }

        /* ---- dropdown ---- */
        case "select": {
            const opts = c.kind === "dynamic" ? (c.dynamicOptions || "")
                : [c.firstBlank ? `<option value="">${esc(c.firstBlank)}</option>` : ""]
                    .concat((c.options || []).map((o) =>
                        `<option value="${esc(o.value || o.label)}">${esc(o.label)}</option>`))
                    .join("");
            const styleStr = cssLen(c.width) ? `width:${cssLen(c.width)} !important` : "";
            return fieldWrap(c,
                `<select class="askep-select"${nameAttr(c.field)}${styleAttr(styleStr)}${A}>${opts}</select>`);
        }

        /* ---- kotak per karakter ---- */
        case "boxes": {
            const n = Math.max(1, Math.min(Number(c.count) || 8, 30));
            const kotak = Array.from({ length: n }, () =>
                `<input type="text" class="askep-box" maxlength="1"` +
                (c.field ? ` name="${esc(c.field)}[]"` : "") + `${A}>`).join("");
            return fieldWrap(c, `<div class="askep-boxes">${kotak}</div>`);
        }

        /* ---- field tersembunyi ---- */
        case "hidden":
            return `<input type="hidden"${nameAttr(c.field)} value="${esc(c.value || "")}"${A}>`;

        /* ---- checkbox / radio ---- */
        case "checkbox":
        case "radio": {
            const isCb = c.type === "checkbox";
            const cls = isCb ? "askep-check" : "askep-radio";
            const inputType = isCb ? "checkbox" : "radio";
            const nm = c.field ? (isCb ? `${c.field}[]` : c.field) : "";
            const grid = c.columns > 1 ? ` askep-options--grid${Math.min(c.columns, 5)}` : "";
            const opts = (c.options || []).map((o) => {
                const val = o.value || o.label;
                return `<label class="${cls}"><input type="${inputType}"` +
                    (nm ? ` name="${esc(nm)}"` : "") + ` value="${esc(val)}"${A}> ${esc(o.label)}</label>`;
            });
            if (c.otherField) {
                opts.push(`<label class="${cls}"><input type="${inputType}"` +
                    (nm ? ` name="${esc(nm)}"` : "") + ` value="lainnya"${A}> Lainnya:</label>` +
                    `<input type="text" class="askep-line askep-w-150"${nameAttr(c.otherField)}${A}>`);
            }
            return fieldWrap(c, `<div class="askep-options${grid}">${opts.join("")}</div>`);
        }

        /* ---- ceklis + isian di belakangnya ---- */
        case "checkfill": {
            const nm = c.field ? `${c.field}[]` : "";
            const grid = c.columns > 1 ? ` askep-options--grid${Math.min(c.columns, 5)}` : "";
            const widthAttr = cssLen(c.fillWidth) || "120px";
            const opts = (c.items || []).map((it) => {
                const box = `<label class="askep-check"><input type="checkbox"` +
                    (nm ? ` name="${esc(nm)}"` : "") + ` value="${esc(it.text)}"${A}> ${esc(it.text)}</label>`;
                const tailParts = it.field
                    ? `<input type="text" class="askep-line"${nameAttr(it.field)}` +
                    `${styleAttr(widthCss(widthAttr))}${A}>`
                    : "";
                return box + tailParts;
            }).join("");
            return fieldWrap(c, `<div class="askep-options askep-options--baseline${grid}">${opts}</div>`);
        }

        /* ---- skala angka (mis. skala nyeri 0-10) ---- */
        case "scale": {
            const min = Number(c.min) || 0;
            const max = Number(c.max) >= min ? Number(c.max) : min + 10;
            const butir = [];
            for (let n = min; n <= max; n += 1) {
                butir.push(`<label class="askep-scale-item"><span>${n}</span>` +
                    `<input type="radio"` + (c.field ? ` name="${esc(c.field)}"` : "") +
                    ` value="${n}"${A}></label>`);
            }
            const left = c.leftLabel ? `<span class="askep-scale-end">${esc(c.leftLabel)}</span>` : "";
            const right = c.rightLabel ? `<span class="askep-scale-end">${esc(c.rightLabel)}</span>` : "";
            return fieldWrap(c, `<div class="askep-scale">${left}${butir.join("")}${right}</div>`);
        }

        /* ---- kotak skor / total ---- */
        case "score": {
            const ro = c.readOnly ? " readonly" : "";
            const kotak = `<input type="text" class="askep-input askep-input--inline` +
                (c.boxed ? " askep-input--boxed" : "") + ` askep-line--center"` +
                `${nameAttr(c.field)}${ro}` +
                `${styleAttr(widthCss(c.width || "60px"), "text-align:center")}${A}>`;
            const tailParts = `<div class="askep-score">${kotak}` +
                (c.unit ? `<span>${esc(c.unit)}</span>` : "") +
                (c.note ? `<span class="askep-score-note">${esc(c.note)}</span>` : "") + `</div>`;
            return fieldWrap(c, tailParts);
        }

        /* ---- Label : isian (satu baris ringkas) ---- */
        case "kv": {
            const dc = meta.dateClass ? " " + esc(meta.dateClass) : "";
            const widthAttr = `width:${cssLen(c.width) || "120px"} !important`;
            const tengah = c.center ? " askep-line--center" : "";
            let tailParts;
            if (c.kind === "select") {
                const opts = [`<option value="">- Pilih -</option>`]
                    .concat((c.options || []).map((o) =>
                        `<option value="${esc(o.value || o.label)}">${esc(o.label)}</option>`)).join("");
                tailParts = `<select class="askep-select askep-input--inline"${nameAttr(c.field)}` +
                    ` style="${widthAttr};display:inline-block"${A}>${opts}</select>`;
            } else if (c.kind === "static") {
                tailParts = `<span class="askep-value askep-value--strong" style="display:inline-block;${widthAttr}">${c.value || ""}</span>`;
            } else {
                const tipe = c.kind === "number" ? "number" : "text";
                const kelasTgl = c.kind === "date" ? dc : "";
                const ph = c.kind === "date" ? ' placeholder="dd-mm-yy"'
                    : c.kind === "time" ? ' placeholder="hh:mm"' : "";
                tailParts = `<input type="${tipe}" class="askep-line${tengah}${kelasTgl}"${nameAttr(c.field)}${ph}` +
                    ` style="${widthAttr}"${A}>`;
            }
            const req = c.required ? ' <span class="askep-required">*</span>' : "";
            const unit = c.unit ? ` ${esc(c.unit)}` : "";
            return `<div class="askep-kv" style="--askep-kv-width: ${cssLen(c.labelWidth) || "160px"};">` +
                `<span class="askep-kv-key">${esc(c.label)}${req}</span>` +
                `<span class="askep-kv-value">${tailParts}${unit}` +
                `${c.hint ? ` <span class="askep-hint">${esc(c.hint)}</span>` : ""}</span></div>`;
        }

        /* ---- nilai dari sistem ---- */
        case "static": {
            const cls = "askep-value" + (c.strong ? " askep-value--strong" : "");
            const inline = c.layout === "samping";
            const fieldCls = "askep-field" + (inline ? " askep-field--inline" : "");
            const styleStr = inline ? `--askep-kv-width: ${cssLen(c.labelWidth) || "160px"}` : "";
            const lbl = c.label
                ? `<label class="askep-label${inline && c.colon !== false ? " askep-label--colon" : ""}">${esc(c.label)}</label>`
                : "";
            return `<div class="${cls}"${styleAttr(styleStr)}>${lbl}` +
                `<span class="${cls}">${c.value || ""}</span>${hintTag(c)}</div>`;
        }

        /* ---- matriks ceklis ---- */
        case "matrix": {
            const choices = c.choices || [];
            const head = [`<th>${esc(c.itemHeader || "")}</th>`]
                .concat(choices.map((ch) => `<th style="width:52px">${esc(ch)}</th>`))
                .concat(c.noteColumn ? [`<th>${esc(c.noteColumn)}</th>`] : [])
                .join("");
            const body = (c.items || []).map((it) => {
                const nm = it.field ? (c.single ? it.field : `${it.field}[]`) : "";
                const cols = choices.map((ch) =>
                    `<td class="askep-center"><label class="askep-check">` +
                    `<input type="${c.single ? "radio" : "checkbox"}"` +
                    (nm ? ` name="${esc(nm)}"` : "") + ` value="${esc(ch)}"${A}></label></td>`
                ).join("");
                // nama kolom keterangan boleh ditentukan sendiri (penting saat impor
                // formulir lama yang memakai nama bebas seperti input0044)
                const nmKet = it.noteField || (it.field ? `${it.field}_ket` : "");
                const note = c.noteColumn
                    ? `<td><input type="text" class="askep-line askep-w-full"${nameAttr(nmKet)}${A}></td>`
                    : "";
                return `<tr><td>${esc(it.text)}</td>${cols}${note}</tr>`;
            }).join("");
            const cap = c.title ? `<div class="askep-subtitle">${esc(c.title)}</div>` : "";
            return `${cap}<div class="askep-table-wrap"><table class="askep-table">` +
                `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
        }

        /* ---- tabel data ---- */
        case "table": {
            const cols = c.columns || [];
            const head = (c.numbered ? [`<th style="width:34px">No</th>`] : [])
                .concat(cols.map((k) => `<th${k.width ? ` style="width:${esc(k.width)}"` : ""}>${esc(k.head)}</th>`))
                .join("");
            const body = Array.from({ length: c.rows || 1 }, (_, i) => {
                const cells = cols.map((k) =>
                    `<td><input type="text" class="askep-line askep-w-full"` +
                    (k.field ? ` name="${esc(k.field)}[]"` : "") + `${A}></td>`).join("");
                return `<tr>${c.numbered ? `<td class="askep-center">${i + 1}</td>` : ""}${cells}</tr>`;
            }).join("");
            const btn = c.addButton
                ? `<div class="askep-gap askep-no-print"><a class="askep-btn" id="addrow_${esc(cols[0]?.field || "x")}">` +
                `+ ${esc(c.addLabel || "Tambah baris")}</a></div>`
                : "";
            return `<div class="askep-table-wrap"><table class="askep-table">` +
                `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${btn}`;
        }

        /* ---- teks bebas ---- */
        case "paragraph": {
            const style = [c.strong ? "font-weight:bold" : "", c.center ? "text-align:center" : ""]
                .filter(Boolean).join(";");
            return `<div${style ? ` style="${style}"` : ""}>${c.html || ""}</div>`;
        }

        case "subtitle":
            return `<div class="askep-subtitle${c.italic ? " askep-subtitle--italic" : ""}">${esc(c.text)}</div>`;

        /* ---- daftar poin ---- */
        case "list": {
            const tag = c.marker === "decimal" || c.marker === "alpha" ? "ol" : "ul";
            const cls = `askep-list askep-list--${c.marker || "disc"}`;
            /* Butir = segmen teks/isian sebaris; butir lama berupa string tetap
               didukung (dikira-kira jadi satu segmen teks). */
            const li = (c.items || []).map((it) => {
                const segs = typeof it === "string"
                    ? [{ type: "text", text: it }]
                    : (it.segs || []);
                return `<li><span class="askep-list-row">${segs.map((s) => segList(s, meta, A)).join("")}</span></li>`;
            }).join("");
            return `<${tag} class="${cls}">${li}</${tag}>`;
        }

        /* ---- kotak catatan ---- */
        case "note":
            return `<div class="askep-note${c.plain ? " askep-note--plain" : ""}">${c.html || ""}</div>`;

        /* ---- gambar ---- */
        case "image": {
            const styleStr = cssLen(c.height) ? ` style="height:${cssLen(c.height)}"` : "";
            const img = c.src ? `<img src="${esc(c.src)}" alt="${esc(c.alt || "")}"${styleStr}>` : "";
            const cap = c.caption ? `<div class="askep-figure-caption">${esc(c.caption)}</div>` : "";
            return `<div class="askep-figure${c.center ? " askep-figure--center" : ""}">${img}${cap}</div>`;
        }

        case "divider":
            return `<div style="border-top:1px ${c.dashed ? "dashed" : "solid"} var(--askep-color-border);margin:6px 0;"></div>`;

        case "spacer":
            return `<div class="askep-spacer" style="height:${cssLen(c.height) || "10px"}"></div>`;

        case "pagebreak":
            return `<div class="askep-pagebreak"></div>`;

        /* ---- tanda tangan ---- */
        case "signature":
            return `<div class="askep-footer-row">${signBlock(c, c.parafIndex || 1, meta)}</div>`;

        /* ---- tombol aksi untuk skrip aplikasi ---- */
        case "button":
            return `<div class="askep-gap askep-no-print"><a class="askep-btn pointer${c.extraClass ? " " + esc(c.extraClass) : ""}"` +
                `${c.elementId ? ` id="${esc(c.elementId)}"` : ""}>${esc(c.label || "Tombol")}</a></div>`;

        case "html":
            return c.html || "";

        default:
            return "";
    }
}

/* -------------------------------------------------------------------------
   baris & section
   ------------------------------------------------------------------------- */
function renderRow(row, meta) {
    const tailParts = row.cells.map((c) => {
        if (!c) return "<div></div>";
        const html = renderComponent(c, meta);
        const span = Math.min(Math.max(Number(c.span) || 1, 1), row.cols);
        // sel yang melebar dibungkus supaya kelas span menempel pada anak grid
        return span > 1 ? `<div class="askep-span-${span}">${html}</div>` : html;
    });
    const widthAttr = (row.widths || "").trim();
    if (row.cols === 1 && !widthAttr) return `      ${tailParts[0]}`;
    const cls = row.cols === 2 ? "askep-grid" : `askep-grid askep-grid--${row.cols}`;
    // Lebar kolom bebas dikirim lewat custom property, BUKAN gaya sebaris
    // ber-!important — supaya media query layar sempit masih bisa
    // meruntuhkannya menjadi satu kolom.
    const styleStr = widthAttr ? ` style="--askep-cols: ${esc(widthAttr)}"` : "";
    return `      <div class="${cls}"${styleStr}>\n        ${tailParts.join("\n        ")}\n      </div>`;
}

function renderSection(sec, idx, meta) {
    const letter = meta.letterSections ? `${LETTERS[idx] || "?"}. ` : "";
    const rows = sec.rows.map((r) => renderRow(r, meta)).join("\n");
    const title = sec.title
        ? `    <div class="askep-section-title">${esc(letter + sec.title)}</div>\n`
        : "";
    return `  <div class="askep-section">\n${title}    <div class="askep-section-content">\n${rows}\n    </div>\n  </div>`;
}

/* -------------------------------------------------------------------------
   kop & footer — seluruhnya mengikuti pengaturan pengguna
   ------------------------------------------------------------------------- */
const SIDE_CLASS = { kiri: "askep-side--left", tengah: "askep-side--center", kanan: "askep-side--right" };

function renderHeader(meta) {
    if (!meta.showHeader) return "";
    const h = meta.header || {};

    /* --- blok-blok penyusun kop --- */
    const logo = h.showLogo && h.logoSrc
        ? `<div class="askep-header-logo"${styleAttr(cssLen(h.logoWidth) ? `--askep-logo-width: ${cssLen(h.logoWidth)}` : "")}>` +
        `<img src="${h.logoSrc}" alt="Logo RS"></div>`
        : "";

    const alamat = (h.addressLines || "").split("\n").filter((b) => b.trim() !== "")
        .map((b) => b.trim()).join("<br>");
    const info = [
        h.hospitalName ? `<div class="askep-header-name">${h.hospitalName}</div>` : "",
        alamat ? `<div class="askep-header-address">${alamat}</div>` : "",
    ].filter(Boolean).join("");

    const title = [
        h.showTitle !== false ? `<div class="askep-header-title">${esc(meta.title)}</div>` : "",
        h.showDocCode !== false && meta.docCode
            ? `<div class="askep-hint">Formulir ${esc(meta.docCode)}</div>` : "",
        h.extraHtml ? `<div class="askep-hint">${h.extraHtml}</div>` : "",
    ].filter(Boolean).join("");

    const A = attr(meta);
    const dc = meta.dateClass ? " " + esc(meta.dateClass) : "";
    const identRows = (h.ident || []).map((it) => {
        const tipe = it.type || "static";
        const penuh = it.full ? " askep-header-ident-full" : "";
        /* Lebar khusus baris ini dihitung terhadap KOTAK identitas: barisnya
           dibungkus .askep-header-ident-row dan lebarnya dikirim lewat custom
           property, jadi 100% berarti selebar kotak — bukan selebar kolom. */
        const customWidth = cssLen(it.width);
        const label = it.key
            ? `<span class="askep-header-ident-key${it.full ? " askep-header-ident-key--full" : ""}">${esc(it.key)}</span>`
            : "";
        let tailParts;
        if (tipe === "input" || tipe === "date") {
            const cls = "askep-input askep-input--inline" + (tipe === "date" ? dc : "");
            const ph = tipe === "date" ? ' placeholder="dd-mm-yy"' : "";
            /* nilai awal (mis. placeholder sistem {NO_RM}) ikut ditulis ulang agar
               hasil impor tidak kehilangan prapengisian aplikasi */
            const val = it.value ? ` value="${esc(it.value)}"` : "";
            tailParts = `<span class="askep-header-ident-value${penuh}">` +
                `<input type="text" class="${cls}"${nameAttr(it.field)}${val}${ph}${A}></span>`;
        } else if (tipe === "blank") {
            tailParts = `<span class="askep-header-ident-value${penuh}">&nbsp;</span>`;
        } else if (tipe === "options") {
            // radio = satu pilihan; checkbox (multi) memakai name berakhiran []
            const banyak = !!it.multi;
            const nm = it.field ? esc(it.field) + (banyak ? "[]" : "") : "";
            const cls = banyak ? "askep-check" : "askep-radio";
            const jenis = banyak ? "checkbox" : "radio";
            const options = (it.options || []).map((o) =>
                `<label class="${cls}"><input type="${jenis}"` +
                (nm ? ` name="${nm}"` : "") + ` value="${esc(o)}"${A}> ${esc(o)}</label>`).join("");
            tailParts = `<span class="askep-header-ident-value askep-header-ident-full">${options}</span>`;
        } else {
            tailParts = `<span class="askep-header-ident-value${penuh}">${it.value || ""}</span>`;
        }
        if (!customWidth) return label + tailParts;
        // baris berlebar khusus dibungkus supaya lepas dari kolom nilai
        return `<span class="askep-header-ident-row" style="--askep-ident-row: ${customWidth}">` +
            `${label}${tailParts}</span>`;
    }).join("");
    const identPos = { kiri: "left", tengah: "center", kanan: "right" }[h.identAlign || "kanan"];
    const identStyle = [
        cssLen(h.identWidth) ? `--askep-ident-width: ${cssLen(h.identWidth)}` : "",
        h.identKeyWidth ? `--askep-ident-key: ${trackSize(h.identKeyWidth)}` : "",
        h.identValueWidth ? `--askep-ident-value: ${trackSize(h.identValueWidth)}` : "",
        h.identFontSize ? `--askep-ident-fs: ${esc(h.identFontSize)}` : "",
    ];
    const ident = h.showIdent !== false && identRows
        ? `<div class="askep-header-ident askep-header-ident--${identPos}"` +
        `${styleAttr(...identStyle)}>${identRows}</div>` : "";

    /* --- bagi ke sisi kiri / kanan sesuai pilihan pengguna --- */
    const sisi = (name) => (h[name] === "kanan" ? "kanan" : "kiri");
    const kotak = [
        { tailParts: logo, sisi: sisi("logoSide"), bungkus: false },
        { tailParts: info, sisi: sisi("infoSide"), bungkus: true },
        { tailParts: title, sisi: sisi("titleSide"), bungkus: true },
        { tailParts: ident, sisi: sisi("identSide"), bungkus: false },
    ].filter((k) => k.tailParts);

    const susun = (daftar) => {
        /* nama RS dan judul digabung dalam satu blok supaya rapat ke logo */
        const rumah = daftar.filter((k) => k.bungkus).map((k) => k.tailParts).join("");
        const lepas = daftar.filter((k) => !k.bungkus).map((k) => k.tailParts).join("");
        return (rumah ? `<div class="askep-header-hospital">${rumah}</div>` : "") + lepas;
    };
    const urutKiri = kotak.filter((k) => k.sisi === "kiri");
    const urutKanan = kotak.filter((k) => k.sisi === "kanan");
    /* logo selalu tampil paling depan pada sisinya */
    const susunSisi = (daftar) => {
        const logoDulu = daftar.filter((k) => k.tailParts === logo && logo);
        const sisa = daftar.filter((k) => !(k.tailParts === logo && logo));
        return logoDulu.map((k) => k.tailParts).join("") + susun(sisa);
    };

    const isiKiri = susunSisi(urutKiri);
    const isiKanan = susunSisi(urutKanan);
    if (!isiKiri && !isiKanan) return "";

    const duaSisi = h.split !== false && isiKiri && isiKanan;
    const cls = ["askep-header",
        duaSisi ? "askep-header--split" : "askep-header--stack",
        duaSisi && h.divider !== false ? "askep-header--divided" : ""]
        .filter(Boolean).join(" ");
    const kolom = duaSisi
        ? `--askep-header-cols: ${cssLen(h.leftWidth) || "1fr"} ${cssLen(h.rightWidth) || "auto"}`
        : "";

    const kiriKelas = ["askep-header-left", SIDE_CLASS[h.leftAlign] || ""].filter(Boolean).join(" ");
    const kananKelas = ["askep-header-right", SIDE_CLASS[h.rightAlign] || ""].filter(Boolean).join(" ");

    return `  <div class="${cls}"${styleAttr(kolom)}>\n` +
        (isiKiri ? `    <div class="${kiriKelas}">${isiKiri}</div>\n` : "") +
        (isiKanan ? `    <div class="${kananKelas}">${isiKanan}</div>\n` : "") +
        `  </div>\n`;
}

const ALIGN = { kanan: "flex-end", kiri: "flex-start", tengah: "center", rata: "space-between" };

function renderFooter(meta) {
    if (!meta.showFooter) return "";
    const f = meta.footer || {};
    const signs = f.signs || [];
    const catatan = f.note ? `<div class="askep-footer-note askep-hint">${f.note}</div>` : "";
    const cetak = f.showPrintDate
        ? `    <div class="askep-footer-print">Dicetak: {TGL_CETAK}</div>\n` : "";

    /* ---------- footer dibagi dua sisi ---------- */
    if (f.split) {
        const nomor = new Map(signs.map((g, i) => [g, i + 1]));
        const buatSisi = (mana, ratakan) => {
            const punya = signs.filter((g) => (g.side === "kanan" ? "kanan" : "kiri") === mana);
            const rows = punya.length
                ? `<div class="askep-footer-row"${styleAttr(`justify-content: ${ALIGN[ratakan] || "flex-start"}`)}>` +
                punya.map((g) => signBlock(g, nomor.get(g), meta)).join("") + `</div>`
                : "";
            const isiCatatan = (f.noteSide || "kiri") === mana ? catatan : "";
            return isiCatatan + rows;
        };
        const left = buatSisi("kiri", f.leftAlign || "kiri");
        const right = buatSisi("kanan", f.rightAlign || "kanan");
        const kolom = `--askep-footer-cols: ${cssLen(f.leftWidth) || "1fr"} ${cssLen(f.rightWidth) || "1fr"}`;
        return `  <div class="askep-footer">\n` +
            `    <div class="askep-footer--split"${styleAttr(kolom)}>\n` +
            `      <div class="askep-footer-side ${SIDE_CLASS[f.leftAlign] || "askep-side--left"}">${left}</div>\n` +
            `      <div class="askep-footer-side ${SIDE_CLASS[f.rightAlign] || "askep-side--right"}">${right}</div>\n` +
            `    </div>\n${cetak}  </div>\n`;
    }

    /* ---------- satu baris (baku) ---------- */
    const styleStr = styleAttr(ALIGN[f.align] && f.align !== "kanan"
        ? `justify-content: ${ALIGN[f.align]}` : "");
    const blok = signs.map((g, i) => `      ${signBlock(g, i + 1, meta)}`).join("\n");
    const rows = signs.length
        ? `    <div class="askep-footer-row"${styleStr}>\n${blok}\n    </div>\n` : "";
    const catatanBaris = catatan ? `    ${catatan}\n` : "";
    if (!rows && !catatanBaris && !cetak) return "";
    return `  <div class="askep-footer">\n${catatanBaris}${rows}${cetak}  </div>\n`;
}

/* -------------------------------------------------------------------------
   navigasi halaman — meniru markup aplikasi:
   <ul class="pagination"><li myid="li_page_1"><a href="javascript:NextPage(1);">
   ------------------------------------------------------------------------- */
function renderPagination(meta, jumlah, bawah) {
    const pg = meta.paging || {};
    const fn = pg.functionName || "NextPage";
    const item = [];
    if (pg.label) {
        item.push(`      <li class="askep-pagination-label"><a href="javascript:void(0);">${esc(pg.label)}</a></li>`);
    }
    for (let i = 1; i <= jumlah; i += 1) {
        item.push(`      <li${i === 1 ? ' class="active"' : ""} myid="li_page_${i}">` +
            `<a href="javascript:${esc(fn)}(${i});">${i}</a></li>`);
    }
    return `  <div class="askep-no-print hide-print">\n` +
        `    <ul class="pagination askep-pagination${bawah ? " askep-pagination--bottom" : ""}">\n` +
        `${item.join("\n")}\n    </ul>\n  </div>\n`;
}

/* Skrip pindah halaman. Hanya didefinisikan bila aplikasi belum punya, jadi
   fungsi bawaan aplikasi tetap yang dipakai kalau ada. */
function renderPagingScript(meta, jumlah) {
    const pg = meta.paging || {};
    if (!pg.includeScript || jumlah < 2) return "";
    const fn = pg.functionName || "NextPage";
    const pre = pg.idPrefix || "dokumen_page_";
    const hid = pg.hiddenClass || "hidden";
    return `<script type="text/javascript">
/* Navigasi halaman formulir (dibuat Medical Form Builder). */
if (typeof window.${fn} !== "function") {
  window.${fn} = function (idx) {
    var halaman = document.querySelectorAll("[id^='${pre}']");
    for (var i = 0; i < halaman.length; i++) { halaman[i].classList.add("${hid}"); }
    var active = document.getElementById("${pre}" + idx);
    if (active) { active.classList.remove("${hid}"); }
    var tab = document.querySelectorAll("[myid^='li_page_']");
    for (var j = 0; j < tab.length; j++) { tab[j].classList.remove("active"); }
    var kini = document.querySelectorAll("[myid='li_page_" + idx + "']");
    for (var k = 0; k < kini.length; k++) { kini[k].classList.add("active"); }
  };
}
</script>
`;
}

/* -------------------------------------------------------------------------
   keluaran akhir
   ------------------------------------------------------------------------- */
export function generateBody(form) {
    const { meta, sections } = form;
    const pg = meta.paging || {};
    const pakaiPaging = !!pg.enabled;
    const jumlah = pakaiPaging
        ? Math.max(1, ...sections.map((s) => Number(s.page) || 1))
        : 1;

    /* huruf section berjalan terus lintas halaman: A, B, C, ... */
    let urut = 0;
    const isiSection = (daftar) =>
        daftar.map((s) => renderSection(s, urut++, meta)).join("\n\n");

    const kop = renderHeader(meta);
    const kaki = renderFooter(meta);
    const kopTiapHalaman = meta.header?.everyPage;
    const kakiTiapHalaman = meta.footer?.everyPage;

    let badan;
    if (!pakaiPaging) {
        badan = `${kop}    <div class="askep-body">\n\n${isiSection(sections)}\n\n    </div>\n\n${kaki}`;
    } else {
        const block = [];
        for (let i = 1; i <= jumlah; i += 1) {
            const punya = sections.filter((s) => (Number(s.page) || 1) === i);
            const cls = "askep-page-part" + (i > 1 ? ` ${pg.hiddenClass || "hidden"}` : "");
            const kopIni = (i === 1 || kopTiapHalaman) ? kop : "";
            const kakiIni = (i === jumlah || kakiTiapHalaman) ? kaki : "";
            block.push(
                `    <fieldset id="${esc(pg.idPrefix || "dokumen_page_")}${i}" class="${cls}">\n` +
                `${kopIni}      <div class="askep-body">\n\n${isiSection(punya)}\n\n      </div>\n\n` +
                `${kakiIni}    </fieldset>`);
        }
        badan = block.join("\n\n");
    }

    const styleStr = [];
    if (meta.pageWidth && meta.pageWidth !== "none") styleStr.push(`--askep-page-width: ${esc(meta.pageWidth)}`);
    const pageStyle = styleStr.length ? ` style="${styleStr.join(";")}"` : "";
    const kelasAkar = "askep askep-page" +
        (pakaiPaging && pg.printAll && jumlah > 1 ? " askep-print-all" : "");

    const navAtas = pakaiPaging && pg.navTop && jumlah > 1 ? renderPagination(meta, jumlah, false) : "";
    const navBawah = pakaiPaging && pg.navBottom && jumlah > 1 ? renderPagination(meta, jumlah, true) : "";
    const skrip = pakaiPaging ? renderPagingScript(meta, jumlah) : "";

    return `<div class="${kelasAkar}"${pageStyle}>${navAtas}  <form class="${esc(meta.formClass)}"${meta.dataTtd ? ` data-ttd="${esc(meta.dataTtd)}"` : ""}>

${badan}

  </form>
${navBawah}${skrip}</div>`;
}

export function generateHtml(form) {
    /* Model proyek disematkan sebagai blok JSON inert di akhir berkas.
       Tombol Import HTML di builder membacanya LEBIH DULU sehingga ekspor
       builder sendiri dipulihkan EXACT — round-trip tanpa kehilangan, tanpa
       tebakan heuristik. Nonaktif lewat meta.embedModel = false. */
    const sematan = form.meta?.embedModel === false ? "" :
        '<script type="application/json" id="askep-model">' +
        JSON.stringify(form).split("</").join("<\\/") + "</script>\n"; return `<style type="text/css">\n${THEME}\n</style>\n\n${generateBody(form)}\n${sematan}`;
}

export function generatePreview(form) {
    return `<!doctype html><html lang="id"><head><meta charset="utf-8">` +
        `<style>body{margin:0;background:#fff}\n${THEME}</style></head><body>` +
        `${generateBody(form)}</body></html>`;
}

/* Ringkasan untuk panel statistik */
export function summarise(form) {
    let fields = 0, rows = 0, comps = 0;
    // Tiap komponen menyumbang satu nama per field. Grup radio/checkbox memang
    // memakai satu nama untuk banyak opsi — itu benar, jadi tidak dihitung ganda.
    const names = [];
    const push = (n) => n && names.push(n);
    if (form.meta.showHeader) {
        (form.meta.header?.ident || []).forEach((it) => {
            if (it.field && it.type && it.type !== "static" && it.type !== "blank") {
                fields += 1; push(it.field);
            }
        });
    }
    if (form.meta.showFooter) {
        (form.meta.footer?.signs || []).forEach((_, i) => {
            push(`paraf_${i + 1}`); push(`paraf_txt_${i + 1}`);
        });
    }
    form.sections.forEach((s) => {
        s.rows.forEach((r) => {
            rows += 1;
            r.cells.forEach((c) => {
                if (!c) return;
                comps += 1;
                if (c.field) { fields += 1; push(c.field); }
                if (c.fieldTo) { fields += 1; push(c.fieldTo); }
                if (c.type === "table") (c.columns || []).forEach((k) => push(k.field));
                if (c.type === "matrix") (c.items || []).forEach((k) => {
                    push(k.field);
                    push(k.noteField || (k.field ? `${k.field}_ket` : ""));
                });
                if (c.type === "checkfill") (c.items || []).forEach((k) => push(k.field));
                if (c.type === "signature") {
                    const i = c.parafIndex || 1;
                    push(`paraf_${i}`); push(`paraf_txt_${i}`);
                }
            });
        });
    });
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    const pages = form.meta.paging?.enabled
        ? Math.max(1, ...form.sections.map((s) => Number(s.page) || 1)) : 1;
    return {
        sections: form.sections.length, rows, comps, fields, pages,
        names, dup: [...new Set(dup)]
    };
}
