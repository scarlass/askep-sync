import React, { useEffect, useRef } from "react";
import { PLACEHOLDERS, makeSign, makeIdentRow } from "./model.js";
import { ListItems } from "./ListEditor.jsx";

/* ==========================================================================
   Inspector.jsx — panel properti (formulir / section / komponen)
   Teks antarmuka: bahasa Inggris. Komentar kode: bahasa Indonesia.
   ========================================================================== */

/* Input dibungkus <label> supaya benar-benar tertaut — mengklik teksnya
   memfokuskan isian, dan pembaca layar membacakan pasangannya dengan benar. */
const Text = ({ label, value, onChange, ...rest }) => (
    <label className="fld">
        <span>{label}</span>
        <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
);

const Area = ({ label, value, onChange, ...rest }) => (
    <label className="fld">
        <span>{label}</span>
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
);

const Num = ({ label, value, onChange, ...rest }) => (
    <label className="fld">
        <span>{label}</span>
        <input type="number" value={value ?? 0}
            onChange={(e) => onChange(Number(e.target.value))} {...rest} />
    </label>
);

const Check = ({ label, value, onChange }) => (
    <label className="fld inline">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
    </label>
);

const Sel = ({ label, value, onChange, options }) => (
    <label className="fld">
        <span>{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
            {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
    </label>
);

/* Isian ukuran bebas: boleh px, %, mm, em — chip hanya jalan pintas. */
const SIZE_CHIPS = ["", "25%", "33%", "50%", "75%", "100%", "60px", "80px", "120px", "200px", "40mm"];
function Size({ label, value, onChange, hint }) {
    return (
        <div className="fld">
            <span className="fld-title">{label}</span>
            <input type="text" value={value ?? ""} placeholder="empty = follows the column"
                onChange={(e) => onChange(e.target.value)} />
            <div className="chips">
                {SIZE_CHIPS.map((s) => (
                    <button key={s || "auto"} className="chip" onClick={() => onChange(s)}>{s || "auto"}</button>
                ))}
            </div>
            {hint && <div className="hintbox">{hint}</div>}
        </div>
    );
}

/* daftar opsi yang bisa ditambah/kurang bebas */
function OptionList({ label, items, onChange, placeholder = "Option" }) {
    const set = (i, v) => { const a = [...items]; a[i] = v; onChange(a); };
    const del = (i) => onChange(items.filter((_, j) => j !== i));
    const move = (i, d) => {
        const a = [...items], j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]]; onChange(a);
    };
    return (
        <div className="fld">
            <span className="fld-title">{label}</span>
            {items.map((o, i) => (
                <div className="opt-row" key={i}>
                    <input type="text" value={o} onChange={(e) => set(i, e.target.value)} />
                    <button className="btn mini" onClick={() => move(i, -1)}>↑</button>
                    <button className="btn mini" onClick={() => move(i, 1)}>↓</button>
                    <button className="btn mini danger" onClick={() => del(i)}>✕</button>
                </div>
            ))}
            <button className="btn mini" onClick={() => onChange([...items, placeholder + " " + (items.length + 1)])}>
                + Add option
            </button>
        </div>
    );
}

/* daftar objek {a,b} yang bisa ditambah/kurang bebas */
function PairList({ label, items, cols, onChange, blank, addLabel = "+ Add" }) {
    const set = (i, k, v) => { const a = items.map((x) => ({ ...x })); a[i][k] = v; onChange(a); };
    const del = (i) => onChange(items.filter((_, j) => j !== i));
    const move = (i, d) => {
        const a = items.map((x) => ({ ...x })), j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]]; onChange(a);
    };
    return (
        <div className="fld">
            <span className="fld-title">{label}</span>
            {items.map((it, i) => (
                <div className="opt-row" key={i}>
                    {cols.map((c) => (
                        <input key={c.k} type="text" placeholder={c.p} value={it[c.k] ?? ""}
                            onChange={(e) => set(i, c.k, e.target.value)} />
                    ))}
                    <button className="btn mini" onClick={() => move(i, -1)}>↑</button>
                    <button className="btn mini" onClick={() => move(i, 1)}>↓</button>
                    <button className="btn mini danger" onClick={() => del(i)}>✕</button>
                </div>
            ))}
            <button className="btn mini" onClick={() => onChange([...items, { ...blank }])}>{addLabel}</button>
        </div>
    );
}

/* bagian yang bisa dibuka-tutup */
const Group = ({ title, open, children }) => (
    <details className="group" open={open}>
        <summary>{title}</summary>
        <div className="group-body">{children}</div>
    </details>
);

/* ==========================================================================
   Editor baris kotak identitas pada kop
   ========================================================================== */
