import { describe, expect, it } from "vitest";

import { buildTafDownloadTracks } from "./TafTrackDownloadModal";

describe("buildTafDownloadTracks", () => {
    it("makes one row per chapter and names them only when the titles fit", () => {
        expect(buildTafDownloadTracks(["a", "b"], [0, 10], 30).map((r) => r.title)).toEqual([
            "a",
            "b",
        ]);
        const rows = buildTafDownloadTracks(["a", "b", "c"], [0, 10], 30);
        expect(rows.map((r) => [r.number, r.title, r.durationSeconds])).toEqual([
            [1, "", 10],
            [2, "", 20],
        ]);
    });

    it("lists the titles when the chapters are unknown", () => {
        expect(buildTafDownloadTracks(["a", "b"], undefined, undefined)).toHaveLength(2);
    });
});
