import { describe, expect, it } from "vitest";

import { ADMIN_MINE, listAllows, mineAllows } from "./aclApi";
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

describe("mineAllows", () => {
    const mine = {
        ...ADMIN_MINE,
        admin: false,
        tonies: { E00401020304050A: { owner: true, rights: ["tonie.view"] } },
        folders: { "private/bob": { owner: true, rights: ["folder.read", "folder.write"] } },
        unassignedRights: { tonie: ["tonie.view", "tonie.assign"] },
    };

    it("takes the rights the server decided", () => {
        expect(mineAllows(mine, "tonie", "e00401020304050a", "tonie.view")).toBe(true);
        expect(mineAllows(mine, "tonie", "e00401020304050a", "tonie.edit")).toBe(false);
        expect(mineAllows(mine, "tonie", "E00401020304050B", "tonie.assign")).toBe(true);
        expect(mineAllows(mine, "tonie", "E00401020304050B", "tonie.edit")).toBe(false);
        expect(mineAllows(mine, "folder", "/private/bob/sub/", "folder.write")).toBe(true);
        expect(mineAllows(mine, "folder", "private/alice", "folder.read")).toBe(false);
        expect(
            mineAllows(
                { ...mine, unassignedRights: undefined },
                "tonie",
                "E00401020304050B",
                "tonie.view",
            ),
        ).toBe(false);
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
