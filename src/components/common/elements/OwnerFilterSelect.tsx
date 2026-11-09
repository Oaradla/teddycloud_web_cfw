import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select, Tooltip } from "antd";

import { useAcl } from "../../../provider/AclProvider";
import { fetchAclOwned, fetchAclUsers } from "../../../utils/auth/aclApi";
import { canHover } from "../../../utils/browser/browserUtils";

/** admins, when there are other users: show only the boxes or tonies the chosen users own */
export const useOwnerFilter = (kind: "boxes" | "tonies") => {
    const acl = useAcl();
    const [users, setUsers] = useState<string[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [owned, setOwned] = useState<Set<string>>();
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!acl.admin || !acl.loginActive) {
            setUsers([]);
            return;
        }
        fetchAclUsers()
            .then((list) => list.map((u) => u.username))
            .then((names) => setUsers(names.some((n) => n !== acl.username) ? names : []))
            .catch(() => setUsers([]));
    }, [acl.admin, acl.loginActive, acl.username]);

    useEffect(() => {
        setOwned(undefined);
        setFailed(false);
        if (!selected.length) return;
        let current = true;
        Promise.all(selected.map(fetchAclOwned))
            .then((all) => {
                if (!current) return;
                setOwned(
                    new Set(
                        all.flatMap((data) =>
                            (data[kind] ?? [])
                                .filter((i) => i.owner)
                                .map((i) => i.id.toUpperCase()),
                        ),
                    ),
                );
            })
            .catch(() => current && setFailed(true));
        return () => {
            current = false;
        };
    }, [selected, kind]);

    return useMemo(
        () => ({
            users,
            selected,
            setSelected,
            failed,
            loading: selected.length > 0 && !owned && !failed,
            // without the owners' lists the filter is off
            keep: (id: string) => !selected.length || failed || !!owned?.has(id.toUpperCase()),
        }),
        [users, selected, owned, failed],
    );
};

export const OwnerFilterSelect = ({ filter }: { filter: ReturnType<typeof useOwnerFilter> }) => {
    const { t } = useTranslation();
    if (!filter.users.length) return null;
    return (
        <Tooltip
            open={!canHover ? false : undefined}
            title={t(filter.failed ? "sharing.ownerFilterFailed" : "sharing.ownerFilterHint")}
        >
            <Select
                size="small"
                status={filter.failed ? "error" : undefined}
                mode="multiple"
                allowClear
                style={{ minWidth: 160, maxWidth: 400 }}
                placeholder={t("sharing.allOwners")}
                value={filter.selected}
                onChange={filter.setSelected}
                options={filter.users.map((name) => ({ value: name, label: name }))}
            />
        </Tooltip>
    );
};
