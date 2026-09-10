import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    CATALOG, GROUPS, PRESETS, MAX_COLS, catalogOf,
    makeComponent, makeRow, makeSection, makeForm, normalise, normaliseOption, uid, nextParafIndex, duplicateRow,
    sectionToBlock, blockToSection,
} from "./model.js";
import {
    listProfiles, listTargets, createTarget, getTargetMetadata, saveTargetMetadata, saveTargetAttributes,
    previewTargetHtml, syncTarget, getBlocks, saveBlocks,
    listTargetScripts, createTargetScript, getTargetScriptContent, saveTargetScriptContent, deleteTargetScript,
} from "../api/client.js";
import { generateHtml, generatePreview, summarise } from "./generate.js";
import Inspector from "./Inspector.jsx";
import ImportPanel from "./ImportPanel.jsx";
import { scanHtml } from "./import/build.js";
import { extractEmbeddedModel } from "./import/read.js";
import { Editor } from "@monaco-editor/react";

/* ==========================================================================
   App.jsx — kerangka builder: palet · kanvas · inspektur · pratinjau
   Teks antarmuka: bahasa Inggris. Komentar kode: bahasa Indonesia.
   ========================================================================== */

const ZOOMS = [0.5, 0.65, 0.8, 1, 1.25, 1.5];

