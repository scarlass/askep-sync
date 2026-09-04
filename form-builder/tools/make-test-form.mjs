/* Bangun formulir uji yang memakai SEMUA jenis komponen, dipakai skrip
   verifikasi Playwright. Jalankan: node tools/make-test-form.mjs           */
import { writeFileSync } from "node:fs";
import { CATALOG, makeForm, makeComponent, makeRow, makeSign } from "../src/model.js";

const form = makeForm();
form.meta.title = "FORMULIR UJI SELURUH KOMPONEN";
form.meta.docCode = "RM.9.9.9";

/* --- kop diubah dari nilai bawaan --- */
form.meta.header.hospitalName = "{RS_NAMA} — Unit Rawat Inap";
form.meta.header.addressLines = "{RS_ALAMAT}\nTelp. {RS_TELEPON} | Email {RS_EMAIL}";
form.meta.header.extraHtml = "Berlaku sejak 1 Januari 2026";
form.meta.header.ident.push({ key: "Ruang", type: "static", value: "{ROOM_NAME}" });
form.meta.header.ident.push({ key: "No. Register", type: "input", field: "no_register_kop",
                              width: "25mm" });
form.meta.header.ident.push({ key: "Tgl Masuk", type: "date", field: "tgl_masuk_kop" });
form.meta.header.ident.push({ key: "Tanda tangan penerima", type: "blank" });
form.meta.header.ident.push({ key: "Keluhan utama", type: "input", field: "keluhan_kop",
                              width: "100%" });
form.meta.header.ident.push({ key: "Terlalu lebar", type: "input", field: "lebar_kop",
                              width: "90mm" });
form.meta.header.ident.push({ key: "Kelas", type: "options", field: "kelas_kop",
                             options: ["I", "II", "III"], full: true });

/* --- kop dua sisi dengan lebar & penempatan khusus --- */
form.meta.header.split = true;
form.meta.header.leftWidth = "60%";
form.meta.header.rightWidth = "40%";
form.meta.header.logoWidth = "22mm";
form.meta.header.titleSide = "kanan";      // judul pindah ke sisi kanan
form.meta.header.identSide = "kanan";
form.meta.header.leftAlign = "kiri";
form.meta.header.rightAlign = "kanan";
form.meta.header.divider = true;

/* --- ukuran kotak identitas diatur sendiri --- */
form.meta.header.identWidth = "80%";
form.meta.header.identAlign = "kanan";
form.meta.header.identValueWidth = "34mm";
form.meta.header.identFontSize = "9pt";

/* --- footer dengan TIGA tanda tangan --- */
form.meta.footer.align = "rata";
form.meta.footer.note = "Formulir wajib diisi lengkap dalam 24 jam.";
form.meta.footer.showPrintDate = true;
form.meta.footer.signs = [
  { ...makeSign("Perawat Penanggung Jawab"), side: "kanan" },
  { ...makeSign("Dokter DPJP"), withSelect: true, selectField: "dokter_dpjp", side: "kanan" },
  { ...makeSign("Pasien / Keluarga"), withPentablet: false, withDate: false, side: "kiri" },
];

/* --- footer dua sisi: pasien di kiri, petugas di kanan --- */
form.meta.footer.split = true;
form.meta.footer.leftWidth = "40%";
form.meta.footer.rightWidth = "60%";
form.meta.footer.noteSide = "kiri";

/* --- satu section berisi semua komponen, satu baris per komponen --- */
const rows = CATALOG.map((def, i) => {
  const c = makeComponent(def.type);
  if (c.field !== undefined) c.field = `uji_${def.type}`;
  if (def.type === "daterange") c.fieldTo = "uji_daterange_akhir";
  if (def.type === "signature") c.parafIndex = 90 + i;   // jauh dari footer
  if (def.type === "image") c.src = "logo.png";
  const r = makeRow(1);
  r.cells = [c];
  return r;
});

/* --- baris uji lebar & tata letak --- */
const kv = makeComponent("date");
Object.assign(kv, { label: "Tanggal Lahir", field: "tgl_lahir_kv",
                    layout: "samping", labelWidth: "35%", width: "50%" });
const persen = makeComponent("text");
Object.assign(persen, { label: "Lebar 60 persen", field: "lebar_persen", width: "60%" });
const mm = makeComponent("text");
Object.assign(mm, { label: "Lebar 40mm", field: "lebar_mm", width: "40mm" });

const barisLebar = makeRow(2);
barisLebar.cells = [persen, mm];
barisLebar.widths = "30% 70%";

const barisKv = makeRow(1);
barisKv.cells = [kv];

/* --- baris 6 kolom + sel yang melebar (span) --- */
const enam = makeRow(6);
enam.cells = Array.from({ length: 6 }, (_, i) => {
  const c = makeComponent("text");
  Object.assign(c, { label: `Kolom ${i + 1}`, field: `enam_${i + 1}` });
  return c;
});

const spanRow = makeRow(3);
const lebarSpan = makeComponent("textarea");
Object.assign(lebarSpan, { label: "Melebar 2 kolom", field: "span_dua", span: 2 });
const sisa = makeComponent("text");
Object.assign(sisa, { label: "Sisa", field: "span_sisa" });
spanRow.cells = [lebarSpan, sisa, null];

/* --- paging: tiga halaman --- */
form.meta.paging.enabled = true;
form.meta.paging.printAll = true;

form.sections = [
  { id: "s_semua", title: "Semua Komponen", page: 1, rows },
  { id: "s_lebar", title: "Uji Lebar & Tata Letak", page: 2, rows: [barisLebar, barisKv] },
  { id: "s_kolom", title: "Uji Kolom Fleksibel", page: 2, rows: [enam, spanRow] },
  { id: "s_akhir", title: "Halaman Terakhir", page: 3, rows: [rowSatu()] },
];

function rowSatu() {
  const r = makeRow(1);
  const c = makeComponent("textarea");
  Object.assign(c, { label: "Catatan Penutup", field: "catatan_penutup", rows: 4 });
  r.cells = [c];
  return r;
}

writeFileSync(new URL("../tools/test-form.json", import.meta.url),
              JSON.stringify(form, null, 2), "utf8");
console.log("komponen:", CATALOG.length, "baris:", rows.length + 5, "halaman: 3");
