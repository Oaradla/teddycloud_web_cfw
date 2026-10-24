import type { SettingsState } from "../hooks/useSettings";
import { createPrintLayout, PrintPageLayout } from "../print/printLayout";

const fmt = (n: number) => Number(n.toFixed(3)).toString();

/**
 * the cut lines of one printed page, in millimetres: layer "Sheet" with the outline of the paper
 * to place it in the laser cutter, layer "Cut" with a circle or rectangle at every printed label
 */
export function cutSvg(page: PrintPageLayout, round: boolean): string {
    const { widthMm: pw, heightMm: ph } = page;
    const shapes = page.placements.map(({ xMm: x, yMm: y, widthMm: w, heightMm: h }) =>
        round
            ? `<circle cx="${fmt(x + w / 2)}" cy="${fmt(y + h / 2)}" r="${fmt(w / 2)}"/>`
            : `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"/>`,
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${fmt(pw)}mm" height="${fmt(ph)}mm" viewBox="0 0 ${fmt(pw)} ${fmt(ph)}">
  <g id="sheet" inkscape:groupmode="layer" inkscape:label="Sheet" fill="none" stroke="#0000ff" stroke-width="0.1">
    <rect x="0" y="0" width="${fmt(pw)}" height="${fmt(ph)}"/>
  </g>
  <g id="cut" inkscape:groupmode="layer" inkscape:label="Cut" fill="none" stroke="#ff0000" stroke-width="0.1">
    ${shapes.join("\n    ")}
  </g>
</svg>
`;
}

/**
 * the cut lines for `items` items, laid out like the PDF: one SVG for a full sheet (the same for
 * all full ones) and, when the last sheet is not full, one for it; file name to content
 */
export function cutFiles(s: SettingsState, items: number): Record<string, string> {
    const pages = createPrintLayout(items, s);
    const last = pages[pages.length - 1];
    const lastFull = createPrintLayout(items + 1, s).length > pages.length;
    const full = lastFull ? pages.length : pages.length - 1;
    const rest = lastFull ? 0 : new Set(last.placements.map((p) => p.itemIndex)).size;
    const round = s.labelShape === "round";
    const { widthMm: w, heightMm: h } = pages[0].placements[0] ?? { widthMm: 0, heightMm: 0 };
    const size = round ? `${fmt(w)}mm` : `${fmt(w)}x${fmt(h)}mm`;
    const name = `teddystudio-${s.paperSize.toLowerCase()}-${size}`;
    const files: Record<string, string> = {};
    if (full) files[`${name}-full-${full}x.svg`] = cutSvg(pages[0], round);
    if (rest) files[`${name}-last-${rest}.svg`] = cutSvg(last, round);
    return files;
}
