import { describe, expect, it } from "vitest";

import type { SettingsState } from "../hooks/useSettings";
import { createPrintLayout } from "../print/printLayout";
import { cutFiles, cutSvg } from "./cutSvg";

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
    it("places circles and rectangles where the PDF prints the labels", () => {
        const round = cutSvg(createPrintLayout(5, settings())[0], true);
        expect(round.match(/<circle /g)).toHaveLength(5);
        expect(round).toContain('<circle cx="30" cy="30" r="20"/>');
        // A4 holds 4 columns, the fifth label starts the second row
        expect(round).toContain('<circle cx="30" cy="75" r="20"/>');
        expect(round).toContain('width="210mm" height="297mm"');

        const s = settings({ printMode: "ImageAndText", labelShape: "square" });
        const both = cutSvg(createPrintLayout(1, s)[0], false);
        expect(both).toContain('<rect x="10" y="10" width="40" height="30"/>');
        expect(both).toContain('<rect x="55" y="10" width="40" height="30"/>');
    });

    it("makes one file for the full sheets and one for the rest", () => {
        // A4 with 40 mm labels: 4 columns, 6 rows
        expect(Object.keys(cutFiles(settings(), 30))).toEqual([
            "teddystudio-a4-40mm-full-1x.svg",
            "teddystudio-a4-40mm-last-6.svg",
        ]);
        expect(Object.keys(cutFiles(settings(), 48))).toEqual(["teddystudio-a4-40mm-full-2x.svg"]);
        expect(Object.keys(cutFiles(settings(), 3))).toEqual(["teddystudio-a4-40mm-last-3.svg"]);
    });
});
