import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useAuth } from "./AuthProvider";
import {
    ADMIN_MINE,
    fetchAclMine,
    fetchModelsChangeable,
    listAllows,
    type AclMine,
    type AclMineEntry,
    type AclScope,
} from "../utils/auth/aclApi";

type AclContextValue = AclMine & {
    loaded: boolean;
    refresh: () => Promise<void>;
    /** right of the current user on a box (overlay id), tonie (ruid) or system */
    can: (scope: AclScope | "system", id: string, right: string) => boolean;
    owns: (scope: AclScope, id: string) => boolean;
    /** the box update: the update right on at least one box */
    canUpdateBoxes: boolean;
    canCreateModels: boolean;
    /** custom tonies the user added, or used only where the user may change things */
    mayChangeModel: (model: string) => boolean;
    /** pictures in custom_img the user added, or shown only by custom tonies the user may change */
    mayDeleteImage: (name: string) => boolean;
};

const NOTHING_CHANGEABLE = { models: [] as string[], images: [] as string[] };

/** the entry of a library folder itself or of its nearest parent */
function folderEntry(
    folders: Record<string, AclMineEntry>,
    path: string,
): AclMineEntry | undefined {
    let probe = path.replace(/^\/+|\/+$/g, "");
    while (true) {
        if (folders[probe]) return folders[probe];
        if (probe === "") return undefined;
        const slash = probe.lastIndexOf("/");
        probe = slash < 0 ? "" : probe.slice(0, slash);
    }
}

const AclContext = createContext<AclContextValue | undefined>(undefined);

/** What the logged-in user may do; without login everyone is admin, as before. */
export const AclProvider = ({ children }: { children: ReactNode }) => {
    const auth = useAuth();
    const [mine, setMine] = useState<AclMine>(ADMIN_MINE);
    const [changeable, setChangeable] = useState(NOTHING_CHANGEABLE);
    const [loaded, setLoaded] = useState(false);

    const refresh = useCallback(async () => {
        if (!auth.enabled || !auth.loggedIn) {
            setMine(ADMIN_MINE);
            setLoaded(true);
            return;
        }
        try {
            const next = await fetchAclMine();
            setMine(next);
            setChangeable(
                !next.admin && next.system.includes("model.create")
                    ? await fetchModelsChangeable().catch(() => NOTHING_CHANGEABLE)
                    : NOTHING_CHANGEABLE,
            );
        } catch {
            /* an older server without permissions: everyone is admin */
            setMine(ADMIN_MINE);
        } finally {
            setLoaded(true);
        }
    }, [auth.enabled, auth.loggedIn, auth.username]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const value = useMemo<AclContextValue>(() => {
        const can = (scope: AclScope | "system", id: string, right: string) => {
            if (mine.admin) return true;
            if (scope === "system") return mine.system.includes(right);
            if (scope === "box") return !!mine.boxes[id]?.rights?.includes(right);
            const entry =
                scope === "tonie" ? mine.tonies[id.toUpperCase()] : folderEntry(mine.folders, id);
            if (entry?.owner) return !listAllows(mine.deny, right);
            if (entry?.granted)
                return listAllows(entry.granted, right) && !listAllows(mine.deny, right);
            if (scope === "tonie" && !entry) return listAllows(mine.unassigned.tonie, right);
            return false;
        };
        const owns = (scope: AclScope, id: string) => {
            if (mine.admin) return true;
            if (scope === "folder") return !!folderEntry(mine.folders, id)?.owner;
            const map = scope === "box" ? mine.boxes : mine.tonies;
            return !!map[scope === "tonie" ? id.toUpperCase() : id]?.owner;
        };
        const canUpdateBoxes =
            mine.admin || Object.values(mine.boxes).some((b) => b.rights?.includes("box.update"));
        const mayChangeModel = (model: string) => {
            const key = model.toLowerCase();
            return (
                mine.admin ||
                !!mine.models?.[key]?.owner ||
                changeable.models.some((name) => name.toLowerCase() === key)
            );
        };
        const mayDeleteImage = (name: string) =>
            mine.admin || !!mine.images?.[name]?.owner || changeable.images.includes(name);
        const canCreateModels = mine.admin || mine.system.includes("model.create");
        return {
            ...mine,
            loaded,
            refresh,
            can,
            owns,
            canCreateModels,
            mayChangeModel,
            mayDeleteImage,
            canUpdateBoxes,
        };
    }, [mine, changeable, loaded, refresh]);

    return <AclContext.Provider value={value}>{children}</AclContext.Provider>;
};

export const useAcl = (): AclContextValue => {
    const context = useContext(AclContext);
    if (!context) {
        throw new Error("useAcl must be used within AclProvider");
    }
    return context;
};
