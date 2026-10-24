import { describe, expect, it } from "vitest";

import { actionDef, defaultValue, scopeOfActions } from "./cfwDefinitions";

describe("scopeOfActions", () => {
    it("takes the scope of the first action", () => {
        expect(scopeOfActions([{ action: 13 }, { action: 1 }])).toBe("global");
        expect(scopeOfActions([{ action: 1 }, { action: 13 }])).toBe("figure");
    });

    it("skips unknown actions", () => {
        expect(scopeOfActions([{ action: 0 }, { action: 200 }, { action: 9 }])).toBe("global");
    });

    it("is figure without a known action", () => {
        expect(scopeOfActions([])).toBe("figure");
        expect(scopeOfActions([{ action: 19 }])).toBe("figure");
    });

    it("is global for the idle power-off times", () => {
        expect(scopeOfActions([{ action: 18 }])).toBe("global");
    });
});

describe("defaultValue", () => {
    it("starts the ears from the value in effect", () => {
        expect(defaultValue(actionDef(5)!)).toBe(0);
        expect(defaultValue(actionDef(8)!)).toBe(3);
    });

    it("gives timers 30 minutes", () => {
        expect(defaultValue(actionDef(3)!)).toBe(30);
        expect(defaultValue(actionDef(4)!)).toBe(30);
    });
});
