"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.segmentsToSrt = segmentsToSrt;
const pad = (n, w = 2) => String(n).padStart(w, "0");
const pad3 = (n) => String(n).padStart(3, "0");
function toTS(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(ms)}`;
}
// Basic line wrapping: split long lines to ~42 chars, at whitespace when possible.
function wrapLines(text, maxLen = 42) {
    const words = text.trim().split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
        if ((cur + " " + w).trim().length <= maxLen) {
            cur = (cur ? cur + " " : "") + w;
        }
        else {
            if (cur)
                lines.push(cur);
            cur = w;
        }
    }
    if (cur)
        lines.push(cur);
    // limit to 2 lines (common subtitle convention)
    if (lines.length <= 2)
        return lines.join("\n");
    return lines.slice(0, 2).join("\n");
}
function segmentsToSrt(segs) {
    return segs
        .map((g, i) => {
        const safeText = (g.text ?? "").replace(/\s+/g, " ").trim();
        return `${i + 1}\n${toTS(g.start)} --> ${toTS(g.end)}\n${wrapLines(safeText)}\n`;
    })
        .join("\n");
}
