/* ==========================================================================
   import/geometry.js — pengukuran tata letak nyata lewat iframe tersembunyi
   ==========================================================================
   Prinsip: "plugin" terbaik untuk membaca wireframe adalah mesin tata letak
   peramban itu sendiri. HTML lama dirender di iframe tersembunyi (CSS asli
   DIPERTAHANKAN hanya di sini sebagai alat ukur, skrip dibuang), lalu
   posisi setiap elemen diukur memakai getBoundingClientRect().

   Hasil ukur dipakai build.js/detect.js untuk mengenali baris & kolom VISUAL,
   bukan menebak-nebak dari markup semata:
   - sel dengan banyak kontrol campuran dipecah mengikuti baris visual;
   - lebar kolom baris dihitung dari ukuran nyata (proporsi wireframe asli);
   - judul section dikenali dari font tebal/besar hasil computed style.

   Kunci peta bukan posisi jalur, melainkan atribut penanda data-geo-i yang
   diberikan SEBELUM pengukuran — sehingga penghapusan elemen oleh
   ekstrakKop/ekstrakTtd (kop, tanda tangan) tidak menggeser kunci.
   Penanda dibuang lagi dari setiap HTML yang keluar (tanpaTanda).

   CSS lama TIDAK PERNAH ikut keluar — iframe ini meja pengukuran, bukan
   bagian dari hasil.
   ========================================================================== */

import { parseDocument } from "./read.js";

const MARK_ATTR = "data-geo-i";

/* Beri penanda urutan pada seluruh elemen (urutan pohon). */
export function stampDoc(doc) {
    let n = 0;
    const jalan = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
    while (jalan.nextNode()) jalan.currentNode.setAttribute(MARK_ATTR, String(n += 1));
}

/* Kunci peta geometri sebuah elemen. */
export const markOf = (el) => (el && el.getAttribute ? el.getAttribute(MARK_ATTR) : null);

/* Buang penanda dari string HTML sebelum dipakai/diekspor. */
export const stripMarks = (h) =>
    String(h || "").replace(new RegExp(`\\s${MARK_ATTR}="\\d+"`, "g"), "");

const twoRafs = () => new Promise((ok) =>
    requestAnimationFrame(() => requestAnimationFrame(ok)));

/* --------------------------------------------------------------------------
   Render + ukur. Mengembalikan { doc, geo, sourceHtml, baseFs }:
   - doc        : dokumen DOMParser SUDAH bertanda, CSS masih ada — pemanggil
                  memakai dokumen ini untuk pindai (lalu membuang <style>
                  sendiri setelah selesai mengukur; kunci tidak bergeser).
   - geo        : Map tanda -> { x, y, w, h, disp, fw, fs }
   - sourceHtml : HTML bersih (tanpa skrip/penanda, CSS asli dipertahankan)
                  untuk panel "Wireframe check".
   - baseFs     : ukuran font dasar dokumen (patokan "judul lebih besar").
   Gagal merender (peramban tua, iframe diblokir) -> geo kosong; pipeline
   kembali ke heuristik markup lama, tidak ada yang rusak.
   -------------------------------------------------------------------------- */