function IdentList({ rows, onChange }) {
    const patch = (i, v) => onChange(rows.map((r, j) => (j === i ? { ...r, ...v } : r)));
    const del = (i) => onChange(rows.filter((_, j) => j !== i));
    const move = (i, d) => {
        const a = [...rows], j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]]; onChange(a);
    };
    return (
        <div className="fld">
            <span className="fld-title">Identity rows</span>
            {rows.map((r, i) => (
                <div className="rowcard" key={i}>
                    <div className="rowcard-head">
                        <b>Row {i + 1}</b>
                        <span className="sp" />
                        <button className="btn mini" onClick={() => move(i, -1)}>↑</button>
                        <button className="btn mini" onClick={() => move(i, 1)}>↓</button>
                        <button className="btn mini danger" onClick={() => del(i)}>✕</button>
                    </div>
                    <div className="two">
                        <Text label="Label" value={r.key} onChange={(v) => patch(i, { key: v })} />
                        <Sel label="Row type" value={r.type || "static"} onChange={(v) => patch(i, { type: v })}
                            options={[{ v: "static", t: "System value (text)" },
                            { v: "input", t: "Text input" },
                            { v: "date", t: "Date input" },
                            { v: "blank", t: "Empty line (write by hand)" },
                            { v: "options", t: "Choices (radio)" }]} />
                    </div>

                    {(r.type || "static") === "static" && (<>
                        <Text label="Value" value={r.value} placeholder="{NO_RM}"
                            onChange={(v) => patch(i, { value: v })} />
                        <div className="chips">
                            {PLACEHOLDERS.slice(0, 9).map((ph) => (
                                <button key={ph} className="chip" onClick={() => patch(i, { value: ph })}>{ph}</button>
                            ))}
                        </div>
                    </>)}

                    {(r.type === "input" || r.type === "date" || r.type === "options") && (<>
                        <Text label="Field name (name attribute)" value={r.field}
                            placeholder="e.g. no_rm" onChange={(v) => patch(i, { field: v })} />
                        {!r.field && (
                            <div className="hintbox">Without a <code>name</code> this row is never saved.</div>
                        )}
                    </>)}

                    {r.type === "options" && (<>
                        <Check label="Allow multiple choices (checkbox instead of radio)"
                            value={r.multi} onChange={(v) => patch(i, { multi: v })} />
                        <OptionList label="Choices" items={r.options || []}
                            onChange={(v) => patch(i, { options: v })} />
                    </>)}

                    <div className="fld">
                        <span className="fld-title">Value width for this row (empty = follow the column)</span>
                        <input type="text" value={r.width ?? ""} placeholder="e.g. 45mm, 70%, 120px"
                            onChange={(e) => patch(i, { width: e.target.value })} />
                        <div className="chips">
                            {["", "100%", "80%", "60%", "40%", "60mm", "45mm", "25mm"].map((w) => (
                                <button key={w || "auto"} className={"chip" + ((r.width || "") === w ? " on" : "")}
                                    onClick={() => patch(i, { width: w })}>{w || "follow column"}</button>
                            ))}
                        </div>
                        <div className="hintbox">
                            Measured against the <b>whole identity box</b>, not the value
                            column — so <code>100%</code> really is the full width and the
                            label moves onto its own line above. Values wider than the box are
                            capped, never spilling outside the letterhead.
                        </div>
                    </div>
                    <Check label="Full width (label above the value)" value={r.full}
                        onChange={(v) => patch(i, { full: v })} />
                </div>
            ))}
            <button className="btn mini" onClick={() => onChange([...rows, makeIdentRow("Label")])}>
                + Add identity row
            </button>
        </div>
    );
}

/* ==========================================================================
   Editor daftar tanda tangan (dipakai footer)
   ========================================================================== */
function SignList({ signs, onChange, split }) {
    const patch = (i, v) => onChange(signs.map((g, j) => (j === i ? { ...g, ...v } : g)));
    const del = (i) => onChange(signs.filter((_, j) => j !== i));
    const move = (i, d) => {
        const a = [...signs], j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]]; onChange(a);
    };
    return (
        <div className="fld">
            <span className="fld-title">Signatures in the footer</span>
            {signs.map((g, i) => (
                <div className="signcard" key={g.id || i}>
                    <div className="signcard-head">
                        <b>Signature {i + 1}</b>
                        <span className="sp" />
                        <button className="btn mini" onClick={() => move(i, -1)}>↑</button>
                        <button className="btn mini" onClick={() => move(i, 1)}>↓</button>
                        <button className="btn mini danger" disabled={signs.length < 2}
                            onClick={() => del(i)}>✕</button>
                    </div>
                    <div className="two">
                        <Text label="Role / title" value={g.role} onChange={(v) => patch(i, { role: v })} />
                        <Text label="City" value={g.place} onChange={(v) => patch(i, { place: v })} />
                    </div>
                    {split && (
                        <Sel label="Side" value={g.side || "kanan"} onChange={(v) => patch(i, { side: v })}
                            options={[{ v: "kiri", t: "Left side" }, { v: "kanan", t: "Right side" }]} />
                    )}
                    <Check label="Place & date line" value={g.withDate} onChange={(v) => patch(i, { withDate: v })} />
                    <Check label="Include time" value={g.withTime} onChange={(v) => patch(i, { withTime: v })} />
                    <Check label="Printed-name line" value={g.withName} onChange={(v) => patch(i, { withName: v })} />
                    <Check label="Pentablet signature button" value={g.withPentablet}
                        onChange={(v) => patch(i, { withPentablet: v })} />
                    <Check label="Staff dropdown" value={g.withSelect} onChange={(v) => patch(i, { withSelect: v })} />
                    {g.withSelect && (
                        <Text label="Dropdown field name" value={g.selectField}
                            placeholder={`dokter${i + 1}`} onChange={(v) => patch(i, { selectField: v })} />
                    )}
                    <div className="hintbox">
                        generated ids: <code>paraf_{i + 1}</code>, <code>paraf_txt_{i + 1}</code>
                        {g.withDate && <>, <code>tgl_ttd_{i + 1}</code></>}
                    </div>
                </div>
            ))}
            <button className="btn mini" onClick={() => onChange([...signs, makeSign("Petugas")])}>
                + Add signature
            </button>
        </div>
    );
}

