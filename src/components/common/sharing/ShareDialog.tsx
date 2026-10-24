import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Checkbox, Flex, Modal, Select, Spin, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

import { useAcl } from "../../../provider/AclProvider";
import {
    fetchAclCatalog,
    fetchAclEntry,
    fetchAclUsers,
    fetchBoxSettingNames,
    saveAclEntry,
    type AclScope,
    type AclUser,
} from "../../../utils/auth/aclApi";
import { authErrorText } from "../../settings/webauth/authFormat";
import { shownInBoxDialog } from "../../cfw/cfwSettingsVisibility";
import { useCfwBoxDialog } from "../../cfw/useCfwBoxDialog";

const { Text } = Typography;

type Row = { user: string; rights: string[]; settings: string[] };

const EVERYONE = "*";

function toRow(user: string, list: string): Row {
    const parts = list.split(/[,\s]+/).filter(Boolean);
    return {
        user,
        rights: parts.filter((p) => !p.startsWith("box.setting:")),
        settings: parts
            .filter((p) => p.startsWith("box.setting:"))
            .map((p) => p.slice("box.setting:".length)),
    };
}

function fromRow(row: Row): string {
    return [...row.rights, ...row.settings.map((s) => `box.setting:${s}`)].join(", ");
}

/** Owners (admins only) and shares of a box, tonie or library folder. */
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
    const [boxSettings, setBoxSettings] = useState<{ name: string; overlayed: boolean }[]>([]);
    /* only what the settings dialog of this box shows */
    const cfw = useCfwBoxDialog(type === "box" ? id : "", false);
    const settingNames = useMemo(
        () =>
            boxSettings
                .filter((s) => shownInBoxDialog(s.name, cfw, s.overlayed))
                .map((s) => s.name),
        [boxSettings, cfw.enabled, cfw.isCfwBox, cfw.forced],
    );
    const [inherited, setInherited] = useState<string | undefined>(undefined);

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
                const names = type === "box" ? await fetchBoxSettingNames(id).catch(() => []) : [];
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
                setBoxSettings(names);
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

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const shares: Record<string, string> = {};
            rows.filter((r) => r.user).forEach((r) => (shares[r.user] = fromRow(r)));
            await saveAclEntry(type, id, acl.admin ? { owners, shares } : { shares });
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
            title={t("sharing.title", { name: title })}
            onCancel={onClose}
            onOk={() => void save()}
            okText={t("sharing.save")}
            cancelText={t("common.cancel")}
            confirmLoading={saving}
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
                            disabled={!acl.admin}
                            onChange={setOwners}
                            options={users
                                .filter((u) => u.level !== "guest")
                                .map((u) => ({ value: u.username, label: u.username }))}
                            placeholder={t("sharing.noOwners")}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {acl.admin ? t("sharing.ownersHint") : t("sharing.ownersAdminOnly")}
                        </Text>
                    </div>
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
                                        options={userOptions}
                                        showSearch
                                    />
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        aria-label={t("sharing.remove")}
                                        onClick={() =>
                                            setRows((list) => list.filter((_, i) => i !== index))
                                        }
                                        style={{ minWidth: 44, minHeight: 44 }}
                                    />
                                </Flex>
                                <Checkbox.Group
                                    value={row.rights}
                                    onChange={(values) =>
                                        update(index, { rights: values as string[] })
                                    }
                                    options={rights.map((r) => ({
                                        value: r,
                                        label: t(`sharing.rights.${r}`),
                                    }))}
                                />
                                {type === "box" && !row.rights.includes("box.settings") ? (
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        value={row.settings}
                                        onChange={(settings) => update(index, { settings })}
                                        placeholder={t("sharing.singleSettings")}
                                        options={settingNames.map((n) => ({
                                            value: n,
                                            label: t(
                                                `settings.options.${n.replace(/\./g, "_")}.label`,
                                                n,
                                            ),
                                        }))}
                                    />
                                ) : null}
                            </Flex>
                        ))}
                        <Button
                            icon={<PlusOutlined />}
                            onClick={() =>
                                setRows((list) => [
                                    ...list,
                                    {
                                        user: "",
                                        rights: [`${type}.${type === "folder" ? "read" : "view"}`],
                                        settings: [],
                                    },
                                ])
                            }
                            style={{ marginTop: 12, minHeight: 44 }}
                        >
                            {t("sharing.add")}
                        </Button>
                    </div>
                </Flex>
            )}
        </Modal>
    );
};
