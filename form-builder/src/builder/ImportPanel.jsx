import React, { useEffect, useMemo, useState } from "react";
import { buildForm, buildReport } from "./import/build.js";
import { generatePreview } from "./generate.js";

/* ==========================================================================
   ImportPanel.jsx — layar tinjauan sebelum hasil pindaian masuk ke kanvas
   ==========================================================================
   Termasuk "Wireframe check": perbandingan berdampingan antara formulir asli
   (CSS lama dipertahankan, hanya di sini) dan hasil impor (tema askep-*),
   sehingga kesesuaian dengan wireframe bisa dilihat mata sebelum diimpor.
   ========================================================================== */

/* Satu panel perbandingan: pratinjau diskalakan + tautan buka tab baru. */
function ComparePane({ title, html, tinggi = 460 }) {
    const url = useMemo(() =>
        URL.createObjectURL(new Blob([html], { type: "text/html" })), [html]);
    useEffect(() => () => URL.revokeObjectURL(url), [url]);
    const skala = 0.42;
    return (
        <div className="banding-pane">
            <div className="banding-head">
                <b>{title}</b>
                <a href={url} target="_blank" rel="noreferrer">Open ↗</a>
            </div>
            <div className="banding-view" style={{ height: tinggi }}>
                <iframe title={title} srcDoc={html}
                    style={{
                        width: 794, height: Math.round(tinggi / skala) + 80,
                        transform: `scale(${skala})`, transformOrigin: "0 0"
                    }} />
            </div>
        </div>
    );
}

