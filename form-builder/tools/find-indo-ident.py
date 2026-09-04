"""Pindai sisa pengenal berbahasa Indonesia di src/ (kode saja — komentar dan
string diabaikan). Alat bantu refactor, bukan bagian dari aplikasi.
"""
import re
import sys
from pathlib import Path

STEMS = [
    "wadah", "kop(?!y)", "ttd", "teks", "nama", "nilai", "judul", "baris",
    "tabel", "gaya", "kelas", "pola", "opsi", "isi\b", "kiri", "kanan",
    "lebar\b", "wadah", "halaman", "punya", "angka", "rapik", "bersih",
    "hapus", "cari", "buat", "gabung", "pecah", "serap", "susun", "catat",
    "proses", "mulai", "pastikan", "penelusur", "ekstrak", "baca", "menimpa",
    "yakin", "tanda", "ukur", "dokumen", "kontrol", "sel\b", "ters\b",
    "sudah", "belum", "hilang", "diselamatkan", "selesai", "sering", "unik",
    "ketemu", "daerah", "dipakai", "anak", "dalam\b", "terpecah", "keluar",
    "dikenali", "sederhana", "pecahan", "utama\b", "peran", "kota", "blok\b",
    "masuk\b", "bagian", "jadwal", "wajib", "kosong", "penuh", "pertama",
    "kedua", "semua\b", "bertanda", "grup\b", "pilihan", "isian\b", "berkas",
    "muat", "simpan", "buka\b", "tutup", "ambil", "lihat", "isi\b",
]


def strip_comments_strings(src: str) -> str:
    out = []
    i, n = 0, len(src)
    while i < n:
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if ch == "/" and nxt == "/":
            j = src.find("\n", i)
            j = n if j == -1 else j
            i = j
            continue
        if ch == "/" and nxt == "*":
            j = src.find("*/", i)
            j = n if j == -1 else j + 2
            i = j
            continue
        if ch in ("'", '"'):
            q = ch
            j = i + 1
            while j < n and src[j] != q:
                j += 2 if src[j] == "\\" else 1
            i = j + 1
            continue
        out.append(ch)
        i += 1
    return "".join(out)


POLA = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\b")
for path in sys.argv[1:]:
    kode = strip_comments_strings(Path(path).read_text(encoding="utf-8"))
    ketemu = []
    for token in set(POLA.findall(kode)):
        kecil = token.lower()
        for stem in STEMS:
            if re.search(rf"{stem}", kecil) and kecil not in ("innerwidth",):
                ketemu.append(token)
                break
    if ketemu:
        print(path.split("/")[-1], "->", ", ".join(sorted(ketemu)))
