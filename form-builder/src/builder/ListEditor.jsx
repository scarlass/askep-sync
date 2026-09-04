/* ==========================================================================
   ListEditor.jsx — editor butir list ber-isian di panel properti
   ==========================================================================
   Tiap butir = rangkaian segmen sebaris (teks / text field / dropdown /
   date / time / pilihan). Teks antarmuka: bahasa Inggris.
   ========================================================================== */

import React from "react";
import { makeListSeg, normaliseListItem } from "./model.js";

/* ==========================================================================
   Editor butir list ber-isian: tiap butir = rangkaian segmen sebaris
   (teks / text field / dropdown / date / time / pilihan).
   ========================================================================== */
export const SEG_LABEL = {
    text: "Text", field: "Text field", select: "Dropdown",
    date: "Date", time: "Time", choice: "Choice",
};

export function ListItems({ items, onChange }) {
    const setItem = (i, v) => onChange(items.map((x, j) => (j === i ? v : x)));
    const delItem = (i) => onChange(items.filter((_, j) => j !== i));
    const moveItem = (i, d) => {
        const a = [...items], j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]];
        onChange(a);
    };
    const addItem = () => onChange([...items, normaliseListItem("")]);

    return (
        <div className="fld">
            <span className="fld-title">List items</span>
            {items.map((it, i) => (
                <ListSegEditor key={i} item={it}
                    onChange={(v) => setItem(i, v)}
                    onUp={() => moveItem(i, -1)} onDown={() => moveItem(i, 1)}
                    onDelete={() => delItem(i)} no={i + 1} />
            ))}
            <button className="btn mini" onClick={addItem}>+ Add item</button>
        </div>
    );
}

function ListSegEditor({ item, onChange, onUp, onDown, onDelete, no }) {
    const segs = item.segs || [];
    const setSeg = (i, v) => onChange({ ...item, segs: segs.map((s, j) => (j === i ? v : s)) });
    const delSeg = (i) => onChange({ ...item, segs: segs.filter((_, j) => j !== i) });
    const moveSeg = (i, d) => {
        const a = [...segs], j = i + d;
        if (j < 0 || j >= a.length) return;
        [a[i], a[j]] = [a[j], a[i]];
        onChange({ ...item, segs: a });
    };
    const addSeg = (type) =>
        onChange({ ...item, segs: [...segs, makeListSeg(type, type === "text" ? { text: " " } : {})] });
    const setOpt = (i, v) =>
        setSeg(i, { ...segs[i], options: v.split(",").map((x) => x.trim()).filter(Boolean) });

    return (
        <div className="listitem">
            <div className="listitem-head">
                <b>Item {no}</b>
                <span className="sp" />
                <button className="btn mini" onClick={onUp}>↑</button>
                <button className="btn mini" onClick={onDown}>↓</button>
                <button className="btn mini danger" onClick={onDelete}>✕</button>
            </div>

            {segs.map((s, i) => (
                <div className="seg-row" key={i}>
                    <span className="seg-kind">{SEG_LABEL[s.type] || s.type}</span>
                    {s.type === "text" && (
                        <input type="text" value={s.text ?? ""} placeholder="Item text"
                            onChange={(e) => setSeg(i, { ...s, text: e.target.value })} />
                    )}
                    {(s.type === "field" || s.type === "date" || s.type === "time") && (<>
                        <input type="text" className="seg-name" value={s.field ?? ""} placeholder="name"
                            onChange={(e) => setSeg(i, { ...s, field: e.target.value })} />
                        <input type="text" className="seg-w" value={s.width ?? ""} placeholder="width"
                            onChange={(e) => setSeg(i, { ...s, width: e.target.value })} />
                    </>)}
                    {s.type === "field" && (
                        <input type="text" className="seg-w" value={s.placeholder ?? ""} placeholder="placeholder"
                            onChange={(e) => setSeg(i, { ...s, placeholder: e.target.value })} />
                    )}
                    {s.type === "field" && (
                        <select value={s.inputStyle || "garis"} title="Input style"
                            onChange={(e) => setSeg(i, { ...s, inputStyle: e.target.value })}>
                            <option value="garis">underline</option>
                            <option value="kotak">box</option>
                        </select>
                    )}
                    {s.type === "select" && (<>
                        <input type="text" className="seg-name" value={s.field ?? ""} placeholder="name"
                            onChange={(e) => setSeg(i, { ...s, field: e.target.value })} />
                        <input type="text" className="seg-w" value={s.width ?? ""} placeholder="width"
                            onChange={(e) => setSeg(i, { ...s, width: e.target.value })} />
                        <input type="text" className="seg-opsi" value={(s.options || []).join(", ")}
                            placeholder="options, comma separated"
                            onChange={(e) => setOpt(i, e.target.value)} />
                    </>)}
                    {s.type === "choice" && (<>
                        <select value={s.choice || "radio"} title="Choice type"
                            onChange={(e) => setSeg(i, { ...s, choice: e.target.value })}>
                            <option value="radio">radio</option>
                            <option value="check">checkbox</option>
                        </select>
                        <input type="text" className="seg-name" value={s.field ?? ""} placeholder="name"
                            onChange={(e) => setSeg(i, { ...s, field: e.target.value })} />
                        <input type="text" className="seg-opsi" value={(s.options || []).join(", ")}
                            placeholder="options, comma separated"
                            onChange={(e) => setOpt(i, e.target.value)} />
                    </>)}
                    <button className="btn mini" onClick={() => moveSeg(i, -1)} title="Move left">←</button>
                    <button className="btn mini" onClick={() => moveSeg(i, 1)} title="Move right">→</button>
                    <button className="btn mini danger" onClick={() => delSeg(i)}>✕</button>
                </div>
            ))}

            <div className="seg-add">
                {Object.keys(SEG_LABEL).map((t) => (
                    <button key={t} className="btn mini" onClick={() => addSeg(t)}>+ {SEG_LABEL[t]}</button>
                ))}
            </div>
        </div>
    );
}
