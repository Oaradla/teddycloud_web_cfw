import { describe, expect, it } from "vitest";

import { freshDatasets } from "./addFromTeddyCloud";
import { TonieInfo } from "../../../../types/tonieTypes";

const info = (patch: Partial<TonieInfo>): TonieInfo => ({
    series: "",
    episode: "",
    language: "de-de",
    model: "",
    picture: "",
    tracks: [],
    ...patch,
});

describe("freshDatasets", () => {
    it("adds each model once, skips those on the sheet and those without a title", () => {
        const fresh = freshDatasets(
            [
                info({ model: "10000001", series: "A", episode: "1", picture: "/a.png" }),
                info({ model: "10000001", series: "A", episode: "1" }),
                info({ model: "10000002", series: "B" }),
                info({ series: "Own", episode: "Album" }),
                info({ model: "10000003" }),
            ],
            [{ model: "10000002" }],
        );
        expect(fresh.map((d) => [d.model, d.text, d.episodes, d.pic])).toEqual([
            ["10000001", "A", "1", "/a.png"],
            ["", "Own", "Album", undefined],
        ]);
    });
});
