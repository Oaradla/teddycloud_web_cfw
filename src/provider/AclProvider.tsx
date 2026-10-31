import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type { ReactNode } from "react";

import { useAuth } from "./AuthProvider";
import {
    ADMIN_MINE,
    fetchAclMine,
    fetchModelsChangeable,
    folderEntry,
    mineAllows,
    type AclMine,
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
/** while the rights of a logged-in user load, or when they could not be loaded */
const NO_RIGHTS: AclMine = { ...ADMIN_MINE, loginActive: true, level: "guest", admin: false };

const AclContext = createContext<AclContextValue | undefined>(undefined);

/** What the logged-in user may do; without login everyone is admin, as before. */
export const AclProvider = ({ children }: { children: ReactNode }) => {
    const auth = useAuth();
    const [mine, setMine] = useState<AclMine>(ADMIN_MINE);
    const [changeable, setChangeable] = useState(NOTHING_CHANGEABLE);
    const [loaded, setLoaded] = useState(false);
    const latest = useRef(0);

    const refresh = useCallback(async () => {
        if (!auth.enabled || !auth.loggedIn) {
            setMine(ADMIN_MINE);
            setLoaded(true);
            return;
        }
        const request = ++latest.current;
        let next = NO_RIGHTS;
        let nextChangeable = NOTHING_CHANGEABLE;
        try {
            next = await fetchAclMine();
            if (!next.admin && next.system.includes("model.create"))
                nextChangeable = await fetchModelsChangeable().catch(() => NOTHING_CHANGEABLE);
        } catch (e) {
            /* an older server without permissions: everyone is admin; other errors allow nothing */
            if ((e as { response?: Response }).response?.status === 404) next = ADMIN_MINE;
        }
        if (request !== latest.current) return; // a newer request (another user) answers
        setMine(next);
        setChangeable(nextChangeable);
        setLoaded(true);
    }, [auth.enabled, auth.loggedIn, auth.username]);

    useEffect(() => {
        // another user: nothing is allowed until the rights of this one are there
        setMine(NO_RIGHTS);
        setLoaded(false);
        void refresh();
    }, [refresh]);

    const value = useMemo<AclContextValue>(() => {
        const can = (scope: AclScope | "system", id: string, right: string) => {
            if (mine.admin) return true;
            if (scope === "system") return mine.system.includes(right);
            return mineAllows(mine, scope, id, right);
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
