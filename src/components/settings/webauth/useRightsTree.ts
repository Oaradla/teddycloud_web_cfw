import { useEffect, useState } from "react";

import { fetchAclCatalog, type AclCatalog } from "../../../utils/auth/aclApi";
import { buildRightsTree, type RightsNode } from "../../../utils/auth/rightsTree";

/** catalog plus the full tree (with every single box setting) and the tonie tree */
export function useRightsTree(enabled = true): {
    catalog: AclCatalog | null;
    tree: RightsNode | null;
    tonieTree: RightsNode | null;
    error: unknown;
    reload: () => void;
} {
    const [catalog, setCatalog] = useState<AclCatalog | null>(null);
    const [tree, setTree] = useState<RightsNode | null>(null);
    const [tonieTree, setTonieTree] = useState<RightsNode | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [round, setRound] = useState(0);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        fetchAclCatalog()
            .then((cat) => {
                if (cancelled) return;
                setCatalog(cat);
                setTree(
                    buildRightsTree(
                        cat.rights,
                        cat.boxSettings ?? [],
                        undefined,
                        cat.boxSettingGroups ?? {},
                    ),
                );
                setTonieTree(buildRightsTree(cat.rights, [], ["tonie"]));
            })
            .catch((err) => {
                if (!cancelled) setError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [round, enabled]);

    return { catalog, tree, tonieTree, error, reload: () => setRound((r) => r + 1) };
}
