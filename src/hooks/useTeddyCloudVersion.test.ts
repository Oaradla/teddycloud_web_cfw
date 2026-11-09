import { describe, expect, it } from "vitest";
import { releaseCandidateTag } from "./useTeddyCloudVersion";

describe("releaseCandidateTag", () => {
    it("maps the version id of a release candidate back to its tag", () => {
        expect(releaseCandidateTag("v0.7.1-rc")).toBe("rc_v0.7.1");
        expect(releaseCandidateTag("v0.7.1-rc2")).toBe("rc_v0.7.1-2");
    });
});
