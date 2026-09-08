/* ==========================================================================
   client.js — komunikasi dengan backend askep (server-side persistence)
   ========================================================================== */

const BASE = "/api";

async function req(path, opts) {
    const res = await fetch(BASE + path, opts);
    if (res.status === 404) return null;
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `${opts?.method || "GET"} ${path} failed: ${res.status}`);
    }
    return res.json();
}

export function listProfiles() {
    return req("/profiles").then((r) => r || []);
}

export function listTargets() {
    return req("/targets").then((r) => r || []);
}

export function createTarget(name) {
    return req("/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
}

export function getTargetMetadata(name) {
    return req(`/targets/${encodeURIComponent(name)}/metadata`);
}

export async function previewTargetHtml(name) {
    const res = await fetch(`${BASE}/targets/${encodeURIComponent(name)}/preview`);
    if (!res.ok) throw new Error(`preview target failed: ${res.status}`);
    return res.text();
}

export function saveTargetMetadata(name, { metadata, html }) {
    return req(`/targets/${encodeURIComponent(name)}/metadata`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata, html }),
    });
}

export function saveTargetAttributes(name, attributes) {
    return req(`/targets/${encodeURIComponent(name)}/attributes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attributes),
    });
}

export async function syncTarget(name, profile, alid) {
    const res = await fetch(`${BASE}/targets/${encodeURIComponent(name)}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, alid }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error || `sync failed: ${res.status}`);
    return body;
}

export function listTargetScripts(name) {
    return req(`/targets/${encodeURIComponent(name)}/scripts`).then((r) => r || []);
}

export function createTargetScript(name, filename) {
    return req(`/targets/${encodeURIComponent(name)}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: filename }),
    });
}

export function getTargetScriptContent(name, id) {
    return req(`/targets/${encodeURIComponent(name)}/scripts/content?id=${encodeURIComponent(id)}`)
        .then((r) => r?.content ?? "");
}

export function saveTargetScriptContent(name, id, content) {
    return req(`/targets/${encodeURIComponent(name)}/scripts/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content }),
    });
}

export function deleteTargetScript(name, id) {
    return req(`/targets/${encodeURIComponent(name)}/scripts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
}

export function getBlocks() {
    return req("/blocks").then((r) => r || []);
}

export function saveBlocks(list) {
    return req("/blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(list),
    });
}
