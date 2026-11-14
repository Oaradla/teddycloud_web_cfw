import { afterEach, describe, expect, it, vi } from "vitest";

import { oldPlaylistParts } from "./partsUpload";

describe("oldPlaylistParts", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("names the TAFs of the folder that the new playlist does not contain", async () => {
        const files = [
            { name: "..", isDir: true },
            { name: "01 - Intro.taf" },
            { name: "02 - Old.taf" },
            { name: "Story.tap" },
            { name: "Story.tap.taf" },
            { name: "cover.jpg" },
        ];
        const fetch = vi.fn(async () => new Response(JSON.stringify({ files })));
        vi.stubGlobal("fetch", fetch);
        const old = await oldPlaylistParts({ folder: "/kids", name: "Story", titles: ["Intro"] });
        expect(old).toEqual(["02 - Old.taf"]);
        expect(String((fetch.mock.calls[0] as unknown[])[0])).toContain("path=%2Fkids%2FStory");
    });

    it("finds none when the folder does not exist", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("", { status: 404 })),
        );
        expect(await oldPlaylistParts({ folder: "", name: "X", titles: ["a"] })).toEqual([]);
    });
});
