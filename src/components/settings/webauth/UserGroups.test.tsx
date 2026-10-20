// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { aclMock } = vi.hoisted(() => ({
    aclMock: {
        saveAclLevels: vi.fn(),
        saveAclGroup: vi.fn(),
        deleteAclGroup: vi.fn(),
    },
}));

vi.mock("../../../utils/auth/aclApi", async (original) => ({
    ...(await original<typeof import("../../../utils/auth/aclApi")>()),
    ...aclMock,
}));

import type { AclCatalog } from "../../../utils/auth/aclApi";
import { buildRightsTree } from "../../../utils/auth/rightsTree";
import { UserGroups } from "./UserGroups";

const catalog: AclCatalog = {
    rights: [
        { name: "box.view", scope: "box", adminOnly: false },
        { name: "box.settings", scope: "box", adminOnly: false },
        { name: "tonie.view", scope: "tonie", adminOnly: false },
    ],
    levels: ["admin", "user", "guest"],
    levelLimits: { user: "*", guest: "box.view" },
    groups: [{ id: "g1", name: "Teens", base: "user", rights: "box.view" }],
    unassigned: { tonie: "tonie.view" },
    boxSettings: [{ id: "cloud.enabled", label: "Cloud enabled" }, { id: "cloud.x" }],
    boxSettingGroups: { cloud: "Cloud" },
};

describe("UserGroups", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        window.matchMedia ??= ((q: string) => ({
            matches: false,
            media: q,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
        })) as any;
        (globalThis as any).ResizeObserver ??= class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    const render = async (reload = vi.fn()) => {
        const tree = buildRightsTree(catalog.rights, catalog.boxSettings!, undefined, {
            cloud: "Cloud",
        });
        await act(async () => {
            root.render(
                <UserGroups
                    catalog={catalog}
                    tree={tree}
                    tonieTree={buildRightsTree(catalog.rights, [], ["tonie"])}
                    loadError={null}
                    reload={reload}
                />,
            );
        });
        return reload;
    };

    it("shows the built-in and own groups, the tree closed", async () => {
        await render();
        const tabs = [...container.querySelectorAll(".ant-tabs-tab")].map((e) => e.textContent);
        expect(tabs).toEqual(["sharing.levels.user", "sharing.levels.guest", "Teens"]);
        // tonies without owner are no group: shown apart, below the tabs
        expect(container.querySelector("h5")?.textContent).toBe(
            "settings.webAuth.levels.unassignedTonie",
        );
        expect(container.textContent).toContain("settings.webAuth.tree.all");
        expect(container.textContent).not.toContain("Cloud enabled");
    });

    it("saves the levels and a new group", async () => {
        aclMock.saveAclLevels.mockResolvedValue(undefined);
        aclMock.saveAclGroup.mockResolvedValue("g2");
        const reload = await render();
        const add = container.querySelector(".ant-tabs-nav-add") as HTMLElement;
        await act(async () => add.click());
        const save = [...container.querySelectorAll("button")].find((b) =>
            b.textContent?.includes("settings.webAuth.levels.save"),
        )!;
        await act(async () => save.click());
        expect(aclMock.saveAclLevels).toHaveBeenCalledWith({
            user: "*",
            guest: "box.view",
            unassignedTonie: "tonie.view",
        });
        expect(aclMock.saveAclGroup).toHaveBeenCalledTimes(1);
        expect(aclMock.saveAclGroup).toHaveBeenCalledWith({
            name: "settings.webAuth.levels.newGroup",
            base: "guest",
            rights: "box.view",
        });
        expect(reload).toHaveBeenCalled();
    });
});