export default function ImportPanel({ scan, fileName, onCancel, onConfirm }) {
    const [aksi, setAksi] = useState(() => {
        const a = {};
        scan.sections.forEach((s) => { a[s.key] = s.action || "take"; });
        return a;
    });
    const [compare, setBanding] = useState(false);   // tampilkan Wireframe check

    const { form, report } = useMemo(() => {
        const f = buildForm(scan, aksi);
        return { form: f, report: buildReport(scan, f) };
    }, [scan, aksi]);

    const resultHtml = useMemo(() => generatePreview(form), [form]);

    const setAll = (v) => {
        const a = {};
        scan.sections.forEach((s) => { a[s.key] = v; });
        setAksi(a);
    };

    const total = report.components.high + report.components.medium +
        report.components.low + report.components.raw;

    return (
        <div className="modal-back" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-bar">
                    <b>Review import</b>
                    <span className="muted">{fileName}</span>
                    <span className="sp" />
                    <button className="btn mini" onClick={() => setAll("take")}>All: components</button>
                    <button className="btn mini" onClick={() => setAll("raw")}>All: raw HTML</button>
                    <button className="btn mini danger" onClick={onCancel}>✕ Cancel</button>
                </div>

                <div className="modal-body import-body">
                    {/* -------- laporan mutu -------- */}
                    <div className="report">
                        <div className="report-row">
                            <span className="pill">{report.pages} page{report.pages === 1 ? "" : "s"}</span>
                            <span className="pill">{report.sections} sections detected</span>
                            <span className="pill">{total} components</span>
                            <span className="pill ok">{report.components.high} high</span>
                            <span className="pill warn">{report.components.medium} medium</span>
                            <span className="pill low">{report.components.low + report.components.raw} raw / low</span>
                            <span className="pill">{report.signs} signature{report.signs === 1 ? "" : "s"}</span>
                            <span className={"pill " + (report.headerFound ? "ok" : "warn")}>
                                letterhead {report.headerFound ? "detected" : "not found — defaults used"}
                            </span>
                            <span className={"pill " + (scan.meta.geometry?.active ? "ok" : "warn")}>
                                {scan.meta.geometry?.active
                                    ? `geometry scan · ${scan.meta.geometry.elements} elements measured`
                                    : "geometry unavailable — markup heuristics only"}
                            </span>
                        </div>

                        <div className="report-row">
                            <span className="pill">{report.fieldsBefore} field names in the file</span>
                            <span className={"pill " + (report.missing.length ? "bad" : "ok")}>
                                {report.missing.length
                                    ? `${report.missing.length} would be LOST`
                                    : "no field lost"}
                            </span>
                            {report.keptHidden.length > 0 && (
                                <span className="pill low">
                                    {report.keptHidden.length} field{report.keptHidden.length === 1 ? "" : "s"} kept as hidden
                                </span>
                            )}
                            {report.rebuilt.length > 0 && (
                                <span className="pill">
                                    {report.rebuilt.length} signature field{report.rebuilt.length === 1 ? "" : "s"} rebuilt by the template
                                </span>
                            )}
                            {report.duplicates.length > 0 && (
                                <span className="pill warn">
                                    {report.duplicates.length} duplicate id{report.duplicates.length === 1 ? "" : "s"} in the source
                                </span>
                            )}
                        </div>

                        {report.missing.length > 0 && (
                            <div className="warn">
                                <b>These field names disappear:</b> {report.missing.slice(0, 25).join(", ")}
                                {report.missing.length > 25 && ` … +${report.missing.length - 25}`}
                                <br />Switch the affected section to <b>Raw HTML</b> to keep them exactly as they are.
                            </div>
                        )}
                        {report.keptHidden.length > 0 && (
                            <div className="hintbox">
                                <b>Not recognised as a component, kept as hidden fields</b> so no
                                data is lost — you can rebuild them by hand later:
                                {" "}<code>{report.keptHidden.slice(0, 12).join(", ")}</code>
                                {report.keptHidden.length > 12 && ` … +${report.keptHidden.length - 12}`}
                            </div>
                        )}
                        {report.duplicates.length > 0 && (
                            <div className="hintbox">
                                Duplicate ids already present in the source file are reported, never
                                renamed — application scripts that rely on them keep working:
                                {" "}<code>{report.duplicates.slice(0, 8).join(", ")}</code>
                                {report.duplicates.length > 8 && ` … +${report.duplicates.length - 8}`}
                            </div>
                        )}
                    </div>

                    {/* -------- wireframe check: asli vs hasil, berdampingan -------- */}
                    <div className="banding-bar">
                        <button className={"btn mini" + (compare ? " on" : "")}
                            onClick={() => setBanding(!compare)}>
                            ◫ Wireframe check (original vs result)
                        </button>
                        <span className="muted small">
                            {compare
                                ? "left = old file with its own CSS · right = import result with the askep-* theme"
                                : "compare the old form against the import result side by side before importing"}
                        </span>
                    </div>
                    {compare && (
                        <div className="banding">
                            <ComparePane title="Original file" html={scan.sourceHtml || "<p>No source</p>"} />
                            <ComparePane title="Import result" html={resultHtml} />
                        </div>
                    )}

                    {/* -------- daftar section -------- */}
                    <table className="import-table">
                        <thead>
                            <tr>
                                <th>Section</th>
                                <th style={{ width: 60 }}>Page</th>
                                <th style={{ width: 60 }}>Rows</th>
                                <th style={{ width: 70 }}>Fields</th>
                                <th style={{ width: 90 }}>Confidence</th>
                                <th style={{ width: 230 }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scan.sections.map((s) => (
                                <tr key={s.key}>
                                    <td>
                                        <b>{s.title}</b>
                                        <div className="muted small">
                                            {s.stat.high} high · {s.stat.medium} medium ·{" "}
                                            {s.stat.low + s.stat.raw} raw
                                        </div>
                                    </td>
                                    <td>{s.page}</td>
                                    <td>{s.rows.length}</td>
                                    <td>{s.stat.fields}</td>
                                    <td><span className={"badge " + s.confidence}>{s.confidence}</span></td>
                                    <td>
                                        <div className="segrow">
                                            {[["take", "Components"], ["raw", "Raw HTML"], ["skip", "Skip"]].map(([v, t]) => (
                                                <button key={v}
                                                    className={"seg" + (aksi[s.key] === v ? " on" : "")}
                                                    onClick={() => setAksi({ ...aksi, [s.key]: v })}>{t}</button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!scan.sections.length && (
                                <tr><td colSpan={6} className="muted">Nothing detected in this file.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="modal-foot import-foot">
                    <span>
                        Importing <b>replaces</b> the form currently open. Anything not
                        recognised is kept as a Raw HTML component — nothing is thrown away.
                    </span>
                    <span className="sp" />
                    <button className="btn" onClick={onCancel}>Cancel</button>
                    <button className="btn primary" onClick={() => onConfirm(form, report)}>
                        Import into builder
                    </button>
                </div>
            </div>
        </div>
    );
}
