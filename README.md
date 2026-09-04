# Askep Sync

CLI + web builder untuk mengedit formulir askep (asuhan keperawatan) yang
tersimpan di tabel `askep_list` — tanpa perlu menulis SQL atau mengedit HTML
secara manual.

- **CLI** (`askep init` / `askep sync` / `askep serve`) membaca satu berkas
  konfigurasi (`askep.config.yaml`) yang memetakan setiap **target** (satu
  jenis formulir) ke baris `askep_list` per **profile** koneksi database.
- **`askep serve`** menyalakan web UI (form builder) yang sama sekali tidak
  perlu dijalankan terpisah — biner Go-nya sudah menyertakan frontend hasil
  build (`form-builder/dist`) lewat `//go:embed`.

---

## Instalasi

### Prasyarat

| Kebutuhan | Versi | Guna |
|---|---|---|
| Go | 1.26+ | membangun/menjalankan CLI |
| Node.js + pnpm | Node 18+ | hanya dibutuhkan untuk **membangun ulang** frontend (`form-builder/dist`) |
| PostgreSQL | — | database `askep_list` yang dituju, harus bisa dijangkau dari mesin yang menjalankan `sync`/`serve` |

> [!IMPORTANT]
> `main.go` meng-*embed* folder `form-builder/dist` (`//go:embed form-builder/dist`).
> Folder itu **tidak disertakan di git** (lihat `.gitignore`) dan harus sudah
> ada di disk **sebelum** `go build`/`go run` dijalankan, kalau tidak proses
> build Go akan gagal.

### Build dari sumber

```bash
git clone <repo-ini>
cd askep-sync

# 1. bangun frontend (hasilnya masuk ke form-builder/dist)
just build
# setara dengan:
#   cd form-builder && pnpm install && pnpm run build

# 2. bangun biner askep (menyertakan dist/ dari langkah 1)
go build -o askep .
```

Setelah itu binernya berdiri sendiri (`./askep`) — bisa dipindah ke mesin lain
tanpa perlu Node.js/pnpm lagi, karena frontend sudah ikut ter-*embed*.

---

## Daftar command

### `askep init`

Membuat `askep.config.yaml` di direktori kerja saat ini dari template bawaan.
Tidak melakukan apa-apa (hanya memberi peringatan) kalau berkas itu sudah ada.

```bash
askep init
```

### `askep sync <target...> [flags]`

Merender HTML target lalu menulisnya ke kolom `form_data` (dan atribut terkait)
pada baris `askep_list` yang dipetakan lewat `alids` target tersebut, untuk
satu database `profile`. Bisa menerima lebih dari satu nama target sekaligus
(disinkronkan paralel).

```bash
askep sync imunisasi                 # sync ke profile "default"
askep sync imunisasi test -p master  # sync dua target ke profile "master"
askep sync imunisasi --dry           # cetak HTML hasil compile, tanpa sentuh DB
```

| Flag | Alias | Bawaan | Keterangan |
|---|---|---|---|
| `--profile` | `-p` | `default` | nama connection profile yang dipakai (harus ada di `profiles:`) |
| `--dry` | `-d` | `false` | tidak menulis ke database — hanya mencetak HTML gabungan (stylesheet+script) ke stdout. Hanya boleh dipakai dengan **satu** target |

Konfigurasi (`askep.config.yaml`) dicari otomatis mulai dari direktori kerja
saat ini, naik ke direktori induk, sampai ditemukan `askep.config.yaml` (atau
`askep.config.yml`).

### `askep serve [flags]`

