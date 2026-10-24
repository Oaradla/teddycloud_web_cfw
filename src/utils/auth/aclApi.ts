import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";
import { AuthApiError } from "./webAuthApi";

const api = new TeddyCloudApi(defaultAPIConfig());

export type AclScope = "box" | "tonie" | "folder";

export type AclMineEntry = { owner?: boolean; granted?: string; rights?: string[] };

export type AclMine = {
    loginActive: boolean;
    username: string;
    level: "admin" | "user" | "guest";
    group?: string;
    admin: boolean;
    deny: string;
    system: string[];
    boxes: Record<string, AclMineEntry>;
    tonies: Record<string, AclMineEntry>;
    folders: Record<string, AclMineEntry>;
    /** custom tonies (model name lowercased) and custom_img pictures the user added */
    models?: Record<string, AclMineEntry>;
    images?: Record<string, AclMineEntry>;
    unassigned: { tonie?: string; box?: string };
};

export type AclRight = { name: string; scope: string; adminOnly: boolean };

/** an own group of users: of the kind "user" (owns and shares) or "guest" (gets what is shared) */
export type AclGroup = { id: string; name: string; base: "user" | "guest"; rights: string };

export type AclCatalog = {
    rights: AclRight[];
    levels: string[];
    levelLimits: { user?: string; guest?: string };
    groups?: AclGroup[];
    unassigned: { tonie?: string; box?: string };
    /** settings a user can get for a box, and the titles of their groups */
    boxSettings?: { id: string; label?: string }[];
    boxSettingGroups?: Record<string, string>;
};

export type AclEntry = {
    type: AclScope;
    id: string;
    owners: string[];
    shares: Record<string, string>;
    inheritedFrom?: string;
};

async function parse(response: Response, fallback: string): Promise<any> {
    const text = await response.text();
    let data: any = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { message: text };
    }
    if (!response.ok) {
        throw new AuthApiError(data.message || fallback, data.error || "failed", response.status);
    }
    return data;
}

export const ADMIN_MINE: AclMine = {
    loginActive: false,
    username: "",
    level: "admin",
    admin: true,
    deny: "",
    system: [],
    boxes: {},
    tonies: {},
    folders: {},
    unassigned: {},
};

export async function fetchAclMine(): Promise<AclMine> {
    const data = await parse(
        await api.apiGetTeddyCloudApiRaw("/api/acl/mine"),
        "Could not load permissions",
    );
    return { ...ADMIN_MINE, ...data };
}

/** custom tonies and pictures a non-admin may change besides the own ones */
export async function fetchModelsChangeable(): Promise<{ models: string[]; images: string[] }> {
    const data = await parse(
        await api.apiGetTeddyCloudApiRaw("/api/toniesCustomJsonChangeable"),
        "Could not load the custom tonies",
    );
    return {
        models: Array.isArray(data.models) ? data.models : [],
        images: Array.isArray(data.images) ? data.images : [],
    };
}

export type AclOwnedItem = { id: string; owner: boolean; granted?: string };
export type AclOwned = Record<
    "boxes" | "tonies" | "folders" | "models" | "images",
    AclOwnedItem[] | undefined
>;

/** what belongs to a user or is shared with them (admins only) */
export async function fetchAclOwned(user: string): Promise<AclOwned> {
    return parse(
        await api.apiGetTeddyCloudApiRaw(`/api/acl/owned?user=${encodeURIComponent(user)}`),
        "Could not load what belongs to the user",
    );
}

export async function fetchAclCatalog(): Promise<AclCatalog> {
    return parse(await api.apiGetTeddyCloudApiRaw("/api/acl/catalog"), "Could not load the rights");
}

export async function fetchAclEntry(type: AclScope, id: string): Promise<AclEntry> {
    const query = `type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
    return parse(
        await api.apiGetTeddyCloudApiRaw(`/api/acl/get?${query}`),
        "Could not load the shares",
    );
}

export async function saveAclEntry(
    type: AclScope,
    id: string,
    changes: { owners?: string[]; shares?: Record<string, string> },
): Promise<AclEntry> {
    return parse(
        await api.apiPostTeddyCloudJsonRaw("/api/acl/set", { type, id, ...changes }),
        "Could not save the shares",
    );
}

export async function saveAclLevels(limits: {
    user?: string;
    guest?: string;
    unassignedTonie?: string;
    unassignedBox?: string;
}): Promise<void> {
    await parse(
        await api.apiPostTeddyCloudJsonRaw("/api/acl/levels/set", limits),
        "Could not save the levels",
    );
}

/** true if a comma separated list of patterns covers the right (same rules as the server) */
export function listAllows(list: string | undefined, right: string): boolean {
    if (!list) {
        return false;
    }
    return list
        .split(/[,\s]+/)
        .filter(Boolean)
        .some((pattern) => {
            if (pattern === "*") return true;
            if (pattern === "box.settings" && right.startsWith("box.setting:")) return true;
            if (pattern.endsWith("*")) return right.startsWith(pattern.slice(0, -1));
            return pattern === right;
        });
}

export type AclUser = { username: string; level: string; group?: string };

export async function fetchAclUsers(): Promise<AclUser[]> {
    const data = await parse(
        await api.apiGetTeddyCloudApiRaw("/api/acl/users"),
        "Could not load users",
    );
    return Array.isArray(data.users) ? data.users : [];
}

/** the settings of a box the current user may change, and whether the box has an own value */
export async function fetchBoxSettingNames(
    overlay: string,
): Promise<{ name: string; overlayed: boolean }[]> {
    const data = await parse(
        await api.apiGetTeddyCloudApiRaw(
            `/api/settings/getIndex?overlay=${encodeURIComponent(overlay)}&nolevel=t`,
        ),
        "Could not load the settings",
    );
    return Array.isArray(data.options)
        ? data.options
              .filter((o: any) => o.writable !== false)
              .map((o: any) => ({ name: String(o.ID), overlayed: Boolean(o.overlayed) }))
        : [];
}

/** saves a group; without id a new one is made, its id comes back */
export async function saveAclGroup(group: Omit<AclGroup, "id"> & { id?: string }): Promise<string> {
    const data = await parse(
        await api.apiPostTeddyCloudJsonRaw("/api/acl/groups/set", group),
        "Could not save the group",
    );
    return String(data.id ?? "");
}

export async function deleteAclGroup(id: string): Promise<void> {
    await parse(
        await api.apiPostTeddyCloudJsonRaw("/api/acl/groups/delete", { id }),
        "Could not delete the group",
    );
}
