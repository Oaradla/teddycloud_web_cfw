import { describe, expect, it } from "vitest";

import type { SettingsState } from "../hooks/useSettings";
import { cutFiles, cutSheet, cutSvg, toMm } from "./cutSvg";

const settings = (patch: Partial<SettingsState> = {}): SettingsState =>
    ({
        diameter: "40mm",
        labelShape: "round",
        printMode: "OnlyImage",
        width: "40mm",
        height: "30mm",
        labelSpacingX: "5mm",
        labelSpacingY: "5mm",
        paperSize: "A4",
        customPaperWidth: "100mm",
        customPaperHeight: "100mm",
        paperMarginTop: "10mm",
        paperMarginLeft: "10mm",
        ...patch,
    }) as SettingsState;

describe("cutSvg", () => {
    it("reads lengths in mm, cm and inches", () => {
        expect(toMm("5mm")).toBe(5);
        expect(toMm("1.5cm")).toBe(15);
        expect(toMm("1in")).toBe(25.4);
        expect(toMm("7")).toBe(7);
        expect(toMm("")).toBe(0);
    });

    it("fits the labels between the top and left margin and the paper edge", () => {
        // A4: (210 - 10 + 5) / 45 = 4.5 -> 4 columns; (297 - 10 + 5) / 45 = 6.4 -> 6 rows
        const sheet = cutSheet(settings());
        expect([sheet.cols, sheet.rows]).toEqual([4, 6]);
        // picture and text side by side: (205) / (85 + 5) -> 2 items per row
        expect(cutSheet(settings({ printMode: "ImageAndText" })).cols).toBe(2);
        expect(cutSheet(settings({ paperSize: "Custom" })).cols).toBe(2);
    });

    it("places circles and rectangles where the labels are printed", () => {
        const round = cutSvg(cutSheet(settings()), 5);
        expect(round.match(/<circle /g)).toHaveLength(5);
        expect(round).toContain('<circle cx="30" cy="30" r="20"/>');
        // the fifth label starts the second row
        expect(round).toContain('<circle cx="30" cy="75" r="20"/>');
        expect(round).toContain('width="210mm" height="297mm"');

        const both = cutSvg(
            cutSheet(settings({ printMode: "ImageAndText", labelShape: "square" })),
            1,
        );
        expect(both).toContain('<rect x="10" y="10" width="40" height="30"/>');
        expect(both).toContain('<rect x="55" y="10" width="40" height="30"/>');
    });

    it("makes one file for the full sheets and one for the rest", () => {
        expect(Object.keys(cutFiles(settings(), 30))).toEqual([
            "teddystudio-a4-40mm-full-1x.svg",
            "teddystudio-a4-40mm-last-6.svg",
        ]);
        expect(Object.keys(cutFiles(settings(), 48))).toEqual(["teddystudio-a4-40mm-full-2x.svg"]);
    });
});