export default function App() {
    /* TARGET: form yang diedit selalu terikat ke salah satu target di
       askep.config.yaml — bukan lagi draft anonim. */
    const [targets, setTargets] = useState([]);
    const [activeTarget, setActiveTarget] = useState("");
    const [loaded, setLoaded] = useState(false);   // metadata target sudah selesai dimuat dari server?
    const [loadNote, setLoadNote] = useState(null); // "restored" | "new" | null

    /* target dengan html: builder://<uuid> dikelola form-builder; selain itu
       cuma pratinjau HTML read-only di atas kertas. forcedBuilder menyimpan
       target yang baru diaktifkan builder-nya sesi ini, sebelum simpanan
       pertama membuatnya benar-benar builder-backed di server. */
    const [forcedBuilder, setForcedBuilder] = useState(() => new Set());
    const activeInfo = targets.find((t) => t.name === activeTarget);
    const isBuilderMode = !!(activeInfo?.isBuilder || forcedBuilder.has(activeTarget));
    const [previewHtml, setPreviewHtml] = useState("");
    const [previewLoading, setPreviewLoading] = useState(false);

    /* Sync: kirim HTML target ke database profile — dialog menampilkan SEMUA
       profile yang ada di askep.config.yaml (bukan cuma yang sudah punya
       alid), dengan input alid per baris supaya mapping baru bisa diisi
       langsung dari view, bukan cuma lewat CLI/hand-edit yaml. */
    const [allProfiles, setAllProfiles] = useState([]);
    const targetAlids = activeInfo?.alids || {};
    const [syncProfile, setSyncProfile] = useState("");
    const [alidDraft, setAlidDraft] = useState({}); // { [profileName]: string }
    const [syncing, setSyncing] = useState(false);
    const [syncModalOpen, setSyncModalOpen] = useState(false);

    /* Attributes: nama-form / inisial-form / kode-form / kode-satusehat —
       ditulis ke UPDATE askep_list lewat Profile.Update saat sync. */
    const [attrModalOpen, setAttrModalOpen] = useState(false);
    const [attrDraft, setAttrDraft] = useState({
        namaForm: "", inisialForm: "", kodeForm: "", kodeSatusehat: "",
    });
    const [savingAttrs, setSavingAttrs] = useState(false);

    const [form, setForm] = useState(makeForm);
    const [sel, setSel] = useState(null);        // {sec, row, cell} | {sec} | null
    const [showPreview, setShowPreview] = useState(true);
    const [tab, setTab] = useState("preview");   // preview | html | script

    /* tab Script: daftar file .js per template (builder-managed di
       .askep/<uuid>/*.js, ditambah entri manual dari yaml `script:`),
       diedit lewat editor bawaan. */
    const [scripts, setScripts] = useState([]);            // [{id, name, source}]
    const [scriptContents, setScriptContents] = useState({}); // {[id]: content}
    const [activeScriptId, setActiveScriptId] = useState(null);
    const [scriptSaving, setScriptSaving] = useState(false);
    const [search, setSearch] = useState("");        // pencarian komponen di palet
    const [blocks, setBlocks] = useState([]);
    const [modal, setModal] = useState(false);   // pratinjau layar penuh
    const [zoom, setZoom] = useState(1);
    const [sheet, setSheet] = useState("210mm"); // lebar kertas pada pratinjau penuh
    const [jump, setJump] = useState(null);      // {ke:"header"|"footer", n} lompat ke grup
    const [scan, setScan] = useState(null);      // hasil pindaian berkas HTML lama
    const [scanName, setScanName] = useState("");
    const [importInfo, setImportInfo] = useState(null);   // ringkasan setelah impor
    const [menuOpen, setMenuOpen] = useState(false);   // dropdown menu (Import/Open/Save/dst) di topbar
    const [targetMenuOpen, setTargetMenuOpen] = useState(false);   // popup pindah/buat target
    const htmlRef = useRef(null);
    const fileRef = useRef(null);
    const blockFileRef = useRef(null);
    const modalFrame = useRef(null);
    const sideBox = useRef(null);
    const menuRef = useRef(null);
    const targetMenuRef = useRef(null);
    const [sideScale, setSideScale] = useState(1);
    const [editorFontSize, setEditorFontSize] = useState(12);

    const stat = useMemo(() => summarise(form), [form]);
    /* Huruf A. B. C. harus sama dengan urutan yang DIHASILKAN generator:
       halaman dulu, baru urutan di dalam array. */
    const letters = useMemo(() => {
        const usesPaging = !!form.meta.paging?.enabled;
        const urut = form.sections.map((s, i) => ({ i, p: Number(s.page) || 1 }))
            .sort((a, b) => (usesPaging ? a.p - b.p : 0) || a.i - b.i)
            .map((x) => x.i);
        const peta = {};
        urut.forEach((idx, n) => { peta[idx] = String.fromCharCode(65 + n); });
        return peta;
    }, [form.sections, form.meta.paging?.enabled]);
    const html = useMemo(() => generateHtml(form), [form]);
    const preview = useMemo(() => generatePreview(form, Object.values(scriptContents)), [form, scriptContents]);
    const paging = form.meta.paging || {};

    /* Pratinjau samping selalu dirender selebar 860px lalu DIPERKECIL, supaya
       tampilannya sama dengan hasil cetak — bukan versi layar sempit. */
    useEffect(() => {
        const el = sideBox.current;
        if (!el || !showPreview) return undefined;
        const hitung = () => setSideScale(Math.min(1, (el.clientWidth - 8) / 860));
        hitung();
        const ro = new ResizeObserver(hitung);
        ro.observe(el);
        return () => ro.disconnect();
    }, [showPreview, tab, isBuilderMode]);

    /* Esc menutup pratinjau layar penuh */
    useEffect(() => {
        if (!modal) return undefined;
        const onKey = (e) => { if (e.key === "Escape") setModal(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [modal]);

    /* Esc menutup dialog Sync (kecuali sedang proses) */
    useEffect(() => {
        if (!syncModalOpen) return undefined;
        const onKey = (e) => { if (e.key === "Escape" && !syncing) setSyncModalOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [syncModalOpen, syncing]);

    /* Esc menutup dialog Attributes (kecuali sedang proses) */
    useEffect(() => {
        if (!attrModalOpen) return undefined;
        const onKey = (e) => { if (e.key === "Escape" && !savingAttrs) setAttrModalOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [attrModalOpen, savingAttrs]);

    /* klik di luar / Esc menutup dropdown menu topbar */
    useEffect(() => {
        if (!menuOpen) return undefined;
        const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
        window.addEventListener("mousedown", onClick);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onClick);
            window.removeEventListener("keydown", onKey);
        };
    }, [menuOpen]);

    /* klik di luar / Esc menutup popup pindah/buat target */
    useEffect(() => {
        if (!targetMenuOpen) return undefined;
        const onClick = (e) => {
            if (targetMenuRef.current && !targetMenuRef.current.contains(e.target)) setTargetMenuOpen(false);
        };
        const onKey = (e) => { if (e.key === "Escape") setTargetMenuOpen(false); };
        window.addEventListener("mousedown", onClick);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onClick);
            window.removeEventListener("keydown", onKey);
        };
    }, [targetMenuOpen]);

    /* saat popup dibuka, pindahkan fokus ke item pertama supaya panah/Enter
       langsung bisa dipakai tanpa Tab dulu */
    useEffect(() => {
        if (!targetMenuOpen) return undefined;
        const id = requestAnimationFrame(() => {
            targetMenuRef.current?.querySelector(".menu-list button")?.focus();
        });
        return () => cancelAnimationFrame(id);
    }, [targetMenuOpen]);
    useEffect(() => {
        if (!menuOpen) return undefined;
        const id = requestAnimationFrame(() => {
            menuRef.current?.querySelector(".menu-list button")?.focus();
        });
        return () => cancelAnimationFrame(id);
    }, [menuOpen]);

    /* navigasi panah/Home/End di dalam popup menu (dipakai kedua dropdown) */
    const onMenuKeyDown = (e) => {
        const items = Array.from(e.currentTarget.querySelectorAll("button:not(:disabled)"));
        if (!items.length) return;
        const i = items.indexOf(document.activeElement);
        if (e.key === "ArrowDown") {
            e.preventDefault();
            items[i < 0 ? 0 : (i + 1) % items.length].focus();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            items[i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length].focus();
        } else if (e.key === "Home") {
            e.preventDefault();
            items[0].focus();
        } else if (e.key === "End") {
            e.preventDefault();
            items[items.length - 1].focus();
        }
    };

    /* daftar target dari askep.config.yaml — dipilih otomatis yang pertama */
    useEffect(() => {
        listTargets().then((list) => {
            setTargets(list);
            if (list.length) setActiveTarget((cur) => cur || list[0].name);
        });
    }, []);

    /* blok buatan sendiri kini tersimpan global di server, bukan per-browser */
    useEffect(() => { getBlocks().then(setBlocks); }, []);

    /* semua profile database yang dikenal project — dipakai dialog Sync */
    useEffect(() => { listProfiles().then(setAllProfiles); }, []);

    /* target non-builder: cuma ambil pratinjau HTML read-only, bukan model builder */
    useEffect(() => {
        if (!activeTarget || isBuilderMode) return undefined;
        let cancelled = false;
        setLoaded(false);
        setPreviewLoading(true);
        previewTargetHtml(activeTarget)
            .then((h) => { if (!cancelled) setPreviewHtml(h); })
            .catch(() => { if (!cancelled) setPreviewHtml("<p style='padding:20px;font:14px sans-serif'>Failed to load preview.</p>"); })
            .finally(() => { if (!cancelled) setPreviewLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTarget, isBuilderMode]);

    /* target builder: muat metadata form tersimpan tiap kali target aktif berganti
       atau baru saja diaktifkan lewat "Start building with Form Builder" */
    useEffect(() => {
        if (!activeTarget || !isBuilderMode) return undefined;
        let cancelled = false;
        setLoaded(false);
        getTargetMetadata(activeTarget).then((data) => {
            if (cancelled) return;
            if (data) {
                setForm(normalise(data));
                setLoadNote("restored");
            } else {
                setForm(makeForm());
                setLoadNote("new");
            }
            setSel(null);
            setLoaded(true);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTarget, forcedBuilder]);

    /* tab Script: id skrip = indeks di target.script (config), jadi
       berubah tiap kali ada tambah/hapus — selalu muat ulang daftar+isi dari
       server sesudah mutasi apa pun, jangan tempel/hapus lokal berdasar id
       lama yang bisa sudah tidak berlaku. */
    const reloadScripts = async (target, preferId, isCancelled = () => false) => {
        const list = await listTargetScripts(target);
        if (isCancelled()) return;
        setScripts(list);
        setActiveScriptId((cur) => {
            const want = preferId !== undefined ? preferId : cur;
            return list.some((s) => s.id === want) ? want : (list[0]?.id ?? null);
        });
        const entries = await Promise.all(list.map(async (s) =>
            [s.id, await getTargetScriptContent(target, s.id).catch(() => "")]));
        if (isCancelled()) return;
        setScriptContents(Object.fromEntries(entries));
    };

    useEffect(() => {
        if (!activeTarget || !isBuilderMode) {
            setScripts([]);
            setScriptContents({});
            setActiveScriptId(null);
            return undefined;
        }
        let cancelled = false;
        reloadScripts(activeTarget, undefined, () => cancelled);
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTarget, isBuilderMode, forcedBuilder]);

    /* askep.config.yaml sekarang bisa berubah di luar app (server watch pakai
       fsnotify — lihat internal/core/watch.go) — mis. user hapus baris script
       manual langsung di yaml sementara server jalan. Tab Script tidak tahu
       ini terjadi kecuali di-poll: selama tab Script aktif, cek ulang daftar
       tiap beberapa detik. Isi script yang SEDANG dibuka tidak ikut ditimpa
       supaya tidak menghapus draf yang belum sempat autosave. */
    const activeScriptIdRef = useRef(activeScriptId);
    useEffect(() => { activeScriptIdRef.current = activeScriptId; }, [activeScriptId]);

    useEffect(() => {
        if (tab !== "script" || !activeTarget || !isBuilderMode) return undefined;
        let cancelled = false;
        const tick = async () => {
            try {
                const list = await listTargetScripts(activeTarget);
                if (cancelled) return;
                const activeId = activeScriptIdRef.current;
                setScripts(list);
                setActiveScriptId((cur) => (list.some((s) => s.id === cur) ? cur : (list[0]?.id ?? null)));
                const entries = await Promise.all(
                    list.filter((s) => s.id !== activeId).map(async (s) =>
                        [s.id, await getTargetScriptContent(activeTarget, s.id).catch(() => "")])
                );
                if (cancelled) return;
                setScriptContents((prev) => {
                    const next = Object.fromEntries(entries);
                    if (activeId && activeId in prev) next[activeId] = prev[activeId];
                    return next;
                });
            } catch { /* transient poll error, ignore */ }
        };
        const id = setInterval(tick, 3000);
        return () => { cancelled = true; clearInterval(id); };
    }, [tab, activeTarget, isBuilderMode]);

    const addScript = async () => {
        if (!activeTarget) return;
        const name = window.prompt("Script file name (e.g. custom.js):");
        if (!name) return;
        try {
            const created = await createTargetScript(activeTarget, name);
            await reloadScripts(activeTarget, created.id);
        } catch (err) { window.alert("Cannot create script: " + err.message); }
    };

    const removeScript = async (id) => {
        if (!activeTarget || !window.confirm("Delete this script?")) return;
        try {
            await deleteTargetScript(activeTarget, id);
            await reloadScripts(activeTarget, null);
        } catch (err) { window.alert("Cannot delete script: " + err.message); }
    };

    /* Script tab: autosave 5s setelah berhenti mengetik, atau langsung lewat
       Ctrl/Cmd+S. scriptSaveTimer menyimpan debounce yang sedang berjalan
       supaya bisa di-flush (disimpan segera) saat pindah script/Ctrl+S. */
    const scriptSaveTimer = useRef(null);
    const flushScriptSave = () => {
        if (scriptSaveTimer.current) {
            clearTimeout(scriptSaveTimer.current);
            scriptSaveTimer.current = null;
        }
    };
    const doSaveScript = async (target, id, content) => {
        if (!target || !id) return;
        setScriptSaving(true);
        try {
            await saveTargetScriptContent(target, id, content ?? "");
        } catch (err) { window.alert("Cannot save script: " + err.message); }
        finally { setScriptSaving(false); }
    };
    const scheduleScriptSave = (target, id, content) => {
        flushScriptSave();
        scriptSaveTimer.current = setTimeout(() => {
            scriptSaveTimer.current = null;
            doSaveScript(target, id, content);
        }, 5000);
    };
    const switchScript = (id) => {
        if (activeScriptId && activeScriptId !== id && scriptSaveTimer.current) {
            flushScriptSave();
            doSaveScript(activeTarget, activeScriptId, scriptContents[activeScriptId] ?? "");
        }
        setActiveScriptId(id);
    };

    /* target baru dari view selalu builder-backed — tidak ada pemilih berkas
       html statis seperti target yang sudah ada di askep.config.yaml */
    const newTarget = async () => {
        const name = window.prompt("New target name (used as the key in askep.config.yaml):");
        if (!name) return;
        try {
            const created = await createTarget(name.trim());
            setTargets((ts) => [...ts, created].sort((a, b) => a.name.localeCompare(b.name)));
            setActiveTarget(created.name);
        } catch (err) {
            window.alert("Cannot create target: " + err.message);
        }
    };

    /* Sync: tulis HTML target saat ini ke askep_list lewat profile database
       terpilih — sama seperti `askep sync <target> -p <profile>`. Dialog
       menampilkan semua profile yang ada, dengan input alid per baris
       (terisi otomatis kalau sudah dipetakan di askep.config.yaml). Alid yang
       baru/berubah otomatis disimpan ke config oleh backend saat sync. */
    const openSyncDialog = () => {
        if (!activeTarget) return;
        if (!allProfiles.length) {
            window.alert("No database profiles are configured in askep.config.yaml.");
            return;
        }
        setAlidDraft(Object.fromEntries(
            allProfiles.map((p) => [p, targetAlids[p] != null ? String(targetAlids[p]) : ""]),
        ));
        setSyncProfile(allProfiles.find((p) => targetAlids[p] != null) || allProfiles[0]);
        setSyncModalOpen(true);
    };
    const syncAlidValue = Number(alidDraft[syncProfile]);
    const syncAlidValid = Number.isInteger(syncAlidValue) && syncAlidValue > 0;
    const runSync = async () => {
        if (!syncProfile || !syncAlidValid) return;
        setSyncing(true);
        try {
            if (isBuilderMode) {
                await saveTargetMetadata(activeTarget, { metadata: form, html });
            }
            const res = await syncTarget(activeTarget, syncProfile, syncAlidValue);
            setSyncModalOpen(false);
            setTargets((ts) => ts.map((t) => (t.name === activeTarget
                ? { ...t, alids: { ...t.alids, [syncProfile]: syncAlidValue } }
                : t)));
            window.alert(`Synced "${activeTarget}" to profile "${syncProfile}" (alid ${res.alid}).`);
        } catch (err) {
            window.alert("Sync failed: " + err.message);
        } finally {
            setSyncing(false);
        }
    };

    /* Attributes: nama-form / inisial-form / kode-form / kode-satusehat —
       diisi lewat dialog di sebelah input judul form, disimpan langsung ke
       askep.config.yaml (target ini) tanpa perlu edit yaml manual. */
    const openAttrDialog = () => {
        const a = activeInfo?.attributes || {};
        setAttrDraft({
            namaForm: a.namaForm || "",
            inisialForm: a.inisialForm || "",
            kodeForm: a.kodeForm || "",
            kodeSatusehat: a.kodeSatusehat || "",
        });
        setAttrModalOpen(true);
    };
    const saveAttrs = async () => {
        setSavingAttrs(true);
        try {
            const saved = await saveTargetAttributes(activeTarget, attrDraft);
            setTargets((ts) => ts.map((t) => (t.name === activeTarget ? { ...t, attributes: saved } : t)));
            setAttrModalOpen(false);
        } catch (err) {
            window.alert("Cannot save attributes: " + err.message);
        } finally {
            setSavingAttrs(false);
        }
    };

    /* ---------------- util pembaruan ---------------- */
    const update = (fn) => setForm((f) => {
        const draft = JSON.parse(JSON.stringify(f));
        fn(draft);
        return draft;
    });

    /* simpan ke server tiap perubahan (debounced, best-effort) */
    useEffect(() => {
        if (!loaded || !activeTarget || !isBuilderMode) return undefined;
        const targetName = activeTarget;
        const t = setTimeout(() => {
            saveTargetMetadata(targetName, { metadata: form, html }).then((res) => {
                if (!res?.templateId) return;
                /* penyimpanan pertama: tandai target ini builder-backed di daftar lokal */
                setTargets((ts) => ts.map((x) => (
                    x.name === targetName && !x.isBuilder
                        ? { ...x, isBuilder: true, templateId: res.templateId }
                        : x
                )));
            }).catch(() => { /* offline/gagal: abaikan */ });
        }, 700);
        return () => clearTimeout(t);
    }, [form, html, loaded, activeTarget, isBuilderMode]);

    const secAt = (d, i) => d.sections[i];
    const rowAt = (d, s, r) => d.sections[s].rows[r];

    /* ---------------- section & halaman ---------------- */
    const addSection = (page = 1) => update((d) => {
        d.sections.push(makeSection("New section", page));
    });
    const delSection = (i) => update((d) => {
        d.sections.splice(i, 1);
        if (!d.sections.length) d.sections.push(makeSection("New section", 1));
    });
    const moveSection = (i, dir) => update((d) => {
        const j = i + dir;
        if (j < 0 || j >= d.sections.length) return;
        [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]];
    });
    const setSectionPage = (i, page) => update((d) => {
        d.sections[i].page = Math.max(1, page);
    });
    const pageCount = paging.enabled
        ? Math.max(1, ...form.sections.map((s) => Number(s.page) || 1)) : 1;
    const addPage = () => update((d) => {
        const n = Math.max(1, ...d.sections.map((s) => Number(s.page) || 1)) + 1;
        d.sections.push(makeSection(`Page ${n}`, n));
    });

    /* ---------------- baris ---------------- */
    const addRow = (s, cols) => update((d) => { secAt(d, s).rows.push(makeRow(cols)); });
    const delRow = (s, r) => update((d) => { secAt(d, s).rows.splice(r, 1); });
    const moveRow = (s, r, dir) => update((d) => {
        const rows = secAt(d, s).rows, j = r + dir;
        if (j < 0 || j >= rows.length) return;
        [rows[r], rows[j]] = [rows[j], rows[r]];
    });
    const setCols = (s, r, cols) => update((d) => {
        const row = rowAt(d, s, r);
        const n = Math.min(Math.max(cols, 1), MAX_COLS);
        const old = row.cells;
        row.cols = n;
        row.cells = Array.from({ length: n }, (_, i) => old[i] || null);
        row.cells.forEach((c) => { if (c && c.span > n) c.span = n; });
    });
    const setWidths = (s, r, v) => update((d) => { rowAt(d, s, r).widths = v; });

    /* ---------------- komponen ---------------- */
    const addComponent = (type) => {
        if (!sel) return;
        update((d) => {
            const { sec, row, cell } = sel;
            const baru = makeComponent(type);
            // nomor paraf harus unik supaya id `paraf_N` tidak bentrok dengan footer
            if (type === "signature") baru.parafIndex = nextParafIndex(d);
            if (row == null) {                       // belum ada sel dipilih -> baris baru
                const nr = makeRow(1);
                nr.cells[0] = baru;
                secAt(d, sec).rows.push(nr);
            } else {
                rowAt(d, sec, row).cells[cell] = baru;
            }
        });
    };
    const patchComponent = (patch) => update((d) => {
        const { sec, row, cell } = sel;
        Object.assign(rowAt(d, sec, row).cells[cell], patch);
    });
    const clearCell = () => update((d) => {
        const { sec, row, cell } = sel;
        rowAt(d, sec, row).cells[cell] = null;
    });

    /* ---------------- blok siap pakai ---------------- */
    const insertBlock = (block, page = 1) => update((d) => {
        block.rows.forEach((r) => r.cells.forEach((c) => {
            if (c && c.type === "signature") c.parafIndex = nextParafIndex(d);
            if (c && (c.type === "checkbox" || c.type === "radio" || c.type === "select" || c.type === "kv")) {
                c.options = (c.options || []).map(normaliseOption);
            }
        }));
        d.sections.push({
            id: block.id || uid("s"), title: block.title,
            page: block.page || page, rows: block.rows
        });
    });

    const addPreset = (key) => {
        const p = PRESETS.find((x) => x.key === key);
        if (p) insertBlock(p.build(), pageCount);
    };

    /* ---------------- blok buatan sendiri (server, global lintas proyek) ---------------- */
    const updateBlocks = (list) => { setBlocks(list); saveBlocks(list); };
    const saveBlock = (si) => {
        const s = form.sections[si];
        const names = window.prompt("Save this section as a reusable block. Block name:",
            s.title || "New block");
        if (!names) return;
        updateBlocks([...blocks.filter((b) => b.name !== names), sectionToBlock(s, names)]);
    };
    const useBlock = (key) => {
        const b = blocks.find((x) => x.key === key);
        if (b) insertBlock(blockToSection(b, pageCount));
    };
    const removeBlock = (key) => {
        const b = blocks.find((x) => x.key === key);
        if (b && window.confirm(`Delete block "${b.name}"?`)) {
            updateBlocks(blocks.filter((x) => x.key !== key));
        }
    };
    const download = (isi, names, tipe) => {
        const blob = new Blob([isi], { type: tipe });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = names;
        a.click(); URL.revokeObjectURL(a.href);
    };
    const eksporBlok = () => {
        if (!blocks.length) { window.alert("No custom blocks saved yet."); return; }
        download(JSON.stringify(blocks, null, 2), "form-blocks.json", "application/json");
    };
    const imporBlok = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
            try {
                const masuk = JSON.parse(r.result);
                if (!Array.isArray(masuk)) throw new Error("file does not contain a block list");
                const names = new Set(masuk.map((b) => b.name));
                updateBlocks([...blocks.filter((b) => !names.has(b.name)), ...masuk]);
            } catch (err) { window.alert("Cannot read block file: " + err.message); }
        };
        r.readAsText(f, "utf-8");
        e.target.value = "";
    };

    /* ---------------- impor HTML lama ---------------- */
    const [scanning, setScanning] = useState(false);   // sedang memindai (geometry iframe)
    const openHtml = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = async () => {
            try {
                setScanning(true);
                setScanName(f.name);
                /* Ekspor builder sendiri menyematkan model proyek (askep-model):
                   pulihkan EXACT langsung ke kanvas, tanpa layar tinjauan — bukan
                   hasil tebakan heuristik. */
                const embedded = extractEmbeddedModel(r.result);
                if (embedded) {
                    const restored = normalise(embedded);
                    setForm(restored);
                    setSel(null);
                    setImportInfo({
                        file: f.name, restored: true,
                        sections: restored.sections.length,
                        pages: Math.max(1, ...restored.sections.map((x) => x.page || 1)),
                        fieldsBefore: 0, fieldsAfter: 0, missing: [], duplicates: [],
                        components: { low: 0, raw: 0 },
                    });
                    return;
                }
                /* scanHtml kini async: dokumen lama dirender di iframe tersembunyi
                   agar baris/kolom visual terukur sebelum dikenali (geometry.js). */
                setScan(await scanHtml(r.result, { dateClass: form.meta.dateClass }));
            } catch (err) { window.alert("Cannot scan this file: " + err.message); }
            finally { setScanning(false); }
        };
        r.readAsText(f, "utf-8");
        e.target.value = "";
    };
    const applyImport = (hasil, report) => {
        setForm(normalise(hasil));
        setSel(null);
        setScan(null);
        setImportInfo({ ...report, file: scanName });
    };

    /* ---------------- berkas ---------------- */
    const fileStem = (ext) =>
        (form.meta.title || "form").replace(/[\\/:*?"<>|]/g, "_") + ext;
    const saveJson = () => download(JSON.stringify(form, null, 2), fileStem(".json"), "application/json");
    const openJson = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
            try { setForm(normalise(JSON.parse(r.result))); setSel(null); }
            catch (err) { window.alert("Cannot read file: " + err.message); }
        };
        r.readAsText(f, "utf-8");
        e.target.value = "";
    };
    const exportHtml = () => download(html, fileStem(".html"), "text/html;charset=utf-8");

    /* buka hasil di tab baru — berguna untuk melihat & mencetak ukuran penuh */
    const openInTab = () => {
        const blob = new Blob([preview], { type: "text/html;charset=utf-8" });
        window.open(URL.createObjectURL(blob), "_blank", "noopener");
    };
    const printPreview = () => {
        const f = modalFrame.current;
        try { f.contentWindow.focus(); f.contentWindow.print(); }
        catch { openInTab(); }
    };
    /* pratinjau di dalam bingkai perlu tinggi sesuai isinya */
    const fitFrame = (e) => {
        const f = e.target;
        try {
            const h = f.contentDocument.documentElement.scrollHeight;
            f.style.height = `${h + 20}px`;
        } catch { /* diabaikan */ }
    };

    const selComp = sel && sel.row != null
        ? form.sections[sel.sec]?.rows[sel.row]?.cells[sel.cell] : null;

    const cocok = (names) => !search || names.toLowerCase().includes(search.toLowerCase());

    /* ---------------- kanvas: satu section ---------------- */
    const renderSectionCard = (s, si) => (
        <div key={s.id} className={"section" + (sel?.sec === si && sel?.row == null ? " sel" : "")}>
            <div className="section-head" onClick={() => setSel({ sec: si, row: null })}>
                {form.meta.letterSections &&
                    <span className="letter">{letters[si]}</span>}
                <input value={s.title} placeholder="Section title"
                    onChange={(e) => update((d) => { secAt(d, si).title = e.target.value; })} />
                {paging.enabled && (
                    <select className="pagepick" value={s.page || 1} title="Move to page"
                        onClick={(e) => { e.stopPropagation(); setSel({ sec: si, row: null }); }}
                        onChange={(e) => setSectionPage(si, Number(e.target.value))}>
                        {Array.from({ length: pageCount + 1 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n > pageCount ? `Page ${n} (new)` : `Page ${n}`}</option>
                        ))}
                    </select>
                )}
                <button className="btn mini" title="Save this section as a reusable block"
                    onClick={(e) => { e.stopPropagation(); saveBlock(si); }}>⌸ Block</button>
                <button className="btn mini" title="Move up"
                    onClick={(e) => { e.stopPropagation(); moveSection(si, -1); }}>↑</button>
                <button className="btn mini" title="Move down"
                    onClick={(e) => { e.stopPropagation(); moveSection(si, 1); }}>↓</button>
                <button className="btn mini danger" title="Delete section"
                    onClick={(e) => { e.stopPropagation(); delSection(si); }}>✕</button>
            </div>

            {s.rows.map((r, ri) => (
                <div className="row" key={r.id}>
                    <div className="row-head">
                        <span>Row {ri + 1}</span>
                        <span>·</span>
                        <span>Columns</span>
                        <button className="btn mini" title="Remove a column"
                            disabled={r.cols <= 1} onClick={() => setCols(si, ri, r.cols - 1)}>−</button>
                        <b className="colnum">{r.cols}</b>
                        <button className="btn mini" title="Add a column"
                            disabled={r.cols >= MAX_COLS} onClick={() => setCols(si, ri, r.cols + 1)}>+</button>
                        <input className="widths" value={r.widths || ""}
                            placeholder="column widths, e.g. 30% 70%"
                            title="Leave empty for equal columns. Accepts %, px, mm, or fr."
                            onChange={(e) => setWidths(si, ri, e.target.value)} />
                        <span className="sp" />
                        <button className="btn mini" onClick={() => moveRow(si, ri, -1)}>↑</button>
                        <button className="btn mini" onClick={() => moveRow(si, ri, 1)}>↓</button>
                        <button className="btn mini" title="Duplicate row" onClick={() => dupRow(si, ri)}>⎘</button>
                        <button className="btn mini danger" onClick={() => delRow(si, ri)}>✕</button>
                    </div>
                    <div className="cells" style={{
                        gridTemplateColumns: (r.widths || "").trim() || `repeat(${r.cols}, minmax(0,1fr))`,
                    }}>
                        {r.cells.map((c, ci) => {
                            const on = sel?.sec === si && sel?.row === ri && sel?.cell === ci;
                            const span = Math.min(Math.max(Number(c?.span) || 1, 1), r.cols);
                            return (
                                <div key={ci}
                                    className={"cell" + (c ? " filled" : "") + (on ? " sel" : "")}
                                    style={span > 1 ? { gridColumn: `span ${span}` } : undefined}
                                    onClick={() => setSel({ sec: si, row: ri, cell: ci })}>
                                    {c ? (
                                        <>
                                            <div className="kind">
                                                {catalogOf(c.type)?.name || c.type}
                                                {span > 1 && <span className="tag">span {span}</span>}
                                            </div>
                                            <div className="lbl">{c.label || c.text || c.title || c.itemHeader || "—"}</div>
                                            <div className="meta">
                                                {c.field ? `name="${c.field}"` :
                                                    (["table", "matrix", "paragraph", "subtitle", "list", "note",
                                                        "image", "divider", "spacer", "pagebreak", "signature",
                                                        "button", "html", "static"].includes(c.type) ? "" : "no name yet")}
                                            </div>
                                        </>
                                    ) : <div className="empty">+ pick a component</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div className="row">
                <button className="btn mini" onClick={() => addRow(si, 1)}>+ Row, 1 column</button>{" "}
                <button className="btn mini" onClick={() => addRow(si, 2)}>+ 2 columns</button>{" "}
                <button className="btn mini" onClick={() => addRow(si, 3)}>+ 3 columns</button>{" "}
                <button className="btn mini" onClick={() => addRow(si, 4)}>+ 4 columns</button>
            </div>
        </div>
    );

    /* kontrol Sync dipakai di topbar builder maupun preview statis — tombol
       ini membuka dialog pemilihan profile (lihat modal syncModalOpen). */
    const syncControls = (
        <button className="btn ghost" disabled={!allProfiles.length || syncing}
            title={allProfiles.length
                ? "Push this target's HTML into askep_list"
                : "No database profiles configured in askep.config.yaml"}
            onClick={openSyncDialog}>
            {syncing ? "Syncing…" : "⇄ Sync"}
        </button>
    );

    /* ==================================================================== */
    return (
        <div className="app">

            {/* ---------- bilah atas ---------- */}
            <div className="topbar">
                <h1>Medical Form Builder</h1>
                <div className="menu" ref={targetMenuRef}>
                    <button className="btn ghost" onClick={() => setTargetMenuOpen((v) => !v)}
                        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setTargetMenuOpen(true); } }}
                        title="Switch target / create a new form">
                        ☰ {activeTarget || "Select target"}{activeInfo && !activeInfo.isBuilder ? " (static)" : ""}
                    </button>
                    {targetMenuOpen && (
                        <div className="menu-list" onKeyDown={onMenuKeyDown}>
                            <button onClick={() => { setTargetMenuOpen(false); newTarget(); }}>
                                + New Form
                            </button>
                            <div className="menu-divider" />
                            {!targets.length && <span className="menu-empty">No targets configured</span>}
                            {targets.map((t) => (
                                <button key={t.name}
                                    className={t.name === activeTarget ? "active" : ""}
                                    onClick={() => { setActiveTarget(t.name); setTargetMenuOpen(false); }}>
                                    {t.name === activeTarget ? "✓ " : ""}{t.name}{t.isBuilder ? "" : " (static)"}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {isBuilderMode ? (
                    <>
                        <input
                            className="title-input" value={form.meta.title}
                            placeholder="Form title"
                            onChange={(e) => update((d) => { d.meta.title = e.target.value; })}
                        />
                        <button className="btn ghost"
                            title="Fill nama-form / inisial-form / kode-form / kode-satusehat for this target"
                            onClick={openAttrDialog}>
                            🏷 Attributes
                        </button>
                        <span className="sp" />
                        <button className="btn primary" onClick={exportHtml}>Export HTML</button>
                        {syncControls}
                        <div className="menu" ref={menuRef}>
                            <button className="btn ghost" onClick={() => setMenuOpen((v) => !v)}
                                onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setMenuOpen(true); } }}>
                                ⚙
                            </button>
                            {menuOpen && (
                                <div className="menu-list" onKeyDown={onMenuKeyDown}>
                                    <button disabled={scanning}
                                        onClick={() => { htmlRef.current.click(); setMenuOpen(false); }}>
                                        {scanning ? "Scanning…" : "⇪ Import HTML"}
                                    </button>
                                    <button onClick={() => { fileRef.current.click(); setMenuOpen(false); }}>Open .json</button>
                                    <button onClick={() => { saveJson(); setMenuOpen(false); }}>Save .json</button>
                                    <button title="Edit the letterhead and the signature footer"
                                        onClick={() => { setSel(null); setJump({ ke: "header", n: Date.now() }); setMenuOpen(false); }}>
                                        ⚙ Header &amp; footer
                                    </button>
                                    <button onClick={() => { setShowPreview((v) => !v); setMenuOpen(false); }}>
                                        {showPreview ? "Hide side preview" : "Show side preview"}
                                    </button>
                                    <button onClick={() => { setModal(true); setMenuOpen(false); }}>⛶ Full preview</button>
                                </div>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={openJson} />
                        <input ref={blockFileRef} type="file" accept=".json" style={{ display: "none" }} onChange={imporBlok} />
                        <input ref={htmlRef} type="file" accept=".html,.htm" style={{ display: "none" }} onChange={openHtml} />
                    </>
                ) : (
                    <>
                        <span className="sp" />
                        <span style={{ fontSize: "12.5px", opacity: 0.85 }}>
                            Read-only preview — this target does not use the Form Builder yet.
                        </span>
                        {syncControls}
                        <button className="btn primary" disabled={!activeTarget}
                            onClick={() => setForcedBuilder((s) => new Set(s).add(activeTarget))}>
                            Start building with Form Builder
                        </button>
                    </>
                )}
            </div>

            {loadNote && !importInfo && (
                <div className="importbar">
                    <b>{loadNote === "restored" ? "Loaded saved form" : "New form"}</b>
                    <span>
                        target <b>{activeTarget}</b> —{" "}
                        {loadNote === "restored"
                            ? "restored from the server"
                            : "no saved data yet for this target; changes autosave to the server"}
                    </span>
                    <span className="sp" />
                    <button className="btn mini" onClick={() => setLoadNote(null)}>Dismiss</button>
                </div>
            )}
            {importInfo && (
                <div className={"importbar" + (importInfo.missing.length ? " bad" : "")}>
                    <b>{importInfo.restored ? "Restored " : "Imported "}{importInfo.file}</b>
                    {importInfo.restored && <span className="pill ok">exact — from embedded model</span>}
                    <span>{importInfo.sections} sections</span>
                    <span>{importInfo.pages} page{importInfo.pages === 1 ? "" : "s"}</span>
                    {!importInfo.restored && (
                        <span>{importInfo.fieldsAfter} of {importInfo.fieldsBefore} field names kept</span>
                    )}
                    {!importInfo.restored && (
                        <span>{importInfo.components.low + importInfo.components.raw} raw HTML</span>
                    )}
                    {importInfo.missing.length > 0 && <span>missing: {importInfo.missing.slice(0, 6).join(", ")}</span>}
                    {importInfo.duplicates.length > 0 && <span>{importInfo.duplicates.length} duplicate ids in source</span>}
                    <span className="sp" />
                    <button className="btn mini" onClick={() => setImportInfo(null)}>Dismiss</button>
                </div>
            )}

            {!isBuilderMode && (
                <div className="modal-body" style={{ flex: 1 }}>
                    {previewLoading ? (
                        <p style={{ color: "#fff" }}>Loading preview…</p>
                    ) : (
                        <div className="sheet" style={{ width: "210mm" }}>
                            <iframe title="static preview" srcDoc={previewHtml}
                                onLoad={fitFrame} sandbox="allow-same-origin" />
                        </div>
                    )}
                </div>
            )}

            {isBuilderMode && (
                <>
                    <div className={"main" + (showPreview ? " preview-on" : "")}>

                        {/* ---------- palet ---------- */}
                        <div className="pane">
                            <h2>Components</h2>
                            <input className="search" type="search" value={search} placeholder="Search components…"
                                onChange={(e) => setSearch(e.target.value)} />
                            {!sel && (
                                <div className="palette-note">
                                    Click an <b>empty cell</b> on the canvas first, then pick a component here.
                                </div>
                            )}
                            {GROUPS.map((g) => {
                                const isi = CATALOG.filter((c) => c.group === g && cocok(c.name));
                                if (!isi.length) return null;
                                return (
                                    <div key={g}>
                                        <div className="palette-group">{g}</div>
                                        {isi.map((c) => (
                                            <button key={c.type} className="palette-item" disabled={!sel}
                                                onClick={() => addComponent(c.type)}>
                                                <span className="ic">{c.icon}</span>{c.name}
                                            </button>
                                        ))}
                                    </div>
                                );
                            })}

                            <div className="palette-group">Ready-made blocks</div>
                            {PRESETS.filter((p) => cocok(p.name)).map((p) => (
                                <button key={p.key} className="palette-item" title={p.note}
                                    onClick={() => addPreset(p.key)}>
                                    <span className="ic">▣</span>{p.name}
                                </button>
                            ))}

                            <div className="palette-group">
                                My blocks
                                <span className="sp" />
                                <button className="btn mini" title="Import blocks from a .json file"
                                    onClick={() => blockFileRef.current.click()}>Import</button>
                                <button className="btn mini" title="Export all custom blocks to .json"
                                    onClick={eksporBlok}>Export</button>
                            </div>
                            {!blocks.length && (
                                <div className="palette-note">
                                    None yet. Press <b>⌸ Block</b> on a section header to save your own
                                    layout — it will show up here.
                                </div>
                            )}
                            {blocks.filter((b) => cocok(b.name)).map((b) => (
                                <div className="palette-row" key={b.key}>
                                    <button className="palette-item" title={b.note} onClick={() => useBlock(b.key)}>
                                        <span className="ic">▩</span>{b.name}
                                    </button>
                                    <button className="btn mini danger" title="Delete block"
                                        onClick={() => removeBlock(b.key)}>✕</button>
                                </div>
                            ))}
                        </div>

                        {/* ---------- kanvas ---------- */}
                        <div className="pane">
                            <h2>Form layout</h2>
                            <div className="canvas"
                                onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
                                {!paging.enabled && form.sections.map((s, si) => renderSectionCard(s, si))}

                                {paging.enabled && Array.from({ length: pageCount }, (_, i) => i + 1).map((pnum) => {
                                    const punya = form.sections
                                        .map((s, si) => ({ s, si }))
                                        .filter(({ s }) => (Number(s.page) || 1) === pnum);
                                    return (
                                        <div className="pagegroup" key={pnum}>
                                            <div className="pagebar">
                                                <span className="pagetag">Page {pnum}</span>
                                                <span className="pagemeta">
                                                    {punya.length} section{punya.length === 1 ? "" : "s"}
                                                    {pnum === 1 && form.meta.showHeader && " · letterhead"}
                                                    {pnum === pageCount && form.meta.showFooter && " · signatures"}
                                                </span>
                                                <span className="sp" />
                                                <button className="btn mini" onClick={() => addSection(pnum)}>+ Section</button>
                                            </div>
                                            {punya.map(({ s, si }) => renderSectionCard(s, si))}
                                            {!punya.length && (
                                                <div className="palette-note">
                                                    This page is empty. Add a section, or move one here with the
                                                    page selector in its header.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <div className="canvas-foot">
                                    <button className="btn primary" onClick={() => addSection(pageCount)}>
                                        + Add section
                                    </button>
                                    {paging.enabled && (
                                        <button className="btn" onClick={addPage}>+ Add page</button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ---------- inspektur ---------- */}
                        <div className="pane">
                            <div className="pane-head">
                                <button className={"seg" + (!sel ? " on" : "")}
                                    onClick={() => setSel(null)}
                                    title="Title, letterhead, footer, pages, application attributes">
                                    Form
                                </button>
                                <button className={"seg" + (sel && sel.row == null ? " on" : "")}
                                    disabled={!sel}
                                    onClick={() => sel && setSel({ sec: sel.sec, row: null })}>
                                    Section
                                </button>
                                <button className={"seg" + (selComp ? " on" : "")} disabled={!selComp}>
                                    Component
                                </button>
                            </div>
                            <Inspector
                                form={form} sel={sel} comp={selComp}
                                row={sel && sel.row != null ? form.sections[sel.sec]?.rows[sel.row] : null}
                                letters={letters}
                                jump={jump}
                                onForm={(patch) => update((d) => { Object.assign(d.meta, patch); })}
                                onSection={(patch) => update((d) => { Object.assign(d.sections[sel.sec], patch); })}
                                onComp={patchComponent}
                                onClear={clearCell}
                                stat={stat}
                            />
                        </div>

                        {/* ---------- pratinjau samping ---------- */}
                        {showPreview && (
                            <div className="pane preview-wrap">
                                <div className="tabs">
                                    <button className={tab === "preview" ? "on" : ""} onClick={() => setTab("preview")}>Preview</button>
                                    <button className={tab === "html" ? "on" : ""} onClick={() => setTab("html")}>HTML</button>
                                    <button className={tab === "script" ? "on" : ""} onClick={() => setTab("script")}>Script</button>
                                    <span className="sp" />
                                    <button className="linkbtn" onClick={() => setModal(true)}>⛶ Full</button>
                                    <button className="linkbtn" onClick={openInTab}>↗ New tab</button>
                                </div>
                                {tab === "preview" && (
                                    <div className="side-view" ref={sideBox}>
                                        <iframe title="preview" srcDoc={preview}
                                            sandbox="allow-scripts allow-same-origin"
                                            style={{
                                                width: 860, height: `${100 / sideScale}%`,
                                                transform: `scale(${sideScale})`,
                                                transformOrigin: "top left"
                                            }} />
                                    </div>
                                )}
                                {tab === "html" && (
                                    <Editor defaultLanguage="html"
                                        value={html}
                                        theme="vs-dark"
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: editorFontSize,
                                        }}
                                        onMount={(editor, monaco) => {
                                            const grow = () => setEditorFontSize((s) => Math.min(s + 1, 40));
                                            const shrink = () => setEditorFontSize((s) => Math.max(s - 1, 8));
                                            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, grow);
                                            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.NumpadAdd, grow);
                                            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, shrink);
                                            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.NumpadSubtract, shrink);
                                        }}
                                    />
                                )}
                                {tab === "script" && (
                                    <div className="side-view" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                                        <div className="tabs" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
                                            {scripts.map((s) => (
                                                <button key={s.id} className={s.id === activeScriptId ? "on" : ""}
                                                    title={s.name}
                                                    onClick={() => switchScript(s.id)}>
                                                    {s.source === "manual" ? "⚙ " : "▤ "}{s.name}
                                                    {s.source === "builder" && (
                                                        <span className="linkbtn" title="Delete script"
                                                            onClick={(e) => { e.stopPropagation(); removeScript(s.id); }}>
                                                            {" "}✕
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                            <button className="linkbtn" onClick={addScript}>+ Add script</button>
                                            <span className="sp" />
                                            {activeScriptId && <span style={{ opacity: 0.6, fontSize: 12 }}>{scriptSaving ? "Saving…" : "Autosaved"}</span>}
                                        </div>
                                        {activeScriptId ? (
                                            <Editor key={activeScriptId} defaultLanguage="javascript"
                                                value={scriptContents[activeScriptId] ?? ""}
                                                theme="vs-dark"
                                                options={{ minimap: { enabled: false }, fontSize: editorFontSize }}
                                                onChange={(v) => {
                                                    const content = v ?? "";
                                                    setScriptContents((c) => ({ ...c, [activeScriptId]: content }));
                                                    scheduleScriptSave(activeTarget, activeScriptId, content);
                                                }}
                                                onMount={(editor, monaco) => {
                                                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                                                        flushScriptSave();
                                                        doSaveScript(activeTarget, activeScriptId, editor.getValue());
                                                    });
                                                }}
                                            />
                                        ) : (
                                            <div className="palette-note">No scripts yet. Add one, or list one under
                                                this target's <code>script:</code> in askep.config.yaml.</div>
                                        )}
                                    </div>
                                )}
                                <div className="stat">
                                    {paging.enabled && <span>pages <b>{stat.pages}</b></span>}
                                    <span>sections <b>{stat.sections}</b></span>
                                    <span>rows <b>{stat.rows}</b></span>
                                    <span>components <b>{stat.comps}</b></span>
                                    <span>fields <b>{stat.fields}</b></span>
                                    {stat.dup.length > 0 && <span style={{ color: "#C0392B" }}>duplicate names: <b>{stat.dup.join(", ")}</b></span>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ---------- tinjauan impor ---------- */}
                    {scan && (
                        <ImportPanel scan={scan} fileName={scanName}
                            onCancel={() => setScan(null)} onConfirm={applyImport} />
                    )}

                    {/* ---------- pratinjau layar penuh ---------- */}
                    {modal && (
                        <div className="modal-back" onClick={() => setModal(false)}>
                            <div className="modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-bar">
                                    <b>{form.meta.title || "Preview"}</b>
                                    <span className="sp" />
                                    <label className="modal-fld">
                                        Paper
                                        <select value={sheet} onChange={(e) => setSheet(e.target.value)}>
                                            <option value="210mm">A4 · 210 mm</option>
                                            <option value="215mm">F4 / Folio · 215 mm</option>
                                            <option value="297mm">A4 landscape · 297 mm</option>
                                            <option value="100%">Fit window</option>
                                        </select>
                                    </label>
                                    <label className="modal-fld">
                                        Zoom
                                        <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
                                            {ZOOMS.map((z) => <option key={z} value={z}>{Math.round(z * 100)}%</option>)}
                                        </select>
                                    </label>
                                    <button className="btn mini" onClick={printPreview}>🖨 Print</button>
                                    <button className="btn mini" onClick={openInTab}>↗ New tab</button>
                                    <button className="btn mini danger" onClick={() => setModal(false)}>✕ Close</button>
                                </div>
                                <div className="modal-body">
                                    <div className="sheet" style={{
                                        width: sheet,
                                        transform: `scale(${zoom})`,
                                        transformOrigin: "top center",
                                    }}>
                                        <iframe ref={modalFrame} title="full preview" srcDoc={preview}
                                            onLoad={fitFrame} sandbox="allow-scripts allow-same-origin allow-modals" />
                                    </div>
                                </div>
                                <div className="modal-foot">
                                    Press <kbd>Esc</kbd> to close · page navigation buttons work here, so
                                    multi-page forms can be checked page by page.
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ---------- dialog Sync: pilih profile database ---------- */}
            {syncModalOpen && (
                <div className="modal-back" onClick={() => !syncing && setSyncModalOpen(false)}>
                    <div className="dialog" onClick={(e) => e.stopPropagation()}>
                        <h3>Sync &quot;{activeTarget}&quot;</h3>
                        <p>
                            Choose a database profile. This overwrites the matching
                            <code> askep_list</code> row with the current form and cannot be undone.
                        </p>
                        <div className="dialog-profiles">
                            {allProfiles.map((p) => (
                                <label key={p} className={syncProfile === p ? "on" : ""}>
                                    <input type="radio" name="sync-profile" value={p}
                                        checked={syncProfile === p}
                                        onChange={() => setSyncProfile(p)} />
                                    <span style={{ flex: 1 }}>{p}</span>
                                    <input type="number" min="1" className="dialog-alid"
                                        placeholder="alid"
                                        value={alidDraft[p] ?? ""}
                                        onFocus={() => setSyncProfile(p)}
                                        onChange={(e) => setAlidDraft((d) => ({ ...d, [p]: e.target.value }))}
                                        onClick={(e) => e.stopPropagation()} />
                                </label>
                            ))}
                        </div>
                        <div className="dialog-actions">
                            <button className="btn" disabled={syncing}
                                onClick={() => setSyncModalOpen(false)}>Cancel</button>
                            <button className="btn primary" disabled={syncing || !syncProfile || !syncAlidValid}
                                onClick={runSync}>
                                {syncing ? "Syncing…" : "⇄ Sync"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ---------- dialog Attributes: nama-form/inisial-form/kode-form/kode-satusehat ---------- */}
            {attrModalOpen && (
                <div className="modal-back" onClick={() => !savingAttrs && setAttrModalOpen(false)}>
                    <div className="dialog" onClick={(e) => e.stopPropagation()}>
                        <h3>Attributes for &quot;{activeTarget}&quot;</h3>
                        <p>
                            These fill the matching <code>askep_list</code> columns when syncing.
                            Leave all blank to clear them.
                        </p>
                        <label className="dialog-field">
                            <span>Nama Form (nama-form)</span>
                            <input value={attrDraft.namaForm}
                                onChange={(e) => setAttrDraft((d) => ({ ...d, namaForm: e.target.value }))} />
                        </label>
                        <label className="dialog-field">
                            <span>Inisial Form (inisial-form)</span>
                            <input value={attrDraft.inisialForm}
                                onChange={(e) => setAttrDraft((d) => ({ ...d, inisialForm: e.target.value }))} />
                        </label>
                        <label className="dialog-field">
                            <span>Kode Form (kode-form)</span>
                            <input value={attrDraft.kodeForm}
                                onChange={(e) => setAttrDraft((d) => ({ ...d, kodeForm: e.target.value }))} />
                        </label>
                        <label className="dialog-field">
                            <span>Kode SatuSehat (kode-satusehat)</span>
                            <input value={attrDraft.kodeSatusehat}
                                onChange={(e) => setAttrDraft((d) => ({ ...d, kodeSatusehat: e.target.value }))} />
                        </label>
                        <div className="dialog-actions">
                            <button className="btn" disabled={savingAttrs}
                                onClick={() => setAttrModalOpen(false)}>Cancel</button>
                            <button className="btn primary" disabled={savingAttrs}
                                onClick={saveAttrs}>
                                {savingAttrs ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
