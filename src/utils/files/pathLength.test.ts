import { describe, expect, it } from "vitest";

import { isPathTooLong } from "./pathLength";

describe("isPathTooLong", () => {
    it("counts the encoded bytes", () => {
        expect(isPathTooLong("/" + "a".repeat(231))).toBe(false);
        expect(isPathTooLong("/" + "a".repeat(232))).toBe(true);
        expect(isPathTooLong("/" + "ä".repeat(38))).toBe(false);
        expect(isPathTooLong("/" + "ä".repeat(39))).toBe(true);
    });
});
