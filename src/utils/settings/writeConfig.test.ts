import { afterEach, describe, expect, it, vi } from "vitest";

import { writeConfig } from "./writeConfig";

const answer = (status: number) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status }));

describe("writeConfig", () => {
    afterEach(() => vi.restoreAllMocks());

    it("takes the 403 of a user who is no admin as done", async () => {
        answer(403);
        await expect(writeConfig()).resolves.toBeUndefined();
    });

    it("reports other errors", async () => {
        answer(500);
        await expect(writeConfig()).rejects.toBeTruthy();
    });
});
