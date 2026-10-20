import { describe, expect, it } from "vitest";

import { nameFor, shrinkImage } from "./shrinkImage";

describe("shrinkImage", () => {
    it("names the copy after the picture type", () => {
        expect(nameFor("cover.PNG", "image/webp")).toBe("cover.webp");
        expect(nameFor("a.b.jpeg", "image/png")).toBe("a.b.png");
        expect(nameFor("photo.heic", "image/jpeg")).toBe("photo.jpg");
        expect(nameFor("x.gif", "image/gif")).toBe("x.gif");
    });

    it("leaves files alone that are no pictures it can redraw", async () => {
        const svg = new File(["<svg/>"], "a.svg", { type: "image/svg+xml" });
        const text = new File(["x"], "a.txt", { type: "text/plain" });
        const gif = new File(["GIF89a"], "a.gif", { type: "image/gif" });
        expect(await shrinkImage(svg)).toBe(svg);
        expect(await shrinkImage(gif)).toBe(gif);
        expect(await shrinkImage(text)).toBe(text);
    });
});