Menjalankan HTTP server yang menyediakan API + web form builder (lihat bagian
[Web builder](#web-builder-form-builder) di bawah) untuk project di direktori
kerja saat ini.

```bash
askep serve                  # 0.0.0.0:5180 (atau ikut server.host/port di config)
askep serve -H 127.0.0.1 -p 8080
```

| Flag | Alias | Bawaan | Keterangan |
|---|---|---|---|
| `--host` | `-H` | `0.0.0.0` (atau `server.host` di config) | alamat bind |
| `--port` | `-p` | `5180` (atau `server.port` di config) | port bind |

---

## Konfigurasi (`askep.config.yaml`)

```yaml
profiles:
  default:
    host: localhost
    port: 5432
    user: postgres
    password: postgres
    database: db_teramedik_master
    schema: public
    # proxy:            # opsional, tunnel SSH ke database
    #   host: 192.168.0.13
    #   port: 22
    #   user: <changeme>
    #   password: <changeme>

targets:
  imunisasi:
    html: builder://<uuid>       # dikelola form builder, lihat di bawah
    alids:
      default: 123                # askep_list.alid untuk profile "default"
  test:
    html: test/index.html         # atau: path statis ke berkas .html
    script: test/index.js         # opsional, disisipkan sebagai <script>
    stylesheet: test/index.css    # opsional, disisipkan sebagai <style>
    attributes:
      nama-form: SATUSEHAT - INTRANATAL CARE (INC)
      inisial-form: SS_INC
      kode-form: SATUSEHAT_INC
      kode-satusehat: INTRANATALCARE   # ikut set is_satusehat=true di DB
    alids:
      default: 850
      master: 850
```

- Setiap field koneksi di `profiles.<nama>` bisa ditimpa lewat env var
  `PROFILE_<NAMA-UPPERCASE>_<FIELD>` (mis. `PROFILE_DEFAULT_HOST=...`),
  dibaca juga dari berkas `.env` di direktori yang sama.
- `targets.<nama>.html` bisa berupa **path statis** ke berkas `.html`
  (opsional dilengkapi `script`/`stylesheet`), atau skema **`builder://<uuid>`**
  — target yang dikelola sepenuhnya lewat web builder (lihat berikutnya).
- `alids` memetakan **nama profile → `askep_list.alid`**: baris mana yang
  diperbarui `askep sync`, per koneksi database.

---

## Web builder (`form-builder/`)

Antarmuka visual untuk menyusun isi satu target — komponen, kop/footer,
paging, dan seterusnya — **tidak banyak berubah** dari sebelumnya; dokumentasi
lengkapnya (daftar komponen, alur impor HTML lama, dsb) ada di
**[`form-builder/README.md`](form-builder/README.md)**.

Yang baru di sisi ini adalah **integrasi dengan `askep serve`** — sebelumnya
builder murni jalan di browser (localStorage), sekarang setiap target
tersambung ke server:

| Fitur | Ringkas |
|---|---|
| Daftar target | popup di kiri atas menampilkan semua `targets` dari `askep.config.yaml`, termasuk pilihan **+ New Form** untuk menambah target baru (selalu `builder://`, tidak bisa memilih berkas statis) |
| Mode builder vs pratinjau statis | target `builder://<uuid>` dibuka sebagai editor penuh; target berkas statis dibuka sebagai pratinjau kertas **read-only**, dengan tombol untuk mulai mengelolanya lewat builder |
| Penyimpanan | metadata (JSON) + HTML hasil compile disimpan otomatis (autosave) ke `.askep/templates/<uuid>.{json,html}` di project, bukan lagi `localStorage` browser |
| Attributes | tombol di sebelah judul formulir untuk mengisi `nama-form` / `inisial-form` / `kode-form` / `kode-satusehat` — tersimpan langsung ke `askep.config.yaml` |
| Sync | tombol **⇄ Sync** membuka dialog berisi semua database profile + input `alid` per baris (terisi otomatis kalau sudah dipetakan) — mengisi/mengubah `alid` di sini otomatis tersimpan ke config, lalu langsung menjalankan hal yang sama seperti `askep sync <target> -p <profile>` |
| Blok buatan sendiri | kini disimpan global (`~/.config/askep-builder/blocks.json`), bisa dipakai lintas project — bukan lagi per-browser |

> [!NOTE]
> Menulis lewat form builder (autosave, attributes, sync) menulis ulang
> seluruh `askep.config.yaml` lewat `yaml.Marshal` — komentar manual di berkas
> itu (seperti contoh di atas) akan hilang begitu target pertama kali disimpan
> lewat builder.

---

## Pengembangan

```bash
just fe      # Vite dev server (frontend saja), http://localhost:5173, proxy /api -> :5180
just serve   # go run -tags dev . serve — hanya API, frontend dilayani just fe di atas
just build   # build ulang form-builder/dist (dibutuhkan sebelum `go build` produksi)
just install # build dan install form-builder dan cli ke GOBIN
```

Build tag `dev` mematikan static-file serving di sisi Go (`internal/api/gui_dev.go`)
karena di mode pengembangan frontend dilayani terpisah oleh Vite; build tanpa
tag itu (`go build .`, dipakai untuk rilis) melayani `form-builder/dist` yang
ter-*embed* langsung di `/` (`internal/api/gui.go`).
