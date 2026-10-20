import { describe, expect, it } from "vitest";

import { builtTafPath } from "./useTAPEditor";

describe("builtTafPath", () => {
    it("puts the TAF next to the playlist, named after it", () => {
        expect(builtTafPath("/Hörspiele/Album/", "Album.tap")).toBe(
            "lib://Hörspiele/Album/Album.tap.taf",
        );
        expect(builtTafPath("/", "Mix.tap")).toBe("lib://Mix.tap.taf");
    });
});
