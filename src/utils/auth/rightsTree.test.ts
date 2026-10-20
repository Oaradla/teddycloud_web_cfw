import { describe, expect, it } from "vitest";

import type { AclRight } from "./aclApi";
import { buildRightsTree, checkedToList, leaves, listToChecked } from "./rightsTree";

const r = (name: string, adminOnly = false): AclRight => ({
    name,
    scope: name.split(".")[0],
    adminOnly,
});
const rights = [
    r("box.view"),
    r("box.settings"),
    r("box.setting"),
    r("box.cfw"),
    r("box.share"),
    r("tonie.view"),
    r("tonie.edit"),
    r("folder.read"),
    r("users.manage"),
    r("system.settings", true),
];
const settings = [{ id: "cloud.enabled" }, { id: "cloud.cacheContent" }, { id: "toniebox.slap" }];
const tree = buildRightsTree(rights, settings);

describe("rights tree", () => {
    it("groups rights by scope and settings by their first part", () => {
        expect(tree.children?.map((n) => n.key)).toEqual([
            "box.*",
            "tonie.*",
            "folder.read",
            "users.manage",
        ]);
        const boxSettings = tree.children?.[0].children?.find((n) => n.key === "box.settings");
        expect(boxSettings?.children?.map((n) => n.key)).toEqual([
            "box.setting:cloud.*",
            "box.setting:toniebox.slap",
        ]);
        expect(leaves(tree).some((l) => l.key.startsWith("system."))).toBe(false);
        const titled = buildRightsTree(rights, settings, undefined, { cloud: "Cloud" });
        const group = titled.children?.[0].children?.find((n) => n.key === "box.settings")
            ?.children?.[0];
        expect(group?.label).toBe("Cloud");
    });

    it("reads patterns and writes the shortest list", () => {
        const { checked, extra } = listToChecked(tree, "box.view, box.setting:cloud.*, system.x");
        expect(checked).toEqual([
            "box.view",
            "box.setting:cloud.cacheContent",
            "box.setting:cloud.enabled",
        ]);
        expect(extra).toEqual(["system.x"]);
        expect(checkedToList(tree, checked, extra)).toBe("box.view, box.setting:cloud.*, system.x");
    });

    it("writes * when everything is ticked and nothing when nothing is", () => {
        const all = leaves(tree).map((l) => l.key);
        expect(checkedToList(tree, all)).toBe("*");
        expect(listToChecked(tree, "*").checked).toEqual(all);
        expect(checkedToList(tree, [])).toBe("");
    });

    it("box.settings covers the single settings", () => {
        const { checked } = listToChecked(tree, "box.settings");
        expect(checked).toHaveLength(3);
        expect(checkedToList(tree, checked)).toBe("box.settings");
    });

    it("limits the tree to one scope", () => {
        const tonies = buildRightsTree(rights, [], ["tonie"]);
        expect(checkedToList(tonies, ["tonie.view"])).toBe("tonie.view");
        expect(checkedToList(tonies, ["tonie.view", "tonie.edit"])).toBe("tonie.*");
    });
});
