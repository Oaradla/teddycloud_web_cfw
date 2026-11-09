import { afterEach, describe, expect, it } from "vitest";
import { CFW_CAP, CfwBox, cfwWithoutTemporary, formatBuild } from "./cfwApi";

const savedTz = process.env.TZ;

/** runs with the browser's (here: the process') time zone set to tz */
const inZone = (tz: string, run: () => void) => {
    process.env.TZ = tz;
    run();
};

afterEach(() => {
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
});

describe("formatBuild", () => {
    // 2026-10-13 10:04:44 UTC
    const build = 1791885884;

    it("shows the build time in the browser's local time", () => {
        inZone("UTC", () => expect(formatBuild(build)).toBe("2026-10-13 10:04"));
        inZone("Europe/Berlin", () => expect(formatBuild(build)).toBe("2026-10-13 12:04"));
        inZone("America/New_York", () => expect(formatBuild(build)).toBe("2026-10-13 06:04"));
    });

    it("pads month, day, hour and minute", () => {
        // 2026-01-02 03:04:05 UTC
        inZone("UTC", () => expect(formatBuild(1767323045)).toBe("2026-01-02 03:04"));
    });

    it("shows a dash for no build", () => {
        expect(formatBuild(0)).toBe("-");
    });
});

describe("cfwWithoutTemporary", () => {
    const box = (id: string, isCfw: boolean, capabilities: number) =>
        ({ id, isCfw, helloValid: true, capabilities, settings: { enabled: true } }) as CfwBox;

    it("lists the custom firmware boxes without the until-switch-off capability", () => {
        const boxes = [
            box("old", true, CFW_CAP.eventTags),
            box("new", true, CFW_CAP.temporary),
            box("ofw", false, 0),
        ];
        expect(cfwWithoutTemporary(boxes).map((b) => b.id)).toEqual(["old"]);
    });
});