/* ========================================================================== */
export default function Inspector({ form, sel, comp, row, letters, jump, onForm, onSection,
    onComp, onClear, stat }) {
    /* Tombol "⚙ Header & footer" di bilah atas melompat ke bagian ini dan
       memastikan lipatannya terbuka. */
    const headerRef = useRef(null);
    useEffect(() => {
        if (!jump || !headerRef.current) return;
        headerRef.current.querySelectorAll("details").forEach((d) => { d.open = true; });
        headerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [jump]);

    /* ---------- pengaturan formulir ---------- */
    if (!sel) {
        const m = form.meta;
        const h = m.header || {};
        const f = m.footer || {};
        const pg = m.paging || {};
        const setH = (patch) => onForm({ header: { ...h, ...patch } });
        const setF = (patch) => onForm({ footer: { ...f, ...patch } });
        const setP = (patch) => onForm({ paging: { ...pg, ...patch } });

        return (
            <div className="insp">
                <div className="hintbox">
                    These settings apply to the whole form. Click a cell on the canvas to
                    edit a component instead.
                </div>
                <Text label="Form title" value={m.title} onChange={(v) => onForm({ title: v })} />
                <Text label="Document code (e.g. RM.1.1.6)" value={m.docCode} onChange={(v) => onForm({ docCode: v })} />
                <Check label="Letter sections automatically (A. B. C.)"
                    value={m.letterSections} onChange={(v) => onForm({ letterSections: v })} />
                <Sel label="Page width on screen" value={m.pageWidth} onChange={(v) => onForm({ pageWidth: v })}
                    options={[{ v: "none", t: "Follow the application panel" },
                    { v: "210mm", t: "A4 (210mm)" },
                    { v: "215mm", t: "F4 / Folio (215mm)" }]} />

                {/* ---------------- KOP ---------------- */}
                <div ref={headerRef} />
                <Group title="Letterhead" open>
                    <Check label="Show letterhead" value={m.showHeader} onChange={(v) => onForm({ showHeader: v })} />
                    {m.showHeader && (<>
                        <Check label="Show logo" value={h.showLogo} onChange={(v) => setH({ showLogo: v })} />
                        {h.showLogo && (<>
                            <Text label="Logo source" value={h.logoSrc} onChange={(v) => setH({ logoSrc: v })} />
                            <Text label="Logo width (mm / px / %)" value={h.logoWidth}
                                placeholder="18mm" onChange={(v) => setH({ logoWidth: v })} />
                        </>)}
                        <Text label="Hospital name" value={h.hospitalName}
                            onChange={(v) => setH({ hospitalName: v })} />
                        <Area label="Address & contact (one line here = one printed line)"
                            value={h.addressLines} rows={3} onChange={(v) => setH({ addressLines: v })} />
                        <div className="chips">
                            {["{RS_NAMA}", "{RS_ALAMAT}", "{RS_TELEPON}", "{RS_FAX}", "{RS_EMAIL}"].map((ph) => (
                                <button key={ph} className="chip"
                                    onClick={() => setH({ addressLines: (h.addressLines || "") + ph })}>{ph}</button>
                            ))}
                        </div>
                        <Check label="Show form title in the letterhead" value={h.showTitle !== false}
                            onChange={(v) => setH({ showTitle: v })} />
                        <Check label="Show document code in the letterhead" value={h.showDocCode !== false}
                            onChange={(v) => setH({ showDocCode: v })} />
                        <Text label="Extra line in the letterhead (HTML allowed)" value={h.extraHtml}
                            onChange={(v) => setH({ extraHtml: v })} />
                        <Check label="Show patient identity box" value={h.showIdent !== false}
                            onChange={(v) => setH({ showIdent: v })} />
                        {h.showIdent !== false && (<>
                            <div className="two">
                                <Text label="Identity box width" value={h.identWidth} placeholder="100%"
                                    onChange={(v) => setH({ identWidth: v })} />
                                <Sel label="Position inside its side" value={h.identAlign || "kanan"}
                                    onChange={(v) => setH({ identAlign: v })}
                                    options={[{ v: "kiri", t: "Left" }, { v: "tengah", t: "Centre" },
                                    { v: "kanan", t: "Right" }]} />
                            </div>
                            <div className="chips">
                                {["100%", "90%", "80%", "70mm", "62mm", "45mm"].map((w) => (
                                    <button key={w} className={"chip" + (h.identWidth === w ? " on" : "")}
                                        onClick={() => setH({ identWidth: w })}>{w}</button>
                                ))}
                            </div>
                            <div className="two">
                                <Text label="Label column width" value={h.identKeyWidth} placeholder="1fr"
                                    onChange={(v) => setH({ identKeyWidth: v })} />
                                <Text label="Value column width" value={h.identValueWidth} placeholder="30mm"
                                    onChange={(v) => setH({ identValueWidth: v })} />
                            </div>
                            <div className="fld">
                                <span className="fld-title">Identity text size (empty = 9.5pt default)</span>
                                <input type="text" value={h.identFontSize ?? ""} placeholder="9.5pt"
                                    onChange={(e) => setH({ identFontSize: e.target.value })} />
                                <div className="chips">
                                    {["", "8pt", "9pt", "9.5pt", "10pt", "11pt"].map((f2) => (
                                        <button key={f2 || "auto"} className={"chip" + ((h.identFontSize || "") === f2 ? " on" : "")}
                                            onClick={() => setH({ identFontSize: f2 })}>{f2 || "default"}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="hintbox">
                                The identity box lives inside whichever side you chose below, and
                                its width is measured <b>against that side</b> — so
                                <code> 80%</code> means 80% of the right column, not of the page.
                            </div>
                            <IdentList rows={h.ident || []} onChange={(v) => setH({ ident: v })} />
                            <div className="fld">
                                <span className="fld-title">Quick add a system-value row</span>
                                <div className="chips">
                                    {PLACEHOLDERS.slice(0, 9).map((ph) => (
                                        <button key={ph} className="chip" onClick={() => setH({
                                            ident: [...(h.ident || []),
                                            { ...makeIdentRow(ph.replace(/[{}]/g, "")), value: ph }],
                                        })}>{ph}</button>
                                    ))}
                                </div>
                            </div>
                        </>)}
                        {pg.enabled && (
                            <Check label="Repeat letterhead on every page" value={h.everyPage}
                                onChange={(v) => setH({ everyPage: v })} />
                        )}

                        {/* ---- pembagian sisi kiri / kanan ---- */}
                        <div className="subhead">Two-sided layout</div>
                        <Check label="Split the letterhead into a left and a right side"
                            value={h.split !== false} onChange={(v) => setH({ split: v })} />
                        {h.split !== false && (<>
                            <div className="two">
                                <Text label="Left side width" value={h.leftWidth} placeholder="1fr"
                                    onChange={(v) => setH({ leftWidth: v })} />
                                <Text label="Right side width" value={h.rightWidth} placeholder="62mm"
                                    onChange={(v) => setH({ rightWidth: v })} />
                            </div>
                            <div className="chips">
                                {[["1fr", "62mm"], ["1fr", "40%"], ["50%", "50%"], ["60%", "40%"], ["2fr", "1fr"]].map(([a, c]) => (
                                    <button key={a + c} className="chip"
                                        onClick={() => setH({ leftWidth: a, rightWidth: c })}>{a} / {c}</button>
                                ))}
                            </div>
                            <div className="two">
                                <Sel label="Left side alignment" value={h.leftAlign || "kiri"}
                                    onChange={(v) => setH({ leftAlign: v })}
                                    options={[{ v: "kiri", t: "Left" }, { v: "tengah", t: "Centre" },
                                    { v: "kanan", t: "Right" }]} />
                                <Sel label="Right side alignment" value={h.rightAlign || "kanan"}
                                    onChange={(v) => setH({ rightAlign: v })}
                                    options={[{ v: "kiri", t: "Left" }, { v: "tengah", t: "Centre" },
                                    { v: "kanan", t: "Right" }]} />
                            </div>
                            <Check label="Divider line between the two sides" value={h.divider !== false}
                                onChange={(v) => setH({ divider: v })} />
                            <div className="fld">
                                <span className="fld-title">Which side each block sits on</span>
                                {[["logoSide", "Logo"], ["infoSide", "Hospital name & address"],
                                ["titleSide", "Form title & document code"],
                                ["identSide", "Patient identity box"]].map(([k, t]) => (
                                    <div className="opt-row" key={k}>
                                        <span className="opt-name">{t}</span>
                                        <select value={h[k] || "kiri"} onChange={(e) => setH({ [k]: e.target.value })}>
                                            <option value="kiri">Left</option>
                                            <option value="kanan">Right</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <div className="hintbox">
                                Widths accept <code>fr</code>, <code>%</code>, <code>mm</code>, and
                                <code> px</code> — e.g. <code>1fr</code> + <code>62mm</code> keeps the
                                identity box a fixed size while the hospital block takes the rest.
                                If every block ends up on one side, the letterhead simply becomes a
                                single column.
                            </div>
                        </>)}
                    </>)}
                </Group>

                {/* ---------------- FOOTER ---------------- */}
                <Group title="Footer & signatures" open>
                    <Check label="Show footer" value={m.showFooter} onChange={(v) => onForm({ showFooter: v })} />
                    {m.showFooter && (<>
                        <div className="subhead">Two-sided layout</div>
                        <Check label="Split the footer into a left and a right side"
                            value={!!f.split} onChange={(v) => setF({ split: v })} />
                        {f.split ? (<>
                            <div className="two">
                                <Text label="Left side width" value={f.leftWidth} placeholder="1fr"
                                    onChange={(v) => setF({ leftWidth: v })} />
                                <Text label="Right side width" value={f.rightWidth} placeholder="1fr"
                                    onChange={(v) => setF({ rightWidth: v })} />
                            </div>
                            <div className="chips">
                                {[["1fr", "1fr"], ["60%", "40%"], ["30%", "70%"], ["1fr", "70mm"]].map(([a, c]) => (
                                    <button key={a + c} className="chip"
                                        onClick={() => setF({ leftWidth: a, rightWidth: c })}>{a} / {c}</button>
                                ))}
                            </div>
                            <div className="two">
                                <Sel label="Left side alignment" value={f.leftAlign || "kiri"}
                                    onChange={(v) => setF({ leftAlign: v })}
                                    options={[{ v: "kiri", t: "Left" }, { v: "tengah", t: "Centre" },
                                    { v: "kanan", t: "Right" }]} />
                                <Sel label="Right side alignment" value={f.rightAlign || "kanan"}
                                    onChange={(v) => setF({ rightAlign: v })}
                                    options={[{ v: "kiri", t: "Left" }, { v: "tengah", t: "Centre" },
                                    { v: "kanan", t: "Right" }]} />
                            </div>
                            <Sel label="Which side holds the note" value={f.noteSide || "kiri"}
                                onChange={(v) => setF({ noteSide: v })}
                                options={[{ v: "kiri", t: "Left side" }, { v: "kanan", t: "Right side" }]} />
                            <div className="hintbox">
                                Each signature card below has its own <b>Side</b> selector, so
                                e.g. the patient signs on the left and the nurse on the right.
                            </div>
                        </>) : (
                            <Sel label="Signature alignment" value={f.align || "kanan"}
                                onChange={(v) => setF({ align: v })}
                                options={[{ v: "kanan", t: "Right" }, { v: "kiri", t: "Left" },
                                { v: "tengah", t: "Centre" },
                                { v: "rata", t: "Spread evenly" }]} />
                        )}
                        <Text label="Small note in the footer (HTML allowed)" value={f.note}
                            onChange={(v) => setF({ note: v })} />
                        <Check label="Print-date line {TGL_CETAK}" value={f.showPrintDate}
                            onChange={(v) => setF({ showPrintDate: v })} />
                        {pg.enabled && (
                            <Check label="Repeat footer on every page" value={f.everyPage}
                                onChange={(v) => setF({ everyPage: v })} />
                        )}
                        <SignList signs={f.signs || []} split={!!f.split}
                            onChange={(v) => setF({ signs: v })} />
                    </>)}
                </Group>

                {/* ---------------- PAGING ---------------- */}
                <Group title="Pages (paging)" open={pg.enabled}>
                    <Check label="Split this form into pages" value={pg.enabled}
                        onChange={(v) => setP({ enabled: v })} />
                    <div className="hintbox">
                        Each page becomes <code>&lt;fieldset id="{pg.idPrefix || "dokumen_page_"}N"&gt;</code>;
                        inactive pages get class <code>{pg.hiddenClass || "hidden"}</code> and a
                        <code> &lt;ul class="pagination"&gt;</code> switches between them — exactly the
                        markup your application already uses.
                    </div>
                    {pg.enabled && (<>
                        <div className="two">
                            <Text label="Navigation label" value={pg.label} onChange={(v) => setP({ label: v })} />
                            <Text label="Switch function" value={pg.functionName}
                                onChange={(v) => setP({ functionName: v })} />
                        </div>
                        <div className="two">
                            <Text label="Fieldset id prefix" value={pg.idPrefix} onChange={(v) => setP({ idPrefix: v })} />
                            <Text label="Hidden class" value={pg.hiddenClass} onChange={(v) => setP({ hiddenClass: v })} />
                        </div>
                        <Check label="Navigation above the form" value={pg.navTop} onChange={(v) => setP({ navTop: v })} />
                        <Check label="Navigation below the form" value={pg.navBottom} onChange={(v) => setP({ navBottom: v })} />
                        <Check label="Include the page-switch script" value={pg.includeScript}
                            onChange={(v) => setP({ includeScript: v })} />
                        <Check label="Print all pages, not only the visible one" value={pg.printAll}
                            onChange={(v) => setP({ printAll: v })} />
                        <div className="hintbox">
                            The script is only defined when the application does not already
                            provide <code>{pg.functionName || "NextPage"}()</code>, so the built-in
                            function always wins.
                        </div>
                    </>)}
                </Group>

                {/* ---------------- ATRIBUT APLIKASI ---------------- */}
                <Group title="Application-specific attributes">
                    <div className="hintbox">
                        Added automatically to every generated field.
                    </div>
                    <Text label="Field attribute" value={m.fieldAttr} onChange={(v) => onForm({ fieldAttr: v })} />
                    <div className="two">
                        <Text label="Form class" value={m.formClass} onChange={(v) => onForm({ formClass: v })} />
                        <Text label="data-ttd" value={m.dataTtd} onChange={(v) => onForm({ dataTtd: v })} />
                        <Check label="Embed editable model in exported HTML (exact re-import)"
                            value={m.embedModel !== false}
                            onChange={(v) => onForm({ embedModel: v })} />
                    </div>
                    <Text label="Datepicker class" value={m.dateClass} onChange={(v) => onForm({ dateClass: v })} />
                </Group>

                {stat.dup.length > 0 && (
                    <div className="warn">
                        <b>Duplicate field names:</b> {stat.dup.join(", ")}.<br />
                        Two fields with the same <code>name</code> overwrite each other on save.
                    </div>
                )}
            </div>
        );
    }

    /* ---------- section ---------- */
    if (!comp) {
        const s = form.sections[sel.sec];
        return (
            <div className="insp">
                <Text label="Section title" value={s.title} onChange={(v) => onSection({ title: v })} />
                {form.meta.paging?.enabled && (
                    <Num label="Page number" value={s.page || 1} min="1"
                        onChange={(v) => onSection({ page: Math.max(1, v) })} />
                )}
                <div className="hintbox">
                    Section {sel.sec + 1}, containing {s.rows.length} row{s.rows.length === 1 ? "" : "s"}.
                    {form.meta.letterSections && <> Letter <b>{(letters || {})[sel.sec] || "?"}.</b> is added automatically.</>}
                    <br />The <b>⌸ Block</b> button in the section header saves this layout as a
                    reusable block.
                    <br />Looking for the letterhead, footer or pages? Switch to the
                    <b> Form</b> tab above.
                </div>
            </div>
        );
    }

    /* ---------- komponen ---------- */
    const p = (patch) => onComp(patch);
    const maxSpan = row ? row.cols : 1;
    const fieldNameBox = (
        <>
            <Text label="Field name (name attribute)" value={comp.field}
                onChange={(v) => p({ field: v })} placeholder="e.g. tekanan_darah" />
            {!comp.field && <div className="hintbox">Without a <code>name</code> this field is never saved.</div>}
        </>
    );

    /* lebar kolom yang ditempati sel — hanya berguna bila barisnya multi-kolom */
    const spanBox = maxSpan > 1 ? (
        <div className="fld">
            <span className="fld-title">Column span (row has {maxSpan} columns)</span>
            <div className="chips">
                {Array.from({ length: maxSpan }, (_, i) => i + 1).map((n) => (
                    <button key={n} className={"chip" + ((comp.span || 1) === n ? " on" : "")}
                        onClick={() => p({ span: n })}>{n === 1 ? "1 column" : `${n} columns`}</button>
                ))}
            </div>
        </div>
    ) : null;

    /* tata letak label + lebar isian — dipakai hampir semua komponen isian */
    const tataLetak = (opt = {}) => (
        <Group title="Layout & size">
            <Sel label="Label position" value={comp.layout || "atas"} onChange={(v) => p({ layout: v })}
                options={[{ v: "atas", t: "Label above the field" },
                { v: "samping", t: "Label : value (side by side)" }]} />
            {comp.layout === "samping" && (<>
                <Text label="Label column width (px / % / mm)" value={comp.labelWidth}
                    placeholder="160px" onChange={(v) => p({ labelWidth: v })} />
                <Check label="Show the colon" value={comp.colon !== false}
                    onChange={(v) => p({ colon: v })} />
            </>)}
            {!opt.tanpaLebar && (
                <Size label="Field width" value={comp.width} onChange={(v) => p({ width: v })}
                    hint="Percent (50%), pixels (120px), or millimetres (40mm) all work." />
            )}
            {spanBox}
        </Group>
    );

    const umum = (
        <>
            <Text label="Label" value={comp.label} onChange={(v) => p({ label: v })} />
            {fieldNameBox}
            <Check label="Required (red asterisk)" value={comp.required} onChange={(v) => p({ required: v })} />
            <Text label="Helper text" value={comp.hint} onChange={(v) => p({ hint: v })} />
        </>
    );

    return (
        <div className="insp">
            <div className="fld inline" style={{ justifyContent: "space-between" }}>
                <span style={{ fontWeight: "bold" }}>{comp.type}</span>
                <button className="btn mini danger" onClick={onClear}>Clear cell</button>
            </div>

            {comp.type === "text" && (<>
                {umum}
                <div className="two">
                    <Text label="Trailing unit" value={comp.unit} onChange={(v) => p({ unit: v })} />
                    <Text label="Placeholder" value={comp.placeholder} onChange={(v) => p({ placeholder: v })} />
                </div>
                <Text label="Initial value" value={comp.value} onChange={(v) => p({ value: v })} />
                <div className="chips">
                    {PLACEHOLDERS.map((ph) => (
                        <button key={ph} className="chip" onClick={() => p({ value: ph })}>{ph}</button>
                    ))}
                </div>
                <Check label="Show as a full box" value={comp.boxed} onChange={(v) => p({ boxed: v })} />
                <Check label="Read only" value={comp.readOnly} onChange={(v) => p({ readOnly: v })} />
                {tataLetak()}
            </>)}

            {comp.type === "number" && (<>
                {umum}
                <div className="two">
                    <Text label="Unit" value={comp.unit} onChange={(v) => p({ unit: v })} />
                    <Text label="Placeholder" value={comp.placeholder} onChange={(v) => p({ placeholder: v })} />
                </div>
                <div className="three">
                    <Text label="Min" value={comp.min} onChange={(v) => p({ min: v })} />
                    <Text label="Max" value={comp.max} onChange={(v) => p({ max: v })} />
                    <Text label="Step" value={comp.step} onChange={(v) => p({ step: v })} />
                </div>
                <Check label="Full box" value={comp.boxed} onChange={(v) => p({ boxed: v })} />
                <Check label="Read only (filled by script)" value={comp.readOnly} onChange={(v) => p({ readOnly: v })} />
                {tataLetak()}
            </>)}

            {comp.type === "textarea" && (<>
                {umum}
                <div className="two">
                    <Num label="Rows" value={comp.rows} min="2" onChange={(v) => p({ rows: v })} />
                    <Text label="Placeholder" value={comp.placeholder} onChange={(v) => p({ placeholder: v })} />
                </div>
                <Check label="Ruled like paper" value={comp.ruled} onChange={(v) => p({ ruled: v })} />
                <Check label="Full box" value={comp.boxed} onChange={(v) => p({ boxed: v })} />
                {tataLetak()}
            </>)}

            {comp.type === "date" && (<>
                {umum}
                <Check label="Include time" value={comp.withTime} onChange={(v) => p({ withTime: v })} />
                <Text label="Placeholder" value={comp.placeholder} onChange={(v) => p({ placeholder: v })} />
                {tataLetak()}
            </>)}

            {comp.type === "time" && (<>
                {umum}
                <div className="two">
                    <Text label="Trailing text" value={comp.suffix} onChange={(v) => p({ suffix: v })} />
                    <Text label="Placeholder" value={comp.placeholder} onChange={(v) => p({ placeholder: v })} />
                </div>
                {tataLetak()}
            </>)}

            {comp.type === "daterange" && (<>
                <Text label="Label" value={comp.label} onChange={(v) => p({ label: v })} />
                <div className="two">
                    <Text label="Start field name" value={comp.field} onChange={(v) => p({ field: v })} />
                    <Text label="End field name" value={comp.fieldTo} onChange={(v) => p({ fieldTo: v })} />
                </div>
                <div className="two">
                    <Text label="Joining word" value={comp.separator} onChange={(v) => p({ separator: v })} />
                    <Text label="Helper text" value={comp.hint} onChange={(v) => p({ hint: v })} />
                </div>
                <Check label="Required" value={comp.required} onChange={(v) => p({ required: v })} />
                {tataLetak()}
            </>)}

            {comp.type === "select" && (<>
                {umum}
                <Sel label="Options source" value={comp.kind || "static"} onChange={(v) => p({ kind: v })}
                    options={[{ v: "static", t: "Static list" }, { v: "dynamic", t: "Dynamic (Tera placeholder)" }]} />
                {(comp.kind || "static") === "static" ? (<>
                    <Text label="Empty-choice text" value={comp.firstBlank} onChange={(v) => p({ firstBlank: v })} />
                    <PairList label="Choices" items={comp.options} onChange={(v) => p({ options: v })}
                        cols={[{ k: "label", p: "Label" }, { k: "value", p: "Value (kosong = ikut label)" }]}
                        blank={{ label: "Opsi baru", value: "" }} />
                </>) : (<>
                    <Area label="Dynamic options (raw HTML / Tera placeholder)" rows={3}
                        value={comp.dynamicOptions} onChange={(v) => p({ dynamicOptions: v })} />
                    <div className="chips">
                        {PLACEHOLDERS.map((ph) => (
                            <button key={ph} className="chip"
                                onClick={() => p({ dynamicOptions: (comp.dynamicOptions || "") + ph })}>{ph}</button>
                        ))}
                    </div>
                    <div className="hintbox">
                        Isi disisipkan mentah di dalam <code>&lt;select&gt;...&lt;/select&gt;</code> —
                        cocok buat placeholder Tera yang di-render backend jadi daftar <code>&lt;option&gt;</code>.
                    </div>
                </>)}
                {tataLetak()}
            </>)}

            {comp.type === "boxes" && (<>
                {umum}
                <Num label="Number of boxes" value={comp.count} min="1" max="30" onChange={(v) => p({ count: v })} />
                <div className="hintbox">
                    Every box produces <code>name="{comp.field || "field"}[]"</code> — the
                    application receives one array entry per character.
                </div>
                {tataLetak({ tanpaLebar: true })}
            </>)}

            {comp.type === "hidden" && (<>
                {fieldNameBox}
                <Text label="Value" value={comp.value} onChange={(v) => p({ value: v })} />
                <div className="chips">
                    {PLACEHOLDERS.map((ph) => (
                        <button key={ph} className="chip" onClick={() => p({ value: ph })}>{ph}</button>
                    ))}
                </div>
            </>)}

            {(comp.type === "checkbox" || comp.type === "radio") && (<>
                {umum}
                <PairList label="Options" items={comp.options} onChange={(v) => p({ options: v })}
                    cols={[{ k: "label", p: "Label" }, { k: "value", p: "Value (kosong = ikut label)" }]}
                    blank={{ label: "Opsi baru", value: "" }} />
                <Num label="Option columns (0 = flowing)" value={comp.columns} min="0" max="5"
                    onChange={(v) => p({ columns: v })} />
                <Text label='Field name for the "Other" fill-in (leave empty if unused)'
                    value={comp.otherField} onChange={(v) => p({ otherField: v })} />
                {tataLetak({ tanpaLebar: true })}
            </>)}

            {comp.type === "checkfill" && (<>
                {umum}
                <PairList label="Options (fill the name column when the option needs a write-in)"
                    items={comp.items} onChange={(v) => p({ items: v })}
                    cols={[{ k: "text", p: "Option text" }, { k: "field", p: "fill-in name" }]}
                    blank={{ text: "New option", field: "" }} />
                <div className="two">
                    <Num label="Columns (0 = flowing)" value={comp.columns} min="0" max="5"
                        onChange={(v) => p({ columns: v })} />
                    <Text label="Fill-in width" value={comp.fillWidth} onChange={(v) => p({ fillWidth: v })} />
                </div>
                {tataLetak({ tanpaLebar: true })}
            </>)}

            {comp.type === "scale" && (<>
                {umum}
                <div className="two">
                    <Num label="Lowest number" value={comp.min} onChange={(v) => p({ min: v })} />
                    <Num label="Highest number" value={comp.max} onChange={(v) => p({ max: v })} />
                </div>
                <div className="two">
                    <Text label="Left caption" value={comp.leftLabel} onChange={(v) => p({ leftLabel: v })} />
                    <Text label="Right caption" value={comp.rightLabel} onChange={(v) => p({ rightLabel: v })} />
                </div>
                {tataLetak({ tanpaLebar: true })}
            </>)}

            {comp.type === "score" && (<>
                {umum}
                <div className="two">
                    <Text label="Unit" value={comp.unit} onChange={(v) => p({ unit: v })} />
                    <Text label="Scoring note" value={comp.note} onChange={(v) => p({ note: v })} />
                </div>
                <Check label="Full box" value={comp.boxed} onChange={(v) => p({ boxed: v })} />
                <Check label="Read only (filled by script)" value={comp.readOnly} onChange={(v) => p({ readOnly: v })} />
                {tataLetak()}
            </>)}

            {comp.type === "kv" && (<>
                <Text label="Label" value={comp.label} onChange={(v) => p({ label: v })} />
                <Sel label="Value type" value={comp.kind || "text"} onChange={(v) => p({ kind: v })}
                    options={[{ v: "text", t: "Text" }, { v: "number", t: "Number" },
                    { v: "date", t: "Date (datepicker)" }, { v: "time", t: "Time" },
                    { v: "select", t: "Dropdown" }, { v: "static", t: "System value" }]} />
                {comp.kind !== "static" && fieldNameBox}
                {comp.kind === "select" && (
                    <PairList label="Choices" items={comp.options || []} onChange={(v) => p({ options: v })}
                        cols={[{ k: "label", p: "Label" }, { k: "value", p: "Value (kosong = ikut label)" }]}
                        blank={{ label: "Opsi baru", value: "" }} />
                )}
                {comp.kind === "static" && (<>
                    <Text label="Value" value={comp.value} onChange={(v) => p({ value: v })} />
                    <div className="chips">
                        {PLACEHOLDERS.map((ph) => (
                            <button key={ph} className="chip" onClick={() => p({ value: ph })}>{ph}</button>
                        ))}
                    </div>
                </>)}
                <div className="two">
                    <Text label="Label column width" value={comp.labelWidth} onChange={(v) => p({ labelWidth: v })} />
                    <Text label="Value width" value={comp.width} onChange={(v) => p({ width: v })} />
                </div>
                <div className="two">
                    <Text label="Unit" value={comp.unit} onChange={(v) => p({ unit: v })} />
                    <Text label="Helper text" value={comp.hint} onChange={(v) => p({ hint: v })} />
                </div>
                <Check label="Centre the value" value={comp.center} onChange={(v) => p({ center: v })} />
                <Check label="Required" value={comp.required} onChange={(v) => p({ required: v })} />
                {spanBox}
            </>)}

            {comp.type === "static" && (<>
                <Text label="Label" value={comp.label} onChange={(v) => p({ label: v })} />
                <Text label="Value / placeholder" value={comp.value} onChange={(v) => p({ value: v })} />
                <div className="chips">
                    {PLACEHOLDERS.map((ph) => (
                        <button key={ph} className="chip" onClick={() => p({ value: ph })}>{ph}</button>
                    ))}
                </div>
                <Check label="Bold" value={comp.strong} onChange={(v) => p({ strong: v })} />
                <Text label="Helper text" value={comp.hint} onChange={(v) => p({ hint: v })} />
                {tataLetak({ tanpaLebar: true })}
            </>)}

            {comp.type === "matrix" && (<>
                <Text label="Small caption above the table" value={comp.title} onChange={(v) => p({ title: v })} />
                <Text label="Item column heading" value={comp.itemHeader} onChange={(v) => p({ itemHeader: v })} />
                <OptionList label="Choice columns" items={comp.choices} onChange={(v) => p({ choices: v })} placeholder="Choice" />
                <Text label="Note column heading (leave empty to omit)"
                    value={comp.noteColumn} onChange={(v) => p({ noteColumn: v })} />
                <Check label="One choice per row (radio)" value={comp.single} onChange={(v) => p({ single: v })} />
                <PairList label="Items" items={comp.items} onChange={(v) => p({ items: v })}
                    cols={[{ k: "text", p: "Item text" }, { k: "field", p: "name" },
                    { k: "noteField", p: "note name" }]}
                    blank={{ text: "New item", field: "", noteField: "" }} />
                <div className="hintbox">
                    Leave <b>note name</b> empty to use <code>name_ket</code> automatically.
                </div>
                {spanBox}
            </>)}

            {comp.type === "table" && (<>
                <PairList label="Columns" items={comp.columns} onChange={(v) => p({ columns: v })}
                    cols={[{ k: "head", p: "Heading" }, { k: "field", p: "name" }, { k: "width", p: "width" }]}
                    blank={{ head: "Column", field: "", width: "" }} />
                <div className="hintbox">
                    Column width accepts <code>25%</code>, <code>90px</code>, or may be left empty.
                </div>
                <div className="two">
                    <Num label="Rows" value={comp.rows} min="1" onChange={(v) => p({ rows: v })} />
                    <Text label="Button text" value={comp.addLabel} onChange={(v) => p({ addLabel: v })} />
                </div>
                <Check label="Number the rows" value={comp.numbered} onChange={(v) => p({ numbered: v })} />
                <Check label="Add-row button" value={comp.addButton} onChange={(v) => p({ addButton: v })} />
                {spanBox}
            </>)}

            {comp.type === "paragraph" && (<>
                <Area label="Content (HTML allowed)" value={comp.html} rows={4} onChange={(v) => p({ html: v })} />
                <Check label="Bold" value={comp.strong} onChange={(v) => p({ strong: v })} />
                <Check label="Centred" value={comp.center} onChange={(v) => p({ center: v })} />
                {spanBox}
            </>)}

            {comp.type === "subtitle" && (<>
                <Text label="Text" value={comp.text} onChange={(v) => p({ text: v })} />
                <Check label="Italic" value={comp.italic} onChange={(v) => p({ italic: v })} />
                {spanBox}
            </>)}

            {comp.type === "list" && (<>
                <Sel label="Marker" value={comp.marker} onChange={(v) => p({ marker: v })}
                    options={[{ v: "decimal", t: "1. 2. 3." }, { v: "alpha", t: "a. b. c." },
                    { v: "disc", t: "• bullet" }, { v: "circle", t: "◦ circle" },
                    { v: "none", t: "no marker" }]} />
                <ListItems items={comp.items} onChange={(v) => p({ items: v })} />
                {spanBox}
            </>)}

            {comp.type === "note" && (<>
                <Area label="Note content (HTML allowed)" value={comp.html} rows={3} onChange={(v) => p({ html: v })} />
                <Check label="No background (thin border only)" value={comp.plain} onChange={(v) => p({ plain: v })} />
                {spanBox}
            </>)}

            {comp.type === "image" && (<>
                <Text label="Image source (src)" value={comp.src} onChange={(v) => p({ src: v })}
                    placeholder="{V_PETH}img/bodymap.png" />
                <div className="two">
                    <Text label="Alternative text" value={comp.alt} onChange={(v) => p({ alt: v })} />
                    <Text label="Height" value={comp.height} onChange={(v) => p({ height: v })} />
                </div>
                <Text label="Caption" value={comp.caption} onChange={(v) => p({ caption: v })} />
                <Check label="Centred" value={comp.center} onChange={(v) => p({ center: v })} />
                {spanBox}
            </>)}

            {comp.type === "divider" && (<>
                <Check label="Dashed line" value={comp.dashed} onChange={(v) => p({ dashed: v })} />
                {spanBox}
            </>)}

            {comp.type === "spacer" && (<>
                <Text label="Height (px / mm)" value={comp.height} onChange={(v) => p({ height: v })} />
                {spanBox}
            </>)}

            {comp.type === "pagebreak" && (<>
                <div className="hintbox">
                    When printed, everything after this marker starts on a new sheet. On
                    screen it appears as a dashed blue line.
                </div>
                {spanBox}
            </>)}

            {comp.type === "signature" && (<>
                <div className="two">
                    <Text label="Role" value={comp.role} onChange={(v) => p({ role: v })} />
                    <Text label="City" value={comp.place} onChange={(v) => p({ place: v })} />
                </div>
                <Num label="Signature number" value={comp.parafIndex} min="1" onChange={(v) => p({ parafIndex: v })} />
                <Check label="Place & date line" value={comp.withDate} onChange={(v) => p({ withDate: v })} />
                <Check label="Include time" value={comp.withTime !== false} onChange={(v) => p({ withTime: v })} />
                <Check label="Printed-name line" value={comp.withName !== false} onChange={(v) => p({ withName: v })} />
                <Check label="Pentablet signature button" value={comp.withPentablet !== false}
                    onChange={(v) => p({ withPentablet: v })} />
                <Check label="Staff dropdown" value={comp.withSelect} onChange={(v) => p({ withSelect: v })} />
                {comp.withSelect && (
                    <Text label="Staff dropdown field" value={comp.selectField} onChange={(v) => p({ selectField: v })} />
                )}
                {spanBox}
            </>)}

            {comp.type === "button" && (<>
                <div className="two">
                    <Text label="Button text" value={comp.label} onChange={(v) => p({ label: v })} />
                    <Text label="Element id" value={comp.elementId} onChange={(v) => p({ elementId: v })} />
                </div>
                <Text label="Extra class" value={comp.extraClass} onChange={(v) => p({ extraClass: v })} />
                <div className="hintbox">
                    The button is screen-only (class <code>askep-no-print</code>). Wire its
                    action in the application script using the <code>id</code> above.
                </div>
                {spanBox}
            </>)}

            {comp.type === "html" && (<>
                <Area label="Raw HTML" value={comp.html} rows={8} onChange={(v) => p({ html: v })} />
                {spanBox}
            </>)}
        </div>
    );
}