export async function measureDocument(html, opts = {}) {
    const empty = { doc: null, geo: new Map(), sourceHtml: "", baseFs: 13 };
    let frame = null;
    try {
        const doc = parseDocument(html, { keepStyle: true });

        /* Pengaman: buang atribut kejadian (on*) dan URL javascript: yang tertinggal
           di markup lama. Pengukuran cukup memakai tata letak, bukan perilaku —
           dan iframe ukur memang tanpa izin skrip. */
        doc.querySelectorAll("*").forEach((el) => {
            [...el.attributes].forEach((a) => {
                if (/^on/i.test(a.name)) el.removeAttribute(a.name);
                else if (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value)) {
                    el.setAttribute(a.name, "#");
                }
            });
        });

        stampDoc(doc);
        const utuh = "<!doctype html><html>" + doc.documentElement.outerHTML + "</html>";
        const sourceHtml = stripMarks(utuh);

        frame = document.createElement("iframe");
        /* allow-same-origin agar rect bisa dibaca; skrip sudah dibuang sebelum
           dirender sehingga iframe benar-benar statis. */
        frame.setAttribute("sandbox", "allow-same-origin");
        frame.setAttribute("aria-hidden", "true");
        frame.title = "measurement";
        frame.style.cssText =
            "position:fixed;left:-99999px;top:0;width:794px;height:1400px;" +
            "border:0;visibility:hidden;pointer-events:none;";
        document.body.appendChild(frame);

        const loaded = new Promise((ok) => {
            frame.addEventListener("load", () => ok(), { once: true });
            setTimeout(ok, 4000);            // pengaman: jangan menggantung selamanya
        });
        frame.srcdoc = utuh;
        await loaded;
        await twoRafs();

        const content = frame.contentDocument;
        if (!content || !content.body) return empty;

        try { await content.fonts?.ready; } catch { /* peramban tanpa API fonts */ }

        const geo = new Map();
        content.querySelectorAll("*").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 1 && r.height < 1) return;     // display:none / kosong
            const cs = content.defaultView.getComputedStyle(el);
            const k = el.getAttribute(MARK_ATTR);
            if (!k) return;
            geo.set(k, {
                x: Math.round(r.left * 10) / 10,
                y: Math.round(r.top * 10) / 10,
                w: Math.round(r.width * 10) / 10,
                h: Math.round(r.height * 10) / 10,
                disp: cs.display,
                fw: parseInt(cs.fontWeight, 10) || 400,
                fs: parseFloat(cs.fontSize) || 13,
            });
        });
        if (!geo.size) return empty;

        /* Ukuran font dasar dokumen (modus) — patokan "judul lebih besar". */
        const freq = {};
        geo.forEach((g) => {
            if (g.w > 40 && g.h > 8 && g.h < 60) freq[g.fs] = (freq[g.fs] || 0) + 1;
        });
        const baseFs = Number(
            Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || 13,
        );

        return { doc, geo, sourceHtml, baseFs };
    } catch {
        return empty;
    } finally {
        if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
    }
}

/* --------------------------------------------------------------------------
   Clustering baris visual: anak-anak sebuah elemen dikelompokkan menurut
   tumpang tindih vertikalnya, lalu tiap kelompok diurutkan mendatar.
   Hasil: array baris, tiap baris = array elemen (urut kiri->kanan).
   -------------------------------------------------------------------------- */
export function visualLines(el, geo) {
    if (!geo || !geo.size || !el) return [];
    const children = [...el.children].filter((c) => {
        const k = markOf(c);
        const g = k ? geo.get(k) : null;
        return g && g.w > 0 && g.h > 0;
    });
    if (!children.length) return [];
    if (children.length === 1) return [children];

    const data = children
        .map((c) => ({ el: c, g: geo.get(markOf(c)) }))
        .sort((a, b) => (a.g.y - b.g.y) || (a.g.x - b.g.x));

    const lines = [];
    data.forEach(({ el: c, g }) => {
        const atas = g.y, bawah = g.y + g.h;
        const cocok = lines.find((b) => {
            const tumpuk = Math.min(b.bawah, bawah) - Math.max(b.atas, atas);
            return tumpuk > Math.min(b.high, g.h) * 0.55;
        });
        if (cocok) {
            cocok.item.push(c);
            cocok.atas = Math.min(cocok.atas, atas);
            cocok.bawah = Math.max(cocok.bawah, bawah);
            cocok.high = cocok.bawah - cocok.atas;
        } else {
            lines.push({ atas, bawah, high: g.h, item: [c] });
        }
    });

    return lines
        .sort((a, b) => a.atas - b.atas)
        .map((b) => b.item.sort((c1, c2) =>
            geo.get(markOf(c1)).x - geo.get(markOf(c2)).x));
}

/* Gabungan dua rect (dipakai saat sel label diserap ke sel isian). */
export function mergeRect(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { ...a, x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}
