import type { SettingsState } from "../hooks/useSettings";

/** paper sizes in millimetres, portrait */
const PAPER_MM: Record<string, [number, number]> = {
    A4: [210, 297],
    A5: [148, 210],
    Letter: [215.9, 279.4],
};

/** a length setting ("5mm", "1.5cm", "0.5in" or a bare number in mm) in millimetres */
export const toMm = (value: string | number | undefined): number => {
    if (typeof value === "number") return value;
    const m = /^\s*(-?[\d.]+)\s*(mm|cm|in)?\s*$/i.exec(value ?? "");
    if (!m) return 0;
    const n = parseFloat(m[1]);
    const unit = (m[2] ?? "mm").toLowerCase();
    return unit === "cm" ? n * 10 : unit === "in" ? n * 25.4 : n;
};

export interface CutSheet {
    /** paper width and height */
    pw: number;
    ph: number;
    /** one label */
    w: number;
    h: number;
    round: boolean;
    /** labels per item: picture and text side by side, or one of them */
    perItem: number;
    /** items per row and rows per sheet */
    cols: number;
    rows: number;
    marginLeft: number;
    marginTop: number;
    gapX: number;
    gapY: number;
}

/**
 * where the labels go on a sheet, as the print layout puts them: the page margins top and left
 * (right and bottom are 0), the items in rows with the label spacing between all labels; an item
 * (picture and text) is never split over two rows
 */
export function cutSheet(s: SettingsState): CutSheet {
    const [pw, ph] =
        s.paperSize === "Custom"
            ? [toMm(s.customPaperWidth), toMm(s.customPaperHeight)]
            : (PAPER_MM[s.paperSize] ?? PAPER_MM.A4);
    const round = s.labelShape !== "square";
    const w = round ? toMm(s.diameter) : toMm(s.width);
    const h = round ? toMm(s.diameter) : toMm(s.height);
    const perItem = s.printMode === "ImageAndText" ? 2 : 1;
    const marginLeft = toMm(s.paperMarginLeft);
    const marginTop = toMm(s.paperMarginTop);
    const gapX = toMm(s.labelSpacingX);
    const gapY = toMm(s.labelSpacingY);
    const itemWidth = perItem * w + (perItem - 1) * gapX;
    const cols = Math.max(1, Math.floor((pw - marginLeft + gapX + 0.01) / (itemWidth + gapX)));
    const rows = Math.max(1, Math.floor((ph - marginTop + gapY + 0.01) / (h + gapY)));
    return { pw, ph, w, h, round, perItem, cols, rows, marginLeft, marginTop, gapX, gapY };
}

const fmt = (n: number) => Number(n.toFixed(3)).toString();

/**
 * the cut lines of one sheet with the first `items` items, in millimetres: layer "Sheet" with the
 * outline of the paper to place it in the laser cutter, layer "Cut" with a circle or rectangle at
 * every printed label
 */
export function cutSvg(sheet: CutSheet, items: number): string {
    const { pw, ph, w, h, round, perItem, cols, marginLeft, marginTop, gapX, gapY } = sheet;
    const shapes: string[] = [];
    for (let i = 0; i < items; i++) {
        const y = marginTop + Math.floor(i / cols) * (h + gapY);
        for (let j = 0; j < perItem; j++) {
            const x = marginLeft + ((i % cols) * perItem + j) * (w + gapX);
            shapes.push(
                round
                    ? `<circle cx="${fmt(x + w / 2)}" cy="${fmt(y + h / 2)}" r="${fmt(w / 2)}"/>`
                    : `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}"/>`,
            );
        }
    }
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
 * the cut lines for `items` items: one SVG for a full sheet (the same for all full ones) and,
 * when the last sheet is not full, one for it; file name to content
 */
export function cutFiles(s: SettingsState, items: number): Record<string, string> {
    const sheet = cutSheet(s);
    const perSheet = sheet.cols * sheet.rows;
    const full = Math.floor(items / perSheet);
    const rest = items % perSheet;
    const size = sheet.round ? `${fmt(sheet.w)}mm` : `${fmt(sheet.w)}x${fmt(sheet.h)}mm`;
    const name = `teddystudio-${s.paperSize.toLowerCase()}-${size}`;
    const files: Record<string, string> = {};
    if (full) files[`${name}-full-${full}x.svg`] = cutSvg(sheet, perSheet);
    if (rest) files[`${name}-last-${rest}.svg`] = cutSvg(sheet, rest);
    return files;
}
