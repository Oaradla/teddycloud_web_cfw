import { describe, expect, it } from "vitest";

import { listAllows } from "./aclApi";
import { restrictMenu } from "./navFilter";

describe("listAllows", () => {
    it("matches like the server", () => {
        expect(listAllows("box.view, tonie.*", "tonie.assign")).toBe(true);
        expect(listAllows("box.view", "box.settings")).toBe(false);
        expect(listAllows("box.settings", "box.setting:cloud.enabled")).toBe(true);
        expect(listAllows("box.setting:cloud.*", "box.setting:cloud.enabled")).toBe(true);
        expect(listAllows("box.setting:cloud.*", "box.setting:core.x")).toBe(false);
        expect(listAllows("*", "folder.write")).toBe(true);
        expect(listAllows("", "box.view")).toBe(false);
        expect(listAllows(undefined, "box.view")).toBe(false);
    });
});

describe("restrictMenu", () => {
    const items = [
        {
            key: "general",
            label: "g",
            children: [
                { key: "guisettings", label: "gui" },
                { key: "webauth", label: "w" },
            ],
        },
        { key: "certificates", label: "c" },
        { key: "plugin-a", label: "p" },
        { key: "notifications", label: "n" },
    ];

    it("hides admin entries and lifts the children of admin pages", () => {
        const out = restrictMenu(items, ["certificates", "plugin-*"], ["general"]) ?? [];
        expect(out.map((i) => String((i as { key: string }).key))).toEqual([
            "guisettings",
            "webauth",
            "notifications",
        ]);
    });
});
