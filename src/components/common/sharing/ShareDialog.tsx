import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Checkbox, Flex, Modal, Select, Spin, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

import { useAcl } from "../../../provider/AclProvider";
import {
    fetchAclCatalog,
    fetchAclEntry,
    fetchAclUsers,
    saveAclEntry,
    type AclScope,
    type AclUser,
} from "../../../utils/auth/aclApi";
import { authErrorText } from "../../settings/webauth/authFormat";

const { Text } = Typography;

type Row = { user: string; rights: string[] };

const EVERYONE = "*";

function toRow(user: string, list: string): Row {
    return { user, rights: list.split(/[,\s]+/).filter(Boolean) };
}

/** Owners of a box or tonie (set by its owners and admins); owners (admins only) and shares of a library folder. */
export const ShareDialog = ({
    open,
    type,
    id,
    title,
    onClose,
}: {
    open: boolean;
    type: AclScope;
    id: string;
    title: string;
    onClose: () => void;
}) => {
    const { t } = useTranslation();
    const acl = useAcl();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [owners, setOwners] = useState<string[]>([]);
    const [rows, setRows] = useState<Row[]>([]);
    const [users, setUsers] = useState<AclUser[]>([]);
    const [rights, setRights] = useState<string[]>([]);
    const [inherited, setInherited] = useState<string | undefined>(undefined);
    const ownersOnly = type !== "folder";

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const [entry, catalog, userList] = await Promise.all([
                    fetchAclEntry(type, id),
                    fetchAclCatalog(),
                    fetchAclUsers(),
                ]);
                if (cancelled) return;
                setOwners(entry.owners ?? []);
                setRows(
                    Object.entries(entry.shares ?? {}).map(([user, list]) => toRow(user, list)),
                );
                setInherited(
                    entry.inheritedFrom !== undefined && entry.inheritedFrom !== entry.id
                        ? entry.inheritedFrom
                        : undefined,
                );
                setUsers(userList);
                setRights(
                    catalog.rights
                        .filter(
                            (r) =>
                                r.scope === type &&
                                !r.adminOnly &&
                                !r.name.endsWith(".share") &&
                                r.name !== "box.setting",
                        )
                        .map((r) => r.name),
                );
            } catch (err) {
                if (!cancelled) setError(authErrorText(t, err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, type, id]);

    const userOptions = useMemo(
        () => [
            { value: EVERYONE, label: t("sharing.everyone") },
            ...users
                .filter((u) => u.username.toLowerCase() !== acl.username.toLowerCase())
                .map((u) => ({
                    value: u.username,
                    label: `${u.username} (${t(`sharing.levels.${u.level}`)})`,
                })),
        ],
        [users, acl.username, t],
    );

    const update = (index: number, change: Partial<Row>) =>
        setRows((list) => list.map((row, i) => (i === index ? { ...row, ...change } : row)));

    // the server refuses an owner list without owners from a non-admin
    const ownerMissing = ownersOnly && !acl.admin && owners.length === 0;

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const shares: Record<string, string> = {};
            rows.filter((r) => r.user).forEach((r) => (shares[r.user] = r.rights.join(", ")));
            await saveAclEntry(
                type,
                id,
                ownersOnly ? { owners } : acl.admin ? { owners, shares } : { shares },
            );
            await acl.refresh();
            onClose();
        } catch (err) {
            setError(authErrorText(t, err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            title={t(ownersOnly ? "sharing.ownersTitle" : "sharing.title", { name: title })}
            onCancel={onClose}
            onOk={() => void save()}
            okText={t("sharing.save")}
            cancelText={t("common.cancel")}
            confirmLoading={saving}
            okButtonProps={{ disabled: loading || ownerMissing }}
            width={720}
            destroyOnHidden
        >
            {loading ? (
                <Flex justify="center" style={{ padding: 24 }}>
                    <Spin />
                </Flex>
            ) : (
                <Flex vertical gap={16}>
                    {error ? <Alert type="error" showIcon title={error} /> : null}
                    {inherited !== undefined ? (
                        <Alert
                            type="info"
                            showIcon
                            title={t("sharing.inherited", { folder: inherited || "/" })}
                        />
                    ) : null}
                    <div>
                        <Text strong>{t("sharing.owners")}</Text>
                        <Select
                            mode="multiple"
                            style={{ width: "100%", marginTop: 4 }}
                            value={owners}
                            disabled={!acl.admin && !ownersOnly}
                            onChange={setOwners}
                            options={users
                                .filter((u) => ownersOnly || u.level !== "guest")
                                .map((u) => ({ value: u.username, label: u.username }))}
                            placeholder={t("sharing.noOwners")}
                        />
                        <Text type={ownerMissing ? "danger" : "secondary"} style={{ fontSize: 12 }}>
                            {ownerMissing
                                ? t("sharing.ownerRequired")
                                : ownersOnly
                                  ? t("sharing.ownersOnlyHint")
                                  : acl.admin
                                    ? t("sharing.ownersHint")
                                    : t("sharing.ownersAdminOnly")}
                        </Text>
                    </div>
                    {ownersOnly ? null : (
                        <div>
                            <Text strong>{t("sharing.shares")}</Text>
                            {rows.length === 0 ? (
                                <div>
                                    <Text type="secondary">{t("sharing.noShares")}</Text>
                                </div>
                            ) : null}
                            {rows.map((row, index) => (
                                <Flex
                                    key={index}
                                    vertical
                                    gap={8}
                                    style={{
                                        padding: "12px 0",
                                        borderBottom: "1px solid rgba(128,128,128,0.2)",
                                    }}
                                >
                                    <Flex gap={8} align="center">
                                        <Select
                                            style={{ flex: 1 }}
                                            value={row.user || undefined}
                                            placeholder={t("sharing.pickUser")}
                                            onChange={(user) => update(index, { user })}
                                            options={userOptions.filter(
                                                (o) =>
                                                    o.value === row.user ||
                                                    !rows.some((r) => r.user === o.value),
                                            )}
                                            showSearch
                                        />
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            aria-label={t("sharing.remove")}
                                            onClick={() =>
                                                setRows((list) =>
                                                    list.filter((_, i) => i !== index),
                                                )
                                            }
                                            style={{ minWidth: 44, minHeight: 44 }}
                                        />
                                    </Flex>
                                    <Checkbox.Group
                                        value={row.rights}
                                        onChange={(values) =>
                                            update(index, {
                                                // rights without a checkbox here (e.g. "box.*" set by an admin) stay
                                                rights: [
                                                    ...row.rights.filter(
                                                        (r) => !rights.includes(r),
                                                    ),
                                                    ...(values as string[]),
                                                ],
                                            })
                                        }
                                        options={rights.map((r) => ({
                                            value: r,
                                            label: t(`sharing.rights.${r}`),
                                        }))}
                                    />
                                </Flex>
                            ))}
                            <Button
                                icon={<PlusOutlined />}
                                onClick={() =>
                                    setRows((list) => [
                                        ...list,
                                        {
                                            user: "",
                                            rights: ["folder.read"],
                                        },
                                    ])
                                }
                                style={{ marginTop: 12, minHeight: 44 }}
                            >
                                {t("sharing.add")}
                            </Button>
                        </div>
                    )}
                </Flex>
            )}
        </Modal>
    );
};
